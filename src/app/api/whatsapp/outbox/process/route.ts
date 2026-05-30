import { NextRequest, NextResponse } from 'next/server'
import {
  cancelarMensagem,
  claimProximasMensagens,
  envioRealPermitidoParaNumero,
  limitePorExecucao,
  marcarEnviada,
  marcarFalha,
  outboxDryRunAtivo,
  workerAtivo,
  type WhatsappOutboxItem,
} from '@/lib/whatsapp/outbox'
import {
  dispatchImagemAgora,
  dispatchMensagemAgora,
  dispatchMensagemComMencoesAgora,
} from '@/lib/whatsapp/sender'

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
  const querySecret = request.nextUrl.searchParams.get('secret') ?? ''

  return [bearer, headerSecret, querySecret].some(valor => secrets.includes(valor))
}

async function processarItem(item: WhatsappOutboxItem, dryRun: boolean): Promise<'sent' | 'dry-run' | 'blocked'> {
  if (dryRun) {
    await marcarEnviada(item.id, 'dry-run: mensagem validada sem envio pela UAZAPI')
    return 'dry-run'
  }

  if (process.env.WHATSAPP_SEND_ENABLED !== 'true') {
    throw new Error('WHATSAPP_SEND_ENABLED != true; envio real bloqueado')
  }

  if (!envioRealPermitidoParaNumero(item.to_number)) {
    await cancelarMensagem(
      item.id,
      'envio real bloqueado: numero fora de WHATSAPP_NUMEROS_TESTE',
    )
    return 'blocked'
  }

  if (item.message_type === 'text') {
    await dispatchMensagemAgora(item.to_number, String(item.payload.text ?? ''))
  } else if (item.message_type === 'image') {
    await dispatchImagemAgora(
      item.to_number,
      String(item.payload.imageUrl ?? ''),
      String(item.payload.caption ?? ''),
    )
  } else if (item.message_type === 'mentions') {
    const mentions = Array.isArray(item.payload.mentions)
      ? item.payload.mentions.map(String)
      : []
    await dispatchMensagemComMencoesAgora(item.to_number, String(item.payload.text ?? ''), mentions)
  } else {
    throw new Error(`Tipo de mensagem nao suportado: ${item.message_type}`)
  }

  await marcarEnviada(item.id)
  return 'sent'
}

export async function GET(request: NextRequest) {
  if (!segredoValido(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  if (!workerAtivo()) {
    return NextResponse.json({ ok: true, disabled: true })
  }

  const dryRun = outboxDryRunAtivo()
  if (!dryRun && process.env.WHATSAPP_SEND_ENABLED !== 'true') {
    return NextResponse.json(
      { ok: false, safetyBlocked: true, error: 'WHATSAPP_SEND_ENABLED != true' },
      { status: 409 },
    )
  }

  const max = limitePorExecucao()
  const claimed = await claimProximasMensagens(max)
  const results: Array<{ id: string; status: string; error?: string }> = []

  for (const item of claimed) {
    try {
      const status = await processarItem(item, dryRun)
      results.push({ id: item.id, status })
    } catch (err) {
      await marcarFalha(item, err)
      results.push({
        id: item.id,
        status: item.attempts >= item.max_attempts ? 'failed' : 'retry',
        error: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    claimed: claimed.length,
    max,
    results,
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
