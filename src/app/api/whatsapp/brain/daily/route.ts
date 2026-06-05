import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ConversationLogRow {
  telefone: string
  direction: 'inbound' | 'outbound' | 'system'
  event_type: string
  content: string | null
  created_at: string
}

interface OutboxRow {
  to_number: string
  status: string
  last_error: string | null
  created_at: string
  sent_at: string | null
}

interface MemoryRow {
  telefone: string
  state: string | null
  message_count: number
  summary: string | null
  last_user_message: string | null
  last_assistant_message: string | null
  last_interaction_at: string | null
}

function autorizado(request: NextRequest): boolean {
  const secrets = [
    process.env.CRON_SECRET,
    process.env.WHATSAPP_OUTBOX_WORKER_SECRET,
  ].filter(Boolean)
  if (secrets.length === 0) return false
  const auth = request.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : ''
  return secrets.includes(bearer)
}

function inicioJanela(request: NextRequest): Date {
  const hours = Number(request.nextUrl.searchParams.get('hours') ?? 24)
  const safeHours = Number.isFinite(hours) ? Math.min(Math.max(hours, 1), 168) : 24
  return new Date(Date.now() - safeHours * 60 * 60 * 1000)
}

function normalizarPergunta(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[?!.,;:()[\]"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function parecePerguntaFrequente(texto: string): boolean {
  const t = texto.toLowerCase()
  return t.includes('?')
    || /\b(preco|preço|quanto|valor|prazo|demora|material|tapete|borracha|gti|veludo|levantamento|entrega)\b/.test(t)
}

function topFaqs(logs: ConversationLogRow[]): Array<{ pergunta: string; ocorrencias: number }> {
  const contagem = new Map<string, number>()
  for (const log of logs) {
    if (log.direction !== 'inbound' || !log.content) continue
    if (!parecePerguntaFrequente(log.content)) continue
    const chave = normalizarPergunta(log.content)
    if (!chave) continue
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
  }

  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([pergunta, ocorrencias]) => ({ pergunta, ocorrencias }))
}

function detectarRedundancia(logs: ConversationLogRow[]): Array<{ telefone: string; motivo: string }> {
  const porTelefone = new Map<string, ConversationLogRow[]>()
  for (const log of logs) {
    if (!porTelefone.has(log.telefone)) porTelefone.set(log.telefone, [])
    porTelefone.get(log.telefone)!.push(log)
  }

  const achados: Array<{ telefone: string; motivo: string }> = []
  for (const [telefone, linhas] of porTelefone) {
    const outbound = linhas.filter(l => l.direction === 'outbound' && l.content)
    const saudacoes = outbound.filter(l => /assistente inteligente|sou o assistente|em que posso ajudar/i.test(l.content ?? ''))
    if (saudacoes.length > 1) {
      achados.push({ telefone, motivo: `${saudacoes.length} saudacoes detectadas na janela` })
    }

    const ultimas = outbound.slice(-3).map(l => normalizarPergunta(l.content ?? ''))
    if (ultimas.length >= 2 && new Set(ultimas).size < ultimas.length) {
      achados.push({ telefone, motivo: 'respostas recentes muito parecidas' })
    }
  }

  return achados.slice(0, 10)
}

function sugestoes(
  logs: ConversationLogRow[],
  outbox: OutboxRow[],
  memorias: MemoryRow[],
): string[] {
  const saidas: string[] = []
  const redundancias = detectarRedundancia(logs)
  const takeover = logs.filter(l => l.event_type === 'human_takeover').length
  const falhas = outbox.filter(o => o.status === 'failed').length
  const pendentes = outbox.filter(o => o.status === 'pending' || o.status === 'locked').length
  const memoriasTakeover = memorias.filter(m => m.state === 'takeover').length

  if (redundancias.length > 0) {
    saidas.push('Rever regra de saudacao/repeticao: foram detectadas conversas com possivel redundancia.')
  }
  if (takeover > 0 || memoriasTakeover > 0) {
    saidas.push('Analisar conversas assumidas por humano para extrair regras que o agente ainda nao domina.')
  }
  if (falhas > 0) {
    saidas.push('Investigar falhas de envio na outbox antes de aumentar volume do agente.')
  }
  if (pendentes > 5) {
    saidas.push('Verificar cadencia do worker: ha muitas mensagens pendentes/locked.')
  }
  if (saidas.length === 0) {
    saidas.push('Sem sugestoes criticas nesta janela; manter observacao.')
  }

  return saidas
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = criarClienteAdmin()
  const tenantSlug = process.env.WHATSAPP_TENANT_SLUG ?? 'autojulmar'
  const since = inicioJanela(request)

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('slug', tenantSlug)
    .single()

  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'tenant not found' }, { status: 404 })
  }

  const sinceIso = since.toISOString()
  const [{ data: logs }, { data: outbox }, { data: memorias }] = await Promise.all([
    supabase
      .from('whatsapp_conversation_logs')
      .select('telefone, direction, event_type, content, created_at')
      .eq('tenant_id', tenant.id)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true }),
    supabase
      .from('whatsapp_outbox')
      .select('to_number, status, last_error, created_at, sent_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false }),
    supabase
      .from('whatsapp_conversation_memory')
      .select('telefone, state, message_count, summary, last_user_message, last_assistant_message, last_interaction_at')
      .eq('tenant_id', tenant.id)
      .gte('last_interaction_at', sinceIso)
      .order('last_interaction_at', { ascending: false })
      .limit(20),
  ])

  const logRows = (logs ?? []) as ConversationLogRow[]
  const outboxRows = (outbox ?? []) as OutboxRow[]
  const memoryRows = (memorias ?? []) as MemoryRow[]
  const redundancias = detectarRedundancia(logRows)

  return NextResponse.json({
    ok: true,
    tenant: tenant.slug,
    since: sinceIso,
    metrics: {
      inbound: logRows.filter(l => l.direction === 'inbound').length,
      outbound: logRows.filter(l => l.direction === 'outbound').length,
      system: logRows.filter(l => l.direction === 'system').length,
      conversations: new Set(logRows.map(l => l.telefone)).size,
      takeover: logRows.filter(l => l.event_type === 'human_takeover').length,
      outboxSent: outboxRows.filter(o => o.status === 'sent').length,
      outboxFailed: outboxRows.filter(o => o.status === 'failed').length,
      outboxPending: outboxRows.filter(o => o.status === 'pending' || o.status === 'locked').length,
    },
    candidateFaqs: topFaqs(logRows),
    possibleRedundancy: redundancias,
    recentMemory: memoryRows.map(m => ({
      telefone: m.telefone,
      state: m.state,
      messageCount: m.message_count,
      lastUserMessage: m.last_user_message,
      lastAssistantMessage: m.last_assistant_message,
      lastInteractionAt: m.last_interaction_at,
    })),
    suggestions: sugestoes(logRows, outboxRows, memoryRows),
    activation: {
      automaticPromptChanges: false,
      requiresHumanApproval: true,
    },
  })
}
