import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { enviarMensagemComMencoes } from '@/lib/whatsapp/sender'

const ADMINS = ['351916958780', '351916785321']
const DAY_MS = 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET ?? ''

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const grupoJid = process.env.WHATSAPP_GRUPO_PEDIDOS
  if (!grupoJid) {
    console.warn('[Relatorio] WHATSAPP_GRUPO_PEDIDOS nao configurado - relatorio nao enviado')
    return NextResponse.json({ ok: false, motivo: 'grupo nao configurado' })
  }

  const supabase = criarClienteAdmin()
  const tenantSlug = process.env.WHATSAPP_TENANT_SLUG ?? 'autojulmar'

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .single()

  if (!tenant) {
    return NextResponse.json({ ok: false, motivo: 'tenant nao encontrado' })
  }

  // Cron runs after midnight UTC; report the previous day to avoid boundary issues.
  const dataOntem = new Date(Date.now() - DAY_MS)
  const ontem = dataOntem.toISOString().slice(0, 10)
  const inicioDia = new Date(`${ontem}T00:00:00.000Z`)
  const fimDia = new Date(inicioDia.getTime() + DAY_MS)

  const { data: atendimentos } = await supabase
    .from('log_atendimentos_whatsapp')
    .select('telefone, nome, num_mensagens, resultou_em_pedido, numero_pedido')
    .eq('tenant_id', tenant.id)
    .eq('dia', ontem)
    .order('num_mensagens', { ascending: false })

  const lista = atendimentos ?? []
  const metricasAgente = await obterMetricasAgente(supabase, tenant.id, inicioDia, fimDia)

  const mensagem = lista.length === 0
    ? formatarVazio(dataOntem, ADMINS, metricasAgente)
    : formatarRelatorio(lista, dataOntem, ADMINS, metricasAgente)

  await enviarMensagemComMencoes(grupoJid, mensagem, ADMINS)

  console.log(`[Relatorio] Enviado - ${lista.length} atendimentos`)
  return NextResponse.json({ ok: true, atendimentos: lista.length, agente: metricasAgente })
}

interface Atendimento {
  telefone: string
  nome: string | null
  num_mensagens: number
  resultou_em_pedido: boolean
  numero_pedido: number | null
}

interface MetricasAgente {
  inbound: number
  outbound: number
  enviados: number
  falhados: number
  pendentes: number
  bloqueados: number
  conversasRecentes: Array<{
    telefone: string
    state: string | null
    message_count: number
    last_user_message: string | null
  }>
}

async function obterMetricasAgente(
  supabase: ReturnType<typeof criarClienteAdmin>,
  tenantId: string,
  inicioDia: Date,
  fimDia: Date,
): Promise<MetricasAgente> {
  const inicio = inicioDia.toISOString()
  const fim = fimDia.toISOString()

  const [{ data: logs }, { data: outbox }, { data: memorias }] = await Promise.all([
    supabase
      .from('whatsapp_conversation_logs')
      .select('direction')
      .eq('tenant_id', tenantId)
      .gte('created_at', inicio)
      .lt('created_at', fim),
    supabase
      .from('whatsapp_outbox')
      .select('status, last_error')
      .eq('source', 'agente-julmar')
      .gte('created_at', inicio)
      .lt('created_at', fim),
    supabase
      .from('whatsapp_conversation_memory')
      .select('telefone, state, message_count, last_user_message, last_interaction_at')
      .eq('tenant_id', tenantId)
      .gte('last_interaction_at', inicio)
      .lt('last_interaction_at', fim)
      .order('last_interaction_at', { ascending: false })
      .limit(5),
  ])

  const logsRows = logs ?? []
  const outboxRows = outbox ?? []

  return {
    inbound: logsRows.filter(l => l.direction === 'inbound').length,
    outbound: logsRows.filter(l => l.direction === 'outbound').length,
    enviados: outboxRows.filter(o => o.status === 'sent').length,
    falhados: outboxRows.filter(o => o.status === 'failed').length,
    pendentes: outboxRows.filter(o => o.status === 'pending' || o.status === 'locked').length,
    bloqueados: outboxRows.filter(o =>
      o.status === 'cancelled'
      || String(o.last_error ?? '').includes('fora de WHATSAPP_NUMEROS_TESTE')
    ).length,
    conversasRecentes: (memorias ?? []).map(m => ({
      telefone: String(m.telefone ?? ''),
      state: (m.state as string | null) ?? null,
      message_count: Number(m.message_count ?? 0),
      last_user_message: (m.last_user_message as string | null) ?? null,
    })),
  }
}

function formatarRelatorio(
  lista: Atendimento[],
  agora: Date,
  admins: string[],
  metricas: MetricasAgente,
): string {
  const dataStr = agora.toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const mencoes = admins.map(n => `@${n}`).join(' ')
  const comPedido = lista.filter(a => a.resultou_em_pedido).length

  const linhas: string[] = [
    `*Relatorio diario - ${capitalizar(dataStr)}*`,
    mencoes,
    '',
    `*${lista.length} contacto${lista.length !== 1 ? 's' : ''} atendido${lista.length !== 1 ? 's' : ''} pelo agente:*`,
  ]

  for (const a of lista) {
    const nome = a.nome ? a.nome : a.telefone
    const tel = `(${a.telefone})`
    const msgs = `${a.num_mensagens} msg${a.num_mensagens !== 1 ? 's' : ''}`
    const pedido = a.resultou_em_pedido && a.numero_pedido
      ? ` - Pedido #${a.numero_pedido}`
      : ''
    linhas.push(`- ${nome} ${tel} - ${msgs}${pedido}`)
  }

  if (comPedido > 0) {
    linhas.push('', `${comPedido} de ${lista.length} resultou em pedido`)
  } else {
    linhas.push('', 'Nenhum atendimento resultou em pedido hoje')
  }

  linhas.push('', formatarMetricasAgente(metricas))

  return linhas.join('\n')
}

function formatarVazio(agora: Date, admins: string[], metricas: MetricasAgente): string {
  const dataStr = agora.toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const mencoes = admins.map(n => `@${n}`).join(' ')
  return `*Relatorio diario - ${capitalizar(dataStr)}*\n${mencoes}\n\nSem atendimentos via WhatsApp hoje.\n\n${formatarMetricasAgente(metricas)}`
}

function formatarMetricasAgente(metricas: MetricasAgente): string {
  const linhas = [
    '*Agente Julmar:*',
    `- Conversa: ${metricas.inbound} entrada${metricas.inbound !== 1 ? 's' : ''} / ${metricas.outbound} resposta${metricas.outbound !== 1 ? 's' : ''}`,
    `- Outbox: ${metricas.enviados} enviada${metricas.enviados !== 1 ? 's' : ''}, ${metricas.pendentes} pendente${metricas.pendentes !== 1 ? 's' : ''}, ${metricas.falhados} falhada${metricas.falhados !== 1 ? 's' : ''}, ${metricas.bloqueados} bloqueada${metricas.bloqueados !== 1 ? 's' : ''}`,
  ]

  if (metricas.conversasRecentes.length > 0) {
    linhas.push('', '*Memoria recente:*')
    for (const conversa of metricas.conversasRecentes) {
      const ultima = conversa.last_user_message
        ? ` - cliente: ${truncar(conversa.last_user_message, 90)}`
        : ''
      const estado = conversa.state ? ` (${conversa.state})` : ''
      linhas.push(`- ${conversa.telefone}${estado}: ${conversa.message_count} msgs${ultima}`)
    }
  }

  return linhas.join('\n')
}

function truncar(valor: string, max: number): string {
  const texto = valor.replace(/\s+/g, ' ').trim()
  if (texto.length <= max) return texto
  return `${texto.slice(0, max - 3).trim()}...`
}

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
