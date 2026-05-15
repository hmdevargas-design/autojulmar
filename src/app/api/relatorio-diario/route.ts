import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { enviarMensagemComMencoes } from '@/lib/whatsapp/sender'

const ADMINS = ['351916958780', '351916785321']

export async function GET(request: NextRequest) {
  const auth   = request.headers.get('authorization') ?? ''
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

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .single()

  if (!tenant) {
    return NextResponse.json({ ok: false, motivo: 'tenant não encontrado' })
  }

  // Cron corre às 00:05 UTC — consulta o dia anterior (ontem) para evitar boundary de meia-noite
  const dataOntem  = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const ontem      = dataOntem.toISOString().slice(0, 10)

  const { data: atendimentos } = await supabase
    .from('log_atendimentos_whatsapp')
    .select('telefone, nome, num_mensagens, resultou_em_pedido, numero_pedido')
    .eq('tenant_id', tenant.id)
    .eq('dia', ontem)
    .order('num_mensagens', { ascending: false })

  const lista = atendimentos ?? []

  const mensagem = lista.length === 0
    ? formatarVazio(dataOntem, ADMINS)
    : formatarRelatorio(lista, dataOntem, ADMINS)

  await enviarMensagemComMencoes(grupoJid, mensagem, ADMINS)

  console.log(`[Relatório] Enviado — ${lista.length} atendimentos`)
  return NextResponse.json({ ok: true, atendimentos: lista.length })
}

interface Atendimento {
  telefone:          string
  nome:              string | null
  num_mensagens:     number
  resultou_em_pedido: boolean
  numero_pedido:     number | null
}

function formatarRelatorio(lista: Atendimento[], agora: Date, admins: string[]): string {
  const dataStr  = agora.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const mencoes  = admins.map(n => `@${n}`).join(' ')
  const comPedido = lista.filter(a => a.resultou_em_pedido).length

  const linhas: string[] = [
    `📋 *Relatório diário — ${capitalizar(dataStr)}*`,
    mencoes,
    '',
    `👥 *${lista.length} contacto${lista.length !== 1 ? 's' : ''} atendido${lista.length !== 1 ? 's' : ''} pelo agente:*`,
  ]

  for (const a of lista) {
    const nome    = a.nome ? a.nome : a.telefone
    const tel     = `(${a.telefone})`
    const msgs    = `${a.num_mensagens} msg${a.num_mensagens !== 1 ? 's' : ''}`
    const pedido  = a.resultou_em_pedido && a.numero_pedido
      ? ` ✅ Pedido #${a.numero_pedido}`
      : ''
    linhas.push(`  • ${nome} ${tel} — ${msgs}${pedido}`)
  }

  if (comPedido > 0) {
    linhas.push('', `📦 ${comPedido} de ${lista.length} resultou em pedido`)
  } else {
    linhas.push('', '💬 Nenhum atendimento resultou em pedido hoje')
  }

  return linhas.join('\n')
}

function formatarVazio(agora: Date, admins: string[]): string {
  const dataStr = agora.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const mencoes = admins.map(n => `@${n}`).join(' ')
  return `📋 *Relatório diário — ${capitalizar(dataStr)}*\n${mencoes}\n\n😴 Sem atendimentos via WhatsApp hoje.`
}

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
