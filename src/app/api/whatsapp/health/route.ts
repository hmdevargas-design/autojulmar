import { NextRequest, NextResponse } from 'next/server'
import { testarConexaoClaudeJulmar } from '@/lib/whatsapp/agente-julmar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type JsonRecord = Record<string, unknown>

function autorizado(request: NextRequest): boolean {
  const secrets = [
    process.env.WHATSAPP_OUTBOX_WORKER_SECRET,
    process.env.CRON_SECRET,
  ].filter(Boolean)
  if (secrets.length === 0) return false

  const auth = request.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : ''
  const headerSecret = request.headers.get('x-whatsapp-worker-secret') ?? ''
  return [bearer, headerSecret].some(valor => secrets.includes(valor))
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function listaDe(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const record = asRecord(value)
  if (!record) return []
  for (const key of ['data', 'errors', 'items', 'webhooks', 'messages']) {
    if (Array.isArray(record[key])) return record[key]
  }
  return []
}

function textoSeguro(value: unknown, max = 300): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return value
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[redacted-id]')
    .replace(/\b\d{11,15}\b/g, '[redacted-number]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

async function consultarUazapi(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: JsonRecord } = {},
): Promise<{
  ok: boolean
  status: number
  body: unknown
}> {
  const baseUrl = process.env.UAZAPI_URL?.replace(/\/$/, '')
  const token = process.env.UAZAPI_TOKEN
  if (!baseUrl || !token) throw new Error('UAZAPI_URL/UAZAPI_TOKEN nao configurados')

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      token,
      convert: 'true',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  const raw = await response.text()
  let body: unknown = raw
  try {
    body = raw ? JSON.parse(raw) : null
  } catch {
    body = textoSeguro(raw, 1000)
  }
  return { ok: response.ok, status: response.status, body }
}

function resumirMensagens(body: unknown): JsonRecord {
  const root = asRecord(body)
  const entradas = listaDe(body)
  return {
    topLevelKeys: root ? Object.keys(root).slice(0, 30) : [],
    count: entradas.length,
    recent: entradas.slice(0, 10).map(item => {
      const row = asRecord(item) ?? {}
      const message = asRecord(row.message) ?? row
      return {
        id: textoSeguro(message.messageid ?? message.messageId ?? message.id),
        timestamp: textoSeguro(
          message.messageTimestamp ?? message.timestamp ?? message.createdAt ?? message.created_at,
        ),
        fromMe: message.fromMe ?? null,
        wasSentByApi: message.wasSentByApi ?? null,
        type: textoSeguro(message.type),
        preview: textoSeguro(message.text ?? message.content ?? message.caption, 160),
      }
    }),
  }
}

function resumirInstancia(body: unknown): JsonRecord {
  const root = asRecord(body) ?? {}
  const instance = asRecord(root.instance) ?? root
  return {
    status: instance.status ?? instance.state ?? null,
    connected: instance.connected ?? null,
    number: textoSeguro(instance.phone ?? instance.number),
  }
}

function resumirWebhook(body: unknown): JsonRecord {
  const candidatos = listaDe(body)
  const config = asRecord(candidatos[0]) ?? asRecord(body) ?? {}
  return {
    id: textoSeguro(config.id),
    enabled: config.enabled ?? null,
    url: textoSeguro(config.url, 500),
    events: Array.isArray(config.events) ? config.events.map(String) : [],
    excludeMessages: Array.isArray(config.excludeMessages)
      ? config.excludeMessages.map(String)
      : [],
  }
}

function resumirErros(body: unknown): JsonRecord {
  const root = asRecord(body)
  const entradas = listaDe(body)
  return {
    topLevelKeys: root ? Object.keys(root).slice(0, 30) : [],
    count: entradas.length,
    recent: entradas.slice(0, 10).map(item => {
      const row = asRecord(item) ?? {}
      const response = asRecord(row.response) ?? {}
      return {
        createdAt: textoSeguro(row.createdAt ?? row.created_at ?? row.timestamp),
        method: textoSeguro(row.method),
        url: textoSeguro(row.url, 500),
        status: row.statusCode ?? row.status ?? response.status ?? null,
        error: textoSeguro(row.error ?? row.reason ?? response.error ?? response.statusText, 500),
      }
    }),
  }
}

async function testarWebhookPublico(url: unknown): Promise<JsonRecord> {
  const texto = typeof url === 'string' ? url : ''
  if (!texto) return { ok: false, skipped: 'url ausente' }

  const target = new URL(texto)
  const hostsPermitidos = new Set([
    'autojulmar.vercel.app',
    'autojulmar.pt',
    'www.autojulmar.pt',
  ])
  if (target.protocol !== 'https:' || !hostsPermitidos.has(target.hostname)) {
    return { ok: false, skipped: 'host nao permitido' }
  }

  const response = await fetch(target, {
    method: 'GET',
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  })
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type'),
  }
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const numeroTeste = (process.env.WHATSAPP_NUMEROS_TESTE ?? '')
      .split(/[\s,;]+/)
      .map(numero => numero.replace(/\D/g, ''))
      .find(Boolean)

    const [statusResult, webhookResult, errorsResult, messageResult] = await Promise.all([
      consultarUazapi('/instance/status'),
      consultarUazapi('/webhook'),
      consultarUazapi('/errors'),
      numeroTeste
        ? consultarUazapi('/message/find', {
            method: 'POST',
            body: { chatid: `${numeroTeste}@s.whatsapp.net`, limit: 10 },
          })
        : Promise.resolve({ ok: false, status: 0, body: null }),
    ])
    const webhook = resumirWebhook(webhookResult.body)
    const publicTarget = await testarWebhookPublico(webhook.url)

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      uazapi: {
        instanceRequest: { ok: statusResult.ok, status: statusResult.status },
        instance: resumirInstancia(statusResult.body),
        webhookRequest: { ok: webhookResult.ok, status: webhookResult.status },
        webhook,
        errorsRequest: { ok: errorsResult.ok, status: errorsResult.status },
        errors: resumirErros(errorsResult.body),
        messageLookupRequest: { ok: messageResult.ok, status: messageResult.status },
        messagesForTestNumber: resumirMensagens(messageResult.body),
      },
      publicTarget,
      safety: {
        agentEnabled: process.env.WHATSAPP_AGENT_ENABLED === 'true',
        sendEnabled: process.env.WHATSAPP_SEND_ENABLED === 'true',
        outboxEnabled: process.env.WHATSAPP_OUTBOX_ENABLED !== 'false',
        workerEnabled: process.env.WHATSAPP_OUTBOX_WORKER_ENABLED === 'true',
        dryRun: process.env.WHATSAPP_OUTBOX_DRY_RUN !== 'false',
        observerMode: process.env.WHATSAPP_OBSERVER_MODE === 'true',
        testNumbersConfigured: Boolean(process.env.WHATSAPP_NUMEROS_TESTE?.trim()),
      },
      models: {
        primaryProvider: 'anthropic',
        primaryModel: process.env.WHATSAPP_ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
        openaiFallbackConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
        openaiFallbackModel:
          process.env.WHATSAPP_OPENAI_FALLBACK_MODEL ?? 'gpt-5.6-luna',
      },
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.get('probe') === 'anthropic') {
    if (!autorizado(request)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
    try {
      const result = await testarConexaoClaudeJulmar()
      return NextResponse.json({
        ok: true,
        checkedAt: new Date().toISOString(),
        probe: result,
        sendsMessages: false,
        writesSession: false,
      })
    } catch (error) {
      return NextResponse.json({
        ok: false,
        checkedAt: new Date().toISOString(),
        probe: { provider: 'anthropic' },
        error: error instanceof Error ? error.message.slice(0, 500) : String(error),
        sendsMessages: false,
        writesSession: false,
      }, { status: 502 })
    }
  }
  return GET(request)
}
