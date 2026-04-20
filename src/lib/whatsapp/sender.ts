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

  const res = await fetch(`${baseUrl}/send/image`, {
    method: 'POST',
    headers: {
      'token':        token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ number: para, image: imageUrl, caption: caption ?? '' }),
  })

  if (!res.ok) {
    const erro = await res.text()
    console.error('[WhatsApp] Erro ao enviar imagem:', erro)
  }
}
