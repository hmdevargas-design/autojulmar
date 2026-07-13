import { NextRequest, NextResponse } from 'next/server'
import { simularRespostaAgenteJulmar } from '@/lib/whatsapp/agente-julmar'
import {
  obterNivelServicoAgenteJulmar,
  validarAmbienteDryRunPrimario,
} from '@/lib/whatsapp/service-level'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function segredoValido(request: NextRequest): boolean {
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

export async function POST(request: NextRequest) {
  if (!segredoValido(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (obterNivelServicoAgenteJulmar() !== 'primary') {
    return NextResponse.json(
      { ok: false, safetyBlocked: true, error: 'service level deve ser primary' },
      { status: 409 },
    )
  }

  const body = await request.json().catch(() => null) as {
    telefone?: string
    mensagem?: string
    freshConversation?: boolean
  } | null
  const telefone = (body?.telefone ?? '').replace(/\D/g, '')
  const mensagem = (body?.mensagem ?? '').trim()
  if (!telefone || !mensagem || mensagem.length > 1000) {
    return NextResponse.json(
      { ok: false, error: 'telefone e mensagem valida (maximo 1000 caracteres) sao obrigatorios' },
      { status: 400 },
    )
  }

  const erroAmbiente = validarAmbienteDryRunPrimario(process.env, telefone)
  if (erroAmbiente) {
    return NextResponse.json(
      { ok: false, safetyBlocked: true, error: erroAmbiente },
      { status: 409 },
    )
  }

  try {
    const freshConversation = body?.freshConversation === true
    const simulacao = await simularRespostaAgenteJulmar(
      telefone,
      mensagem,
      { freshConversation },
    )
    return NextResponse.json({
      ok: true,
      dryRun: true,
      forcedRole: 'cliente',
      freshConversation,
      sendsMessages: false,
      writesSession: false,
      ...simulacao,
    })
  } catch (error) {
    console.error('[Agente Julmar Dry Run] erro:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
