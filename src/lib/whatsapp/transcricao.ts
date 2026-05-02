// Transcricao de audio via OpenAI Whisper
// Estratégia (por ordem):
//   1. URL directa no payload do webhook (mediaUrl / content.URL)
//   2. GET /message/download-media?messageId=...&chatId=...
//   3. GET /chat/download-media?messageId=...&chatId=...
//   4. POST /message/download-media  (body JSON)

interface OptsTranscricao {
  messageId?: string
  chatId?:    string
  mimetype?:  string
  mediaUrl?:  string   // URL directa do webhook, evita chamar uazapi
}

async function descarregarBlob(url: string, headers?: Record<string, string>): Promise<{ blob: Blob; ok: boolean; status: number }> {
  const res = await fetch(url, { headers })
  const blob = res.ok ? await res.blob() : new Blob()
  return { blob, ok: res.ok, status: res.status }
}

async function tentarDownloadUazapi(
  uazapiUrl: string,
  token: string,
  messageId: string,
  chatId: string,
): Promise<Blob | null> {
  const endpoints = [
    // Tentativa 1: GET com query params
    { method: 'GET' as const, url: `${uazapiUrl}/message/download-media?${new URLSearchParams({ messageId, chatId })}` },
    // Tentativa 2: GET caminho alternativo
    { method: 'GET' as const, url: `${uazapiUrl}/chat/download-media?${new URLSearchParams({ messageId, chatId })}` },
    // Tentativa 3: POST com body JSON
    { method: 'POST' as const, url: `${uazapiUrl}/message/download-media` },
  ]

  for (const ep of endpoints) {
    try {
      const opts: RequestInit = {
        method:  ep.method,
        headers: ep.method === 'POST'
          ? { token, 'Content-Type': 'application/json' }
          : { token },
        ...(ep.method === 'POST' ? { body: JSON.stringify({ messageId, chatId }) } : {}),
      }
      const res = await fetch(ep.url, opts)
      const contentType = res.headers.get('content-type') ?? ''
      console.log('[Transcricao] Tentativa', ep.method, ep.url.replace(uazapiUrl, ''), '→ status:', res.status, 'ct:', contentType)

      if (!res.ok) continue

      if (contentType.includes('application/json')) {
        const rawText = await res.text()
        console.log('[Transcricao] JSON (primeiros 200 chars):', rawText.slice(0, 200))
        let json: Record<string, unknown>
        try { json = JSON.parse(rawText) } catch { continue }

        const b64 = (json.base64 ?? json.data ?? json.fileBase64 ?? json.content) as string | undefined
        if (b64) {
          const bin = Buffer.from(b64, 'base64')
          console.log('[Transcricao] Audio via base64 — bytes:', bin.length)
          return new Blob([bin])
        }
        const urlField = (json.url ?? json.mediaUrl ?? json.fileUrl) as string | undefined
        if (urlField) {
          console.log('[Transcricao] Audio via URL do JSON:', urlField)
          const { blob, ok } = await descarregarBlob(urlField)
          if (ok && blob.size > 0) return blob
        }
        console.warn('[Transcricao] JSON sem campo de audio reconhecido. Chaves:', Object.keys(json).join(', '))
        continue
      }

      const blob = await res.blob()
      if (blob.size > 0) {
        console.log('[Transcricao] Audio binario — bytes:', blob.size)
        return blob
      }
    } catch (err) {
      console.warn('[Transcricao] Erro na tentativa:', String(err))
    }
  }
  return null
}

export async function transcreverAudio(opts: OptsTranscricao): Promise<string | null> {
  const apiKey      = process.env.OPENAI_API_KEY
  const uazapiUrl   = process.env.UAZAPI_URL
  const uazapiToken = process.env.UAZAPI_TOKEN

  if (!apiKey) { console.warn('[Transcricao] OPENAI_API_KEY nao configurada'); return null }

  console.log('[Transcricao] Inicio — messageId:', opts.messageId, 'mediaUrl:', opts.mediaUrl ?? '(vazio)', 'mime:', opts.mimetype)

  let audioBlob: Blob | null = null

  // 1. URL directa do webhook
  if (opts.mediaUrl) {
    console.log('[Transcricao] A usar URL directa do webhook:', opts.mediaUrl)
    const { blob, ok, status } = await descarregarBlob(opts.mediaUrl)
    console.log('[Transcricao] URL directa — status:', status, 'size:', blob.size)
    if (ok && blob.size > 0) audioBlob = blob
  }

  // 2. Fallback: endpoint uazapi
  if (!audioBlob) {
    if (!uazapiUrl || !uazapiToken) {
      console.warn('[Transcricao] Credenciais uazapi nao configuradas e sem URL directa')
      return null
    }
    if (!opts.messageId || !opts.chatId) {
      console.warn('[Transcricao] messageId/chatId em falta e sem URL directa')
      return null
    }
    audioBlob = await tentarDownloadUazapi(uazapiUrl, uazapiToken, opts.messageId, opts.chatId)
  }

  if (!audioBlob || audioBlob.size === 0) {
    console.error('[Transcricao] Nao foi possivel obter o audio por nenhum metodo')
    return null
  }

  const ext = (opts.mimetype?.includes('ogg') || opts.mimetype?.includes('opus')) ? 'ogg'
            : opts.mimetype?.includes('mp4')  ? 'mp4'
            : opts.mimetype?.includes('mpeg') ? 'mp3'
            : opts.mimetype?.includes('wav')  ? 'wav'
            : opts.mimetype?.includes('webm') ? 'webm'
            : 'ogg'

  const form = new FormData()
  form.append('file', audioBlob, `audio.${ext}`)
  form.append('model', 'whisper-1')
  form.append('language', 'pt')

  console.log('[Transcricao] A enviar para Whisper — ext:', ext, 'size:', audioBlob.size)

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body:    form,
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[Transcricao] Erro Whisper:', res.status, err)
      return null
    }
    const data = await res.json() as { text?: string }
    const texto = data.text?.trim() ?? null
    console.log('[Transcricao] Sucesso:', texto?.slice(0, 80))
    return texto
  } catch (err) {
    console.error('[Transcricao] Excecao Whisper:', String(err))
    return null
  }
}
