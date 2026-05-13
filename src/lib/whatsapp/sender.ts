// Envia mensagens de texto e imagens via uazapi

export async function enviarMensagemComMencoes(
  para: string,
  texto: string,
  mencoes: string[]   // números no formato 351XXXXXXXXX (sem @)
): Promise<void> {
  const baseUrl = process.env.UAZAPI_URL
  const token   = process.env.UAZAPI_TOKEN

  if (!baseUrl || !token) {
    console.warn('[WhatsApp] Credenciais uazapi não configuradas — mensagem não enviada')
    return
  }

  // uazapi aceita mentionedList como array de JIDs s.whatsapp.net
  const mentionedList = mencoes.map(n => `${n}@s.whatsapp.net`)

  const res = await fetch(`${baseUrl}/send/text`, {
    method: 'POST',
    headers: { token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: para, text: texto, mentionedList }),
  })

  if (!res.ok) {
    const erro = await res.text()
    console.error('[WhatsApp] Erro ao enviar mensagem com menções:', res.status, erro)
    // fallback: envia sem menções
    await enviarMensagem(para, texto)
  } else {
    console.log('[WhatsApp] Mensagem com menções enviada para:', para)
  }
}

export async function enviarMensagem(para: string, texto: string): Promise<void> {
  const baseUrl = process.env.UAZAPI_URL
  const token   = process.env.UAZAPI_TOKEN

  console.log('[WhatsApp] enviarMensagem → baseUrl:', baseUrl ?? '(não definido)', '| para:', para)

  if (!baseUrl || !token) {
    console.warn('[WhatsApp] Credenciais uazapi não configuradas — mensagem não enviada')
    return
  }

  const url = `${baseUrl}/send/text`
  console.log('[WhatsApp] POST', url)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'token':        token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ number: para, text: texto }),
  })

  if (!res.ok) {
    const erro = await res.text()
    console.error('[WhatsApp] Erro ao enviar mensagem — status:', res.status, '| body:', erro)
    throw new Error(`uazapi ${res.status}: ${erro}`)
  }

  console.log('[WhatsApp] Mensagem enviada com sucesso para:', para)
}

export async function enviarImagem(para: string, imageUrl: string, caption?: string): Promise<void> {
  const baseUrl = process.env.UAZAPI_URL
  const token   = process.env.UAZAPI_TOKEN

  if (!baseUrl || !token) {
    console.warn('[WhatsApp] Credenciais uazapi não configuradas — imagem não enviada')
    return
  }

  // /send/media espera multipart com campo "file" — descarregar e reenviar
  let blob: Blob
  try {
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) { console.error('[WhatsApp] Falha download imagem:', imgRes.status, imageUrl); return }
    blob = await imgRes.blob()
  } catch (err) {
    console.error('[WhatsApp] Erro download imagem:', String(err)); return
  }

  // /send/media espera JSON com campo "file" em base64
  const b64  = blob.arrayBuffer().then(buf => Buffer.from(buf).toString('base64'))
  const mime = blob.type || 'image/jpeg'
  const file = `data:${mime};base64,${await b64}`

  const res = await fetch(`${baseUrl}/send/media`, {
    method:  'POST',
    headers: { token, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ number: para, type: 'image', file, caption: caption ?? '' }),
  })

  if (!res.ok) {
    const erro = await res.text()
    console.error('[WhatsApp] Erro ao enviar imagem:', erro)
  }
}
