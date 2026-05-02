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

  const cap = caption ?? ''

  // Testa variações de endpoint + nome do campo de número
  const combos = [
    { path: '/send/image', numField: 'phone',  fileField: 'image' },
    { path: '/send/image', numField: 'number', fileField: 'image' },
    { path: '/send/image', numField: 'phone',  fileField: 'file'  },
    { path: '/send/media', numField: 'phone',  fileField: 'file'  },
    { path: '/send/media', numField: 'number', fileField: 'file'  },
  ]

  for (const c of combos) {
    const form = new FormData()
    form.append(c.numField,  para)
    form.append(c.fileField, blob, 'image.jpg')
    if (cap) form.append('caption', cap)

    const res = await fetch(`${baseUrl}${c.path}`, { method: 'POST', headers: { token }, body: form })
    const txt = await res.text()
    console.log('[WhatsApp] enviarImagem', c.path, `${c.numField}+${c.fileField}`, '→', res.status, txt.slice(0, 80))
    if (res.ok) return
    if (res.status !== 400 && res.status !== 404 && res.status !== 405 && res.status !== 500) break
  }
  console.error('[WhatsApp] Todas as tentativas falharam para', para)
}
