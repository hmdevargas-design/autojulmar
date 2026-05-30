import { criarClienteAdmin } from '@/lib/supabase/admin'

const MAX_MEMORY_CHARS = 1400
const MAX_MESSAGE_CHARS = 360

export interface ConversationMemory {
  summary: string
  state: string | null
  messageCount: number
  lastUserMessage: string | null
  lastAssistantMessage: string | null
  lastInteractionAt: string | null
}

export interface RegistrarTurnoParams {
  tenantId: string
  telefone: string
  userMessage?: string
  assistantMessage?: string
  state?: string
  metadata?: Record<string, unknown>
}

function compactarTexto(texto: string | undefined, max = MAX_MESSAGE_CHARS): string {
  if (!texto) return ''
  const normalizado = texto
    .replace(/\[[A-Z_]+(?::[^\]]*)?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (normalizado.length <= max) return normalizado
  return `${normalizado.slice(0, max - 1).trim()}…`
}

function compactarResumo(resumo: string): string {
  if (resumo.length <= MAX_MEMORY_CHARS) return resumo

  const linhas = resumo.split('\n').filter(Boolean)
  const mantidas: string[] = []
  let total = 0

  for (const linha of linhas.reverse()) {
    total += linha.length + 1
    if (total > MAX_MEMORY_CHARS) break
    mantidas.push(linha)
  }

  return mantidas.reverse().join('\n')
}

function linhaTurno(userMessage?: string, assistantMessage?: string, state?: string): string {
  const user = compactarTexto(userMessage, 220)
  const assistant = compactarTexto(assistantMessage, 260)
  const partes = [
    state ? `estado=${state}` : null,
    user ? `cliente: ${user}` : null,
    assistant ? `julmar: ${assistant}` : null,
  ].filter(Boolean)

  return partes.length > 0 ? `- ${partes.join(' | ')}` : ''
}

export const __conversationMemoryTestables = {
  compactarTexto,
  compactarResumo,
  linhaTurno,
  MAX_MEMORY_CHARS,
}

export async function obterMemoriaConversa(
  tenantId: string,
  telefone: string,
): Promise<ConversationMemory | null> {
  const supabase = criarClienteAdmin()
  const { data } = await supabase
    .from('whatsapp_conversation_memory')
    .select('summary, state, message_count, last_user_message, last_assistant_message, last_interaction_at')
    .eq('tenant_id', tenantId)
    .eq('telefone', telefone)
    .maybeSingle()

  if (!data) return null

  return {
    summary: String(data.summary ?? ''),
    state: (data.state as string | null) ?? null,
    messageCount: Number(data.message_count ?? 0),
    lastUserMessage: (data.last_user_message as string | null) ?? null,
    lastAssistantMessage: (data.last_assistant_message as string | null) ?? null,
    lastInteractionAt: (data.last_interaction_at as string | null) ?? null,
  }
}

export function memoriaParaPrompt(memoria: ConversationMemory | null): string {
  if (!memoria?.summary) return ''

  return [
    'MEMORIA COMPACTA DA CONVERSA:',
    memoria.state ? `Estado anterior: ${memoria.state}` : null,
    memoria.summary,
    'Usa isto para nao repetir perguntas nem saudacoes desnecessarias. Se a conversa mudou de assunto, adapta-te ao novo pedido.',
  ].filter(Boolean).join('\n')
}

export async function registrarTurnoConversa(params: RegistrarTurnoParams): Promise<void> {
  const supabase = criarClienteAdmin()
  const agora = new Date().toISOString()
  const userMessage = compactarTexto(params.userMessage)
  const assistantMessage = compactarTexto(params.assistantMessage)

  const logs = [
    userMessage
      ? {
          tenant_id: params.tenantId,
          telefone: params.telefone,
          direction: 'inbound',
          event_type: 'message',
          content: userMessage,
          metadata: params.metadata ?? {},
        }
      : null,
    assistantMessage
      ? {
          tenant_id: params.tenantId,
          telefone: params.telefone,
          direction: 'outbound',
          event_type: 'message',
          content: assistantMessage,
          metadata: params.metadata ?? {},
        }
      : null,
  ].filter(Boolean)

  if (logs.length > 0) {
    const { error } = await supabase.from('whatsapp_conversation_logs').insert(logs)
    if (error) console.warn('[Agente Julmar] Falha ao gravar log da conversa:', error.message)
  }

  const memoriaAtual = await obterMemoriaConversa(params.tenantId, params.telefone)
  const novaLinha = linhaTurno(userMessage, assistantMessage, params.state)
  const novoResumo = compactarResumo(
    [memoriaAtual?.summary ?? '', novaLinha].filter(Boolean).join('\n')
  )

  const { error } = await supabase
    .from('whatsapp_conversation_memory')
    .upsert(
      {
        tenant_id: params.tenantId,
        telefone: params.telefone,
        summary: novoResumo,
        state: params.state ?? memoriaAtual?.state ?? null,
        message_count: (memoriaAtual?.messageCount ?? 0) + (userMessage ? 1 : 0) + (assistantMessage ? 1 : 0),
        last_user_message: userMessage || memoriaAtual?.lastUserMessage || null,
        last_assistant_message: assistantMessage || memoriaAtual?.lastAssistantMessage || null,
        last_interaction_at: agora,
      },
      { onConflict: 'tenant_id,telefone' },
    )

  if (error) console.warn('[Agente Julmar] Falha ao actualizar memoria compacta:', error.message)
}
