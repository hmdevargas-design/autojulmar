export interface ModelMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ModelUsage {
  inputTokens?: number
  outputTokens?: number
}

export interface ModelCallResult {
  text: string
  provider: 'anthropic' | 'openai' | 'deterministic'
  model: string
  fallbackUsed: boolean
  usage?: ModelUsage
}

interface OpenAIResponse {
  model?: string
  output_text?: string
  output?: Array<{
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
  error?: {
    message?: string
  }
}

function erroParaTexto(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function erroDisponibilidadeProvedor(error: unknown): boolean {
  const texto = erroParaTexto(error).toLowerCase()
  return [
    'rate_limit',
    'rate limit',
    'credit balance',
    'billing',
    'insufficient_quota',
    'overloaded',
    'timeout',
    'timed out',
    'connection',
    'fetch failed',
    '429',
    '500',
    '502',
    '503',
    '504',
    '529',
  ].some(token => texto.includes(token))
}

export function extrairTextoRespostaOpenAI(response: OpenAIResponse): string {
  if (response.output_text?.trim()) return response.output_text.trim()

  const text = response.output
    ?.flatMap(item => item.content ?? [])
    .filter(item => item.type === 'output_text' && item.text)
    .map(item => item.text?.trim())
    .filter(Boolean)
    .join('\n')
    .trim()

  if (!text) throw new Error('OpenAI fallback retornou resposta sem texto')
  return text
}

export async function chamarOpenAIFallback(
  system: string,
  messages: ModelMessage[],
): Promise<ModelCallResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY nao configurada para fallback')

  const model = process.env.WHATSAPP_OPENAI_FALLBACK_MODEL ?? 'gpt-5.6-luna'
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions: system,
      input: messages,
      reasoning: { effort: 'none' },
      text: { verbosity: 'low' },
      max_output_tokens: 500,
      store: false,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  const body = await response.json().catch(() => ({})) as OpenAIResponse
  if (!response.ok) {
    throw new Error(
      `OpenAI fallback ${response.status}: ${body.error?.message ?? 'erro desconhecido'}`,
    )
  }

  return {
    text: extrairTextoRespostaOpenAI(body),
    provider: 'openai',
    model: body.model ?? model,
    fallbackUsed: true,
    usage: {
      inputTokens: body.usage?.input_tokens,
      outputTokens: body.usage?.output_tokens,
    },
  }
}
