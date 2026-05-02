// Envia mensagens de texto e imagens via uazapi

export async function enviarMensagem(para: string, texto: string): Promise<void> {
  const baseUrl = process.env.UAZAPI_URL
  const token   = process.env.UAZAPI_TOKEN

  if (!baseUrl || !token) {
    console.warn('[WhatsApp] Credenciais uazapi não configuradas — mensagem não enviada')
    return
  }

  const res = await fetch(`${baseUrl}/send/text`, {
    method: 'POST',
    headers: {
      'token':        token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ number: para, text: texto }),
  })

  if (!res.ok) {
    const erro = await res.text()
    console.error('[WhatsApp] Erro ao enviar mensagem:', erro)
  }
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

  const form = new FormData()
  form.append('file', blob, 'image.jpg')
  if (caption) form.append('caption', caption)

  // number como query param — o parser Go pode ter dificuldade com campos texto + ficheiro no mesmo multipart
  const qs  = new URLSearchParams({ number: para })
  const res = await fetch(`${baseUrl}/send/media?${qs}`, { method: 'POST', headers: { token }, body: form })

  if (!res.ok) {
    const erro = await res.text()
    console.error('[WhatsApp] Erro ao enviar imagem:', erro)
  }
}
