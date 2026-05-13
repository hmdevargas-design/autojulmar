import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { enviarMensagemComMencoes } from '@/lib/whatsapp/sender'

// Números dos admins (sem @, sem +)
const ADMINS = ['351916958780', '351916785321']

export async function GET(request: NextRequest) {
  // Vercel injeta Authorization: Bearer <CRON_SECRET> nos cron jobs
  const auth = request.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET ?? ''

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const grupoJid = process.env.WHATSAPP_GRUPO_PEDIDOS
  if (!grupoJid) {
    console.warn('[Relatório] WHATSAPP_GRUPO_PEDIDOS não configurado — relatório não enviado')
    return NextResponse.json({ ok: false, motivo: 'grupo não configurado' })
  }

  const supabase   = criarClienteAdmin()
  const tenantSlug = process.env.WHATSAPP_TENANT_SLUG ?? 'autojulmar'

  // Resolver tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .single()

  if (!tenant) {
    return NextResponse.json({ ok: false, motivo: 'tenant não encontrado' })
  }

  // Intervalo: hoje 00:00 → 23:59 (hora de Lisboa — UTC+0/+1)
  const agora = new Date()
  // Início do dia em hora local PT: ajusta para UTC
  const offset = agora.getTimezoneOffset() // pode variar
  const inicioDia = new Date(agora)
  inicioDia.setHours(0, 0, 0, 0)
  const fimDia = new Date(agora)
  fimDia.setHours(23, 59, 59, 999)

  // Busca todos os pedidos de hoje
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select(`
      id, numero_pedido, valor_final, sinal, forma_pagamento, origem,
      dados,
      clientes ( nome ),
      estados_fluxo ( nome, is_final )
    `)
    .eq('tenant_id', tenant.id)
    .gte('criado_em', inicioDia.toISOString())
    .lte('criado_em', fimDia.toISOString())
    .order('criado_em', { ascending: true })

  const lista = pedidos ?? []

  if (lista.length === 0) {
    const mensagem = formatarRelatorioVazio(agora, ADMINS)
    await enviarMensagemComMencoes(grupoJid, mensagem, ADMINS)
    return NextResponse.json({ ok: true, pedidos: 0 })
  }

  const mensagem = formatarRelatorio(lista, agora, ADMINS)
  await enviarMensagemComMencoes(grupoJid, mensagem, ADMINS)

  console.log(`[Relatório] Enviado — ${lista.length} pedidos`)
  return NextResponse.json({ ok: true, pedidos: lista.length })
}

function formatarRelatorio(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pedidos: any[],
  agora: Date,
  admins: string[]
): string {
  const dataStr = agora.toLocaleDateString('pt-PT', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })

  const totalFaturado = pedidos.reduce((s, p) => s + Number(p.valor_final), 0)
  const totalSinais   = pedidos.reduce((s, p) => s + Number(p.sinal ?? 0), 0)

  const viaWhatsapp = pedidos.filter(p => p.origem === 'whatsapp')
  const viaWeb      = pedidos.filter(p => p.origem === 'web' || p.origem === 'api')

  const emAberto = pedidos.filter(p => {
    const estado = p.estados_fluxo as { nome: string; is_final: boolean } | null
    return !estado?.is_final
  })

  const mencoes = admins.map(n => `@${n}`).join(' ')

  const linhas: string[] = [
    `📊 *Relatório diário — ${capitalizar(dataStr)}*`,
    `${mencoes}`,
    '',
    `📦 *${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''}* · *${totalFaturado.toFixed(2)}€* faturado`,
    totalSinais > 0 ? `💰 Sinais recebidos: ${totalSinais.toFixed(2)}€` : '',
  ]

  // Clientes atendidos pelo agente WhatsApp
  if (viaWhatsapp.length > 0) {
    linhas.push('', `🤖 *Via WhatsApp (agente) — ${viaWhatsapp.length}:*`)
    for (const p of viaWhatsapp) {
      const cliente = (p.clientes as { nome: string } | null)?.nome ?? 'Sem nome'
      const dados   = (p.dados ?? {}) as Record<string, unknown>
      const material  = typeof dados.material   === 'string' ? dados.material   : ''
      const tipoRaw   = dados.tipo_tapete
      const tipos     = Array.isArray(tipoRaw)  ? (tipoRaw as string[]).join('+') :
                        typeof tipoRaw === 'string' ? tipoRaw : ''
      const matricula = typeof dados.matricula  === 'string' ? dados.matricula  : ''
      const produto   = [material, tipos].filter(Boolean).join(' ')
      const detalhe   = [produto, matricula].filter(Boolean).join(' · ')
      linhas.push(`  • ${cliente} — ${detalhe || '—'} · *${Number(p.valor_final).toFixed(2)}€*`)
    }
  }

  // Pedidos via web
  if (viaWeb.length > 0) {
    const totalWeb = viaWeb.reduce((s, p) => s + Number(p.valor_final), 0)
    linhas.push('', `🖥️ *Via Web (operador) — ${viaWeb.length}:*`)
    for (const p of viaWeb) {
      const cliente = (p.clientes as { nome: string } | null)?.nome ?? 'Sem nome'
      const dados   = (p.dados ?? {}) as Record<string, unknown>
      const material  = typeof dados.material   === 'string' ? dados.material   : ''
      const tipoRaw   = dados.tipo_tapete
      const tipos     = Array.isArray(tipoRaw)  ? (tipoRaw as string[]).join('+') :
                        typeof tipoRaw === 'string' ? tipoRaw : ''
      const produto   = [material, tipos].filter(Boolean).join(' ')
      linhas.push(`  • ${cliente} — ${produto || '—'} · *${Number(p.valor_final).toFixed(2)}€*`)
    }
    void totalWeb // usado no log, não na mensagem para não repetir o total
  }

  // Pedidos em aberto
  if (emAberto.length > 0) {
    const nomes = emAberto
      .map(p => (p.clientes as { nome: string } | null)?.nome ?? `#${p.numero_pedido}`)
      .join(', ')
    linhas.push('', `⏳ *Em aberto (${emAberto.length}):* ${nomes}`)
  } else {
    linhas.push('', '✅ Todos os pedidos entregues!')
  }

  return linhas.filter(l => l !== '').join('\n')
}

function formatarRelatorioVazio(agora: Date, admins: string[]): string {
  const dataStr   = agora.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const mencoes   = admins.map(n => `@${n}`).join(' ')
  return `📊 *Relatório diário — ${capitalizar(dataStr)}*\n${mencoes}\n\n😴 Sem pedidos hoje.`
}

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
