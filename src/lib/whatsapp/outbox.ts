import { criarClienteAdmin } from '@/lib/supabase/admin'

export type WhatsappOutboxMessageType = 'text' | 'image' | 'mentions'
export type WhatsappOutboxStatus = 'pending' | 'locked' | 'sent' | 'failed' | 'cancelled'

export interface WhatsappOutboxOptions {
  tenantId?: string | null
  priority?: number
  availableAt?: Date | string
  maxAttempts?: number
  source?: string
  conversationKey?: string
  idempotencyKey?: string
}

export interface WhatsappOutboxItem {
  id: string
  tenant_id: string | null
  to_number: string
  message_type: WhatsappOutboxMessageType
  payload: Record<string, unknown>
  status: WhatsappOutboxStatus
  priority: number
  available_at: string
  locked_until: string | null
  attempts: number
  max_attempts: number
  last_error: string | null
  source: string | null
  conversation_key: string | null
  idempotency_key: string | null
  created_at: string
  updated_at: string
  sent_at: string | null
}

const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_PRIORITY = 100

function intEnv(nome: string, fallback: number): number {
  const valor = Number(process.env[nome])
  return Number.isFinite(valor) ? valor : fallback
}

export function outboxAtiva(): boolean {
  return process.env.WHATSAPP_OUTBOX_ENABLED !== 'false'
}

export function outboxDryRunAtivo(): boolean {
  return process.env.WHATSAPP_OUTBOX_DRY_RUN !== 'false'
}

export function workerAtivo(): boolean {
  return process.env.WHATSAPP_OUTBOX_WORKER_ENABLED === 'true'
}

export function numerosTesteWhatsapp(): string[] {
  return (process.env.WHATSAPP_NUMEROS_TESTE ?? '')
    .split(/[\s,;]+/)
    .map(normalizarNumero)
    .filter(Boolean)
}

export function envioRealPermitidoParaNumero(numero: string): boolean {
  const numerosTeste = numerosTesteWhatsapp()
  return numerosTeste.length === 0 || numerosTeste.includes(normalizarNumero(numero))
}

export function limitePorExecucao(): number {
  return Math.max(1, intEnv('WHATSAPP_SEND_MAX_PER_RUN', 1))
}

export function cooldownGlobalSegundos(): number {
  return Math.max(0, intEnv('WHATSAPP_SEND_GLOBAL_COOLDOWN_SECONDS', 30))
}

export function maxPorNumeroPorHora(): number {
  return Math.max(0, intEnv('WHATSAPP_SEND_MAX_PER_NUMBER_PER_HOUR', 6))
}

export function lockSegundos(): number {
  return Math.max(30, intEnv('WHATSAPP_OUTBOX_LOCK_SECONDS', 120))
}

export function delayInicialSegundos(): number {
  const min = Math.max(0, intEnv('WHATSAPP_SEND_MIN_DELAY_SECONDS', 25))
  const max = Math.max(min, intEnv('WHATSAPP_SEND_MAX_DELAY_SECONDS', 60))
  if (max === min) return min
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function retryBackoffSegundos(attempts: number): number {
  const base = Math.min(3600, 60 * 2 ** Math.max(0, attempts - 1))
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(base * 0.25)))
  return base + jitter
}

function normalizarNumero(para: string): string {
  return para.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '')
}

function truncarErro(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : String(erro)
  return texto.replace(/\s+/g, ' ').trim().slice(0, 1000)
}

function dataDisponivel(options?: WhatsappOutboxOptions): string {
  if (options?.availableAt instanceof Date) return options.availableAt.toISOString()
  if (typeof options?.availableAt === 'string') return options.availableAt
  return new Date(Date.now() + delayInicialSegundos() * 1000).toISOString()
}

async function enfileirar(
  para: string,
  messageType: WhatsappOutboxMessageType,
  payload: Record<string, unknown>,
  options: WhatsappOutboxOptions = {},
): Promise<WhatsappOutboxItem | null> {
  const supabase = criarClienteAdmin()
  const toNumber = normalizarNumero(para)

  const row = {
    tenant_id: options.tenantId ?? null,
    to_number: toNumber,
    message_type: messageType,
    payload,
    priority: options.priority ?? DEFAULT_PRIORITY,
    available_at: dataDisponivel(options),
    max_attempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    source: options.source ?? null,
    conversation_key: options.conversationKey ?? null,
    idempotency_key: options.idempotencyKey ?? null,
  }

  const { data, error } = await supabase
    .from('whatsapp_outbox')
    .insert(row)
    .select('*')
    .single()

  if (!error) return data as WhatsappOutboxItem

  if (error.code === '23505' && options.idempotencyKey) {
    const { data: existing, error: selectError } = await supabase
      .from('whatsapp_outbox')
      .select('*')
      .eq('idempotency_key', options.idempotencyKey)
      .single()

    if (selectError) throw selectError
    console.log('[WhatsApp Outbox] Mensagem duplicada ignorada:', options.idempotencyKey)
    return existing as WhatsappOutboxItem
  }

  throw error
}

export async function enfileirarMensagemTexto(
  para: string,
  texto: string,
  options?: WhatsappOutboxOptions,
): Promise<WhatsappOutboxItem | null> {
  return enfileirar(para, 'text', { text: texto }, options)
}

export async function enfileirarImagem(
  para: string,
  imageUrl: string,
  caption?: string,
  options?: WhatsappOutboxOptions,
): Promise<WhatsappOutboxItem | null> {
  return enfileirar(para, 'image', { imageUrl, caption: caption ?? '' }, options)
}

export async function enfileirarMensagemComMencoes(
  para: string,
  texto: string,
  mencoes: string[],
  options?: WhatsappOutboxOptions,
): Promise<WhatsappOutboxItem | null> {
  return enfileirar(para, 'mentions', { text: texto, mentions: mencoes }, options)
}

export async function claimProximasMensagens(limit = limitePorExecucao()): Promise<WhatsappOutboxItem[]> {
  const supabase = criarClienteAdmin()
  const { data, error } = await supabase.rpc('claim_whatsapp_outbox', {
    p_limit: limit,
    p_lock_seconds: lockSegundos(),
    p_global_cooldown_seconds: cooldownGlobalSegundos(),
    p_max_per_number_per_hour: maxPorNumeroPorHora(),
  })

  if (error) throw error
  return (data ?? []) as WhatsappOutboxItem[]
}

export async function claimProximaMensagem(): Promise<WhatsappOutboxItem | null> {
  const [item] = await claimProximasMensagens(1)
  return item ?? null
}

export async function marcarEnviada(id: string, detalhe?: string): Promise<void> {
  const supabase = criarClienteAdmin()
  const { error } = await supabase
    .from('whatsapp_outbox')
    .update({
      status: 'sent',
      locked_until: null,
      sent_at: new Date().toISOString(),
      last_error: detalhe ?? null,
    })
    .eq('id', id)

  if (error) throw error
}

export async function marcarFalha(item: WhatsappOutboxItem, erro: unknown): Promise<void> {
  const supabase = criarClienteAdmin()
  const esgotouTentativas = item.attempts >= item.max_attempts
  const update = esgotouTentativas
    ? {
        status: 'failed',
        locked_until: null,
        last_error: truncarErro(erro),
      }
    : {
        status: 'pending',
        locked_until: null,
        available_at: new Date(Date.now() + retryBackoffSegundos(item.attempts) * 1000).toISOString(),
        last_error: truncarErro(erro),
      }

  const { error } = await supabase
    .from('whatsapp_outbox')
    .update(update)
    .eq('id', item.id)

  if (error) throw error
}

export async function cancelarMensagem(id: string, detalhe?: string): Promise<void> {
  const supabase = criarClienteAdmin()
  const { error } = await supabase
    .from('whatsapp_outbox')
    .update({ status: 'cancelled', locked_until: null, last_error: detalhe ?? null })
    .eq('id', id)

  if (error) throw error
}

export async function cancelarPendentesPorNumero(
  numero: string,
  detalhe = 'cancelado por takeover humano',
  source?: string,
): Promise<number> {
  const supabase = criarClienteAdmin()
  let query = supabase
    .from('whatsapp_outbox')
    .update({ status: 'cancelled', locked_until: null, last_error: detalhe })
    .eq('to_number', normalizarNumero(numero))
    .in('status', ['pending', 'locked'])

  if (source) query = query.eq('source', source)

  const { data, error } = await query.select('id')

  if (error) throw error
  return data?.length ?? 0
}
