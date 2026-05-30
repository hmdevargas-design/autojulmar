// Enfileira mensagens WhatsApp por defeito. O envio real pela UAZAPI deve
// acontecer apenas no worker da outbox.

import {
  enfileirarImagem,
  enfileirarMensagemComMencoes,
  enfileirarMensagemTexto,
  outboxAtiva,
  type WhatsappOutboxOptions,
} from './outbox'

function envioWhatsappAtivo(): boolean {
  return process.env.WHATSAPP_SEND_ENABLED === 'true'
}

function credenciaisUazapi(): { baseUrl: string; token: string } | null {
  const baseUrl = process.env.UAZAPI_URL
  const token = process.env.UAZAPI_TOKEN

  if (!baseUrl || !token) {
    console.warn('[WhatsApp] Credenciais uazapi nao configuradas - mensagem nao enviada')
    return null
  }

  return { baseUrl, token }
}

export async function enviarMensagemComMencoes(
  para: string,
  texto: string,
  mencoes: string[],
  options?: WhatsappOutboxOptions,
): Promise<void> {
  if (outboxAtiva()) {
    await enfileirarMensagemComMencoes(para, texto, mencoes, options)
    return
  }

  await dispatchMensagemComMencoesAgora(para, texto, mencoes)
}

export async function enviarMensagem(
  para: string,
  texto: string,
  options?: WhatsappOutboxOptions,
): Promise<void> {
  if (outboxAtiva()) {
    await enfileirarMensagemTexto(para, texto, options)
    return
  }

  await dispatchMensagemAgora(para, texto)
}

export async function enviarImagem(
  para: string,
  imageUrl: string,
  caption?: string,
  options?: WhatsappOutboxOptions,
): Promise<void> {
  if (outboxAtiva()) {
    await enfileirarImagem(para, imageUrl, caption, options)
    return
  }

  await dispatchImagemAgora(para, imageUrl, caption)
}

export async function dispatchMensagemComMencoesAgora(
  para: string,
  texto: string,
  mencoes: string[],
): Promise<void> {
  if (!envioWhatsappAtivo()) {
    console.warn('[WhatsApp] Envio bloqueado por WHATSAPP_SEND_ENABLED != true')
    return
  }

  const config = credenciaisUazapi()
  if (!config) return

  const mentionedList = mencoes.map(n => `${n.replace(/\D/g, '')}@s.whatsapp.net`)

  const res = await fetch(`${config.baseUrl}/send/text`, {
    method: 'POST',
    headers: { token: config.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: para, text: texto, mentionedList }),
  })

  if (!res.ok) {
    const erro = await res.text()
    console.error('[WhatsApp] Erro ao enviar mensagem com mencoes:', res.status, erro)
    await dispatchMensagemAgora(para, texto)
    return
  }

  console.log('[WhatsApp] Mensagem com mencoes enviada para:', para)
}

export async function dispatchMensagemAgora(para: string, texto: string): Promise<void> {
  if (!envioWhatsappAtivo()) {
    console.warn('[WhatsApp] Envio bloqueado por WHATSAPP_SEND_ENABLED != true | para:', para)
    return
  }

  const config = credenciaisUazapi()
  if (!config) return

  const url = `${config.baseUrl}/send/text`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      token: config.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ number: para, text: texto }),
  })

  if (!res.ok) {
    const erro = await res.text()
    console.error('[WhatsApp] Erro ao enviar mensagem - status:', res.status, '| body:', erro)
    throw new Error(`uazapi ${res.status}: ${erro}`)
  }

  console.log('[WhatsApp] Mensagem enviada com sucesso para:', para)
}

export async function dispatchImagemAgora(
  para: string,
  imageUrl: string,
  caption?: string,
): Promise<void> {
  if (!envioWhatsappAtivo()) {
    console.warn('[WhatsApp] Envio de imagem bloqueado por WHATSAPP_SEND_ENABLED != true | para:', para)
    return
  }

  const config = credenciaisUazapi()
  if (!config) return

  let blob: Blob
  try {
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) {
      throw new Error(`download imagem ${imgRes.status}: ${imageUrl}`)
    }
    blob = await imgRes.blob()
  } catch (err) {
    console.error('[WhatsApp] Erro download imagem:', String(err))
    throw err
  }

  const buf = await blob.arrayBuffer()
  const mime = blob.type || 'image/jpeg'
  const file = `data:${mime};base64,${Buffer.from(buf).toString('base64')}`

  const res = await fetch(`${config.baseUrl}/send/media`, {
    method: 'POST',
    headers: { token: config.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: para, type: 'image', file, caption: caption ?? '' }),
  })

  if (!res.ok) {
    const erro = await res.text()
    console.error('[WhatsApp] Erro ao enviar imagem:', res.status, erro)
    throw new Error(`uazapi media ${res.status}: ${erro}`)
  }
}
