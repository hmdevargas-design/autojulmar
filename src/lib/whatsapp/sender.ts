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

  const headers = { token, 'Content-Type': 'application/json' }
  const cap     = caption ?? ''

  // Tenta variações de endpoint/body até encontrar o correcto
  const tentativas = [
    { url: `${baseUrl}/send/image`,      body: { number: para, url:      imageUrl, caption: cap } },
    { url: `${baseUrl}/send/image`,      body: { number: para, imageUrl: imageUrl, caption: cap } },
    { url: `${baseUrl}/send/media`,      body: { number: para, url:      imageUrl, caption: cap, type: 'image' } },
    { url: `${baseUrl}/message/image`,   body: { number: para, url:      imageUrl, caption: cap } },
  ]

  for (const t of tentativas) {
    const res = await fetch(t.url, { method: 'POST', headers, body: JSON.stringify(t.body) })
    const ct  = res.headers.get('content-type') ?? ''
    const txt = await res.text()
    console.log('[WhatsApp] enviarImagem', t.url.replace(baseUrl, ''), JSON.stringify(Object.keys(t.body)), '→', res.status, txt.slice(0, 120))
    if (res.ok) return
    if (res.status !== 404 && res.status !== 405) break  // erro inesperado — parar
  }
}
