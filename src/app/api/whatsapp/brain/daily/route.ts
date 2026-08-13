import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ConversationLogRow {
  telefone: string
  direction: 'inbound' | 'outbound' | 'system'
  event_type: string
  content: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

interface OutboxRow {
  to_number: string
  message_type: string
  payload: Record<string, unknown> | null
  status: string
  source: string | null
  idempotency_key: string | null
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

interface JanelaRelatorio {
  since: Date
  until: Date
  historical: boolean
}

export function resolverJanelaRelatorio(
  request: Pick<NextRequest, 'nextUrl'>,
  now = new Date(),
): JanelaRelatorio {
  const fromParam = request.nextUrl.searchParams.get('from')
  const toParam = request.nextUrl.searchParams.get('to')

  if (fromParam || toParam) {
    if (!fromParam || !toParam) throw new Error('from e to devem ser informados em conjunto')
    const since = new Date(fromParam)
    const until = new Date(toParam)
    if (!Number.isFinite(since.getTime()) || !Number.isFinite(until.getTime())) {
      throw new Error('from/to invalidos')
    }
    const duration = until.getTime() - since.getTime()
    if (duration <= 0 || duration > 31 * 24 * 60 * 60 * 1000) {
      throw new Error('janela historica deve ter entre 1 segundo e 31 dias')
    }
    if (until.getTime() > now.getTime() + 5 * 60 * 1000) {
      throw new Error('to nao pode estar no futuro')
    }
    return { since, until, historical: true }
  }

  const hours = Number(request.nextUrl.searchParams.get('hours') ?? 24)
  const safeHours = Number.isFinite(hours) ? Math.min(Math.max(hours, 1), 168) : 24
  return {
    since: new Date(now.getTime() - safeHours * 60 * 60 * 1000),
    until: now,
    historical: false,
  }
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

function actorLog(log: ConversationLogRow): string {
  const actor = log.metadata?.actor
  return typeof actor === 'string' ? actor : ''
}

function isHumano(log: ConversationLogRow): boolean {
  return actorLog(log) === 'humano'
}

function isAgente(log: ConversationLogRow): boolean {
  const actor = actorLog(log)
  return actor === 'agente' || (log.direction === 'outbound' && actor !== 'humano')
}

function elegivelParaAprendizagem(log: ConversationLogRow): boolean {
  return log.metadata?.learningEligible !== false
    && log.metadata?.escalationIntent !== 'fora_escopo'
}

function contarTelefonesUnicos(logs: ConversationLogRow[]): number {
  return new Set(logs.map(l => l.telefone)).size
}

function detectarRedundancia(logs: ConversationLogRow[]): Array<{ telefone: string; motivo: string }> {
  const porTelefone = new Map<string, ConversationLogRow[]>()
  for (const log of logs) {
    if (!porTelefone.has(log.telefone)) porTelefone.set(log.telefone, [])
    porTelefone.get(log.telefone)!.push(log)
  }

  const achados: Array<{ telefone: string; motivo: string }> = []
  for (const [telefone, linhas] of porTelefone) {
    const outbound = linhas.filter(l => l.direction === 'outbound' && l.content && isAgente(l))
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

function conteudoUtilParaAprendizagem(content: string): boolean {
  const texto = content.replace(/\s+/g, ' ').trim()
  if (texto.length < 8) return false
  if (/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u.test(texto)) return false
  return true
}

function exemplosAtendimentoHumano(logs: ConversationLogRow[]): Array<{ telefone: string; cliente: string; humano: string }> {
  const candidatos: Array<{ telefone: string; cliente: string; humano: string; score: number }> = []
  const porTelefone = new Map<string, ConversationLogRow[]>()

  for (const log of logs) {
    if (!porTelefone.has(log.telefone)) porTelefone.set(log.telefone, [])
    porTelefone.get(log.telefone)!.push(log)
  }

  for (const [telefone, linhas] of porTelefone) {
    for (let i = 0; i < linhas.length; i += 1) {
      const atual = linhas[i]
      if (!atual.content || !isHumano(atual)) continue
      if (!conteudoUtilParaAprendizagem(atual.content)) continue

      const clienteAnterior = linhas
        .slice(0, i)
        .reverse()
        .find(l => l.direction === 'inbound' && l.content)

      const cliente = clienteAnterior?.content ?? ''
      candidatos.push({
        telefone,
        cliente,
        humano: atual.content,
        score: (cliente ? 10 : 0) + Math.min(5, Math.floor(atual.content.length / 80)),
      })
      break
    }
  }

  return candidatos
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ telefone, cliente, humano }) => ({ telefone, cliente, humano }))
}

function oportunidadesAprendizagem(logs: ConversationLogRow[]): string[] {
  const saidas: string[] = []
  const exemplos = exemplosAtendimentoHumano(logs)
  const humanos = logs.filter(l => l.direction === 'outbound' && isHumano(l)).length
  const clientes = logs.filter(l => l.direction === 'inbound').length

  if (humanos > 0) {
    saidas.push('Extrair padroes das respostas humanas para transformar em regras aprovadas do tenant.')
  }
  if (clientes > 0 && humanos === 0) {
    saidas.push('Ha mensagens de clientes sem resposta humana observada nesta janela; verificar se foram respondidas fora do webhook ou se houve perda de evento.')
  }
  if (exemplos.some(e => /preco|preÃ§o|valor|quanto/i.test(`${e.cliente} ${e.humano}`))) {
    saidas.push('Rever como humanos tratam pedidos de preco para separar regra generica de regra comercial AutoJulmar.')
  }
  if (exemplos.some(e => /prazo|quando|levant|entrega|encomenda/i.test(`${e.cliente} ${e.humano}`))) {
    saidas.push('Criar ou melhorar regra de acompanhamento de encomendas e pedidos de levantamento.')
  }
  if (saidas.length === 0) {
    saidas.push('Continuar observacao: ainda nao ha padroes humanos suficientes para promover conhecimento.')
  }

  return saidas
}

function sugestoes(
  logs: ConversationLogRow[],
  outbox: OutboxRow[],
  memorias: MemoryRow[],
): string[] {
  const saidas: string[] = []
  const redundancias = detectarRedundancia(logs)
  const takeover = contarTelefonesUnicos(logs.filter(l => l.event_type === 'human_takeover'))
  const falhas = outbox.filter(o => o.status === 'failed').length
  const pendentes = outbox.filter(o => o.status === 'pending' || o.status === 'locked').length
  const memoriasTakeover = memorias.filter(m => m.state === 'takeover').length

  if (redundancias.length > 0) {
    saidas.push('Rever regra de saudacao/repeticao: foram detectadas conversas com possivel redundancia.')
  }
  if (takeover > 0 || memoriasTakeover > 0) {
    saidas.push('Analisar conversas assumidas por humano para extrair regras que o agente ainda nao domina.')
  }
  if (logs.some(l => l.direction === 'outbound' && isHumano(l))) {
    saidas.push('Usar respostas humanas observadas como material de rascunho para FAQs e regras, sempre com aprovacao humana.')
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

  let janela: JanelaRelatorio
  try {
    janela = resolverJanelaRelatorio(request)
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    )
  }

  const supabase = criarClienteAdmin()
  const tenantSlug = process.env.WHATSAPP_TENANT_SLUG ?? 'autojulmar'

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('slug', tenantSlug)
    .single()

  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'tenant not found' }, { status: 404 })
  }

  const sinceIso = janela.since.toISOString()
  const untilIso = janela.until.toISOString()
  const [{ data: logs }, { data: outbox }, { data: memorias }] = await Promise.all([
    supabase
      .from('whatsapp_conversation_logs')
      .select('telefone, direction, event_type, content, metadata, created_at')
      .eq('tenant_id', tenant.id)
      .gte('created_at', sinceIso)
      .lt('created_at', untilIso)
      .order('created_at', { ascending: true }),
    supabase
      .from('whatsapp_outbox')
      .select('to_number, message_type, payload, status, source, idempotency_key, last_error, created_at, sent_at')
      .gte('created_at', sinceIso)
      .lt('created_at', untilIso)
      .order('created_at', { ascending: false }),
    supabase
      .from('whatsapp_conversation_memory')
      .select('telefone, state, message_count, summary, last_user_message, last_assistant_message, last_interaction_at')
      .eq('tenant_id', tenant.id)
      .gte('last_interaction_at', sinceIso)
      .lt('last_interaction_at', untilIso)
      .order('last_interaction_at', { ascending: false })
      .limit(20),
  ])

  const logRows = (logs ?? []) as ConversationLogRow[]
  const outboxRows = (outbox ?? []) as OutboxRow[]
  const memoryRows = (memorias ?? []) as MemoryRow[]
  const learningRows = logRows.filter(elegivelParaAprendizagem)
  const redundancias = detectarRedundancia(logRows)
  const takeoverRows = logRows.filter(l => l.event_type === 'human_takeover')

  return NextResponse.json({
    ok: true,
    tenant: tenant.slug,
    since: sinceIso,
    until: untilIso,
    historical: janela.historical,
    metrics: {
      inbound: logRows.filter(l => l.direction === 'inbound').length,
      outbound: logRows.filter(l => l.direction === 'outbound').length,
      customerInbound: logRows.filter(l => l.direction === 'inbound').length,
      humanOutbound: logRows.filter(l => l.direction === 'outbound' && isHumano(l)).length,
      agentOutbound: logRows.filter(l => l.direction === 'outbound' && isAgente(l)).length,
      system: logRows.filter(l => l.direction === 'system').length,
      conversations: contarTelefonesUnicos(logRows),
      takeover: contarTelefonesUnicos(takeoverRows),
      takeoverConversations: contarTelefonesUnicos(takeoverRows),
      takeoverEvents: takeoverRows.length,
      outboxSent: outboxRows.filter(o => o.status === 'sent').length,
      outboxFailed: outboxRows.filter(o => o.status === 'failed').length,
      outboxPending: outboxRows.filter(o => o.status === 'pending' || o.status === 'locked').length,
    },
    candidateFaqs: topFaqs(learningRows),
    possibleRedundancy: redundancias,
    humanServiceExamples: exemplosAtendimentoHumano(learningRows),
    learningOpportunities: oportunidadesAprendizagem(learningRows),
    outboxIssues: outboxRows
      .filter(o => o.status === 'failed' || o.status === 'pending' || o.status === 'locked')
      .slice(0, 10)
      .map(o => ({
        toNumber: o.to_number,
        messageType: o.message_type,
        source: o.source,
        idempotencyKey: o.idempotency_key,
        payloadPreview: String(o.payload?.text ?? o.payload?.caption ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 240),
        status: o.status,
        lastError: o.last_error,
        createdAt: o.created_at,
        sentAt: o.sent_at,
      })),
    recentMemory: memoryRows.map(m => ({
      telefone: m.telefone,
      state: m.state,
      messageCount: m.message_count,
      lastUserMessage: m.last_user_message,
      lastAssistantMessage: m.last_assistant_message,
      lastObservedOutbound: m.last_assistant_message,
      lastInteractionAt: m.last_interaction_at,
    })),
    suggestions: sugestoes(logRows, outboxRows, memoryRows),
    activation: {
      automaticPromptChanges: false,
      requiresHumanApproval: true,
    },
  })
}
