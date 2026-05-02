// Transcricao de audio via Groq/OpenAI Whisper
// Estratégia (por ordem):
//   1. POST /message/download-media com URL + MediaKey (uazapi desencripta)
//   2. GET /message/download-media?messageId=...&chatId=...
//   3. GET /chat/download-media?messageId=...&chatId=...
//   4. URL directa do webhook (mmg.whatsapp.net — encriptada, último recurso)

interface OptsTranscricao {
  messageId?:  string
  chatId?:     string
  mimetype?:   string
  mediaUrl?:   string   // URL encriptada do CDN WhatsApp
  mediaKey?:   string   // Chave de desencriptação (base64) do webhook
  fileSha256?: string   // Hash SHA256 do ficheiro
  fileLength?: number   // Tamanho do ficheiro em bytes
}

async function descarregarBlob(url: string, headers?: Record<string, string>): Promise<{ blob: Blob; ok: boolean; status: number }> {
  const res = await fetch(url, { headers })
  const blob = res.ok ? await res.blob() : new Blob()
  return { blob, ok: res.ok, status: res.status }
}

async function tentarDownloadUazapi(
  uazapiUrl: string,
  token: string,
  opts: OptsTranscricao,
): Promise<Blob | null> {
  const { messageId, chatId, mediaUrl, mediaKey, fileSha256, fileLength, mimetype } = opts

  type Endpoint = { method: 'GET' | 'POST'; url: string; body?: Record<string, unknown> }
  const endpoints: Endpoint[] = []

  // Tentativa 1: POST com chaves de desencriptação (método correcto uazapi v2)
  if (mediaUrl && mediaKey) {
    endpoints.push({
      method: 'POST',
      url:    `${uazapiUrl}/message/download-media`,
      body:   {
        Url:        mediaUrl,
        MediaKey:   mediaKey,
        Mimetype:   mimetype ?? 'audio/ogg; codecs=opus',
        ...(fileSha256 ? { FileSHA256: fileSha256 } : {}),
        ...(fileLength ? { FileLength: fileLength } : {}),
      },
    })
  }

  // Tentativas 2 e 3: GET com messageId/chatId (fallback)
  if (messageId && chatId) {
    endpoints.push(
      { method: 'GET', url: `${uazapiUrl}/message/download-media?${new URLSearchParams({ messageId, chatId })}` },
      { method: 'GET', url: `${uazapiUrl}/chat/download-media?${new URLSearchParams({ messageId, chatId })}` },
    )
  }

  for (const ep of endpoints) {
    try {
      const fetchOpts: RequestInit = {
        method:  ep.method,
        headers: ep.method === 'POST'
          ? { token, 'Content-Type': 'application/json' }
          : { token },
        ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
      }
      const res = await fetch(ep.url, fetchOpts)
      const contentType = res.headers.get('content-type') ?? ''
      const label = ep.body ? `${ep.method} /message/download-media (com MediaKey)` : `${ep.method} ${ep.url.replace(uazapiUrl, '')}`
      console.log('[Transcricao] Tentativa', label, '→ status:', res.status, 'ct:', contentType)

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
  const apiKey      = process.env.GROQ_API_KEY ?? process.env.OPENAI_API_KEY
  const isGroq      = !!process.env.GROQ_API_KEY
  const uazapiUrl   = process.env.UAZAPI_URL
  const uazapiToken = process.env.UAZAPI_TOKEN

  if (!apiKey) { console.warn('[Transcricao] GROQ_API_KEY (ou OPENAI_API_KEY) nao configurada'); return null }

  console.log('[Transcricao] Inicio — messageId:', opts.messageId, 'chatId:', opts.chatId, 'mime:', opts.mimetype)

  let audioBlob: Blob | null = null

  // 1. Endpoint uazapi (desencripta o ficheiro) — tentado primeiro
  if (uazapiUrl && uazapiToken) {
    audioBlob = await tentarDownloadUazapi(uazapiUrl, uazapiToken, opts)
  } else {
    console.warn('[Transcricao] Credenciais uazapi nao configuradas — a saltar para URL directa')
  }

  // 2. URL directa do webhook (ficheiro encriptado — último recurso)
  if (!audioBlob && opts.mediaUrl) {
    console.warn('[Transcricao] Todos os endpoints uazapi falharam — a tentar URL directa (pode estar encriptada):', opts.mediaUrl)
    const { blob, ok, status } = await descarregarBlob(opts.mediaUrl)
    console.log('[Transcricao] URL directa — status:', status, 'size:', blob.size)
    if (ok && blob.size > 0) audioBlob = blob
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
  form.append('model', isGroq ? 'whisper-large-v3' : 'whisper-1')
  form.append('language', 'pt')

  const whisperUrl = isGroq
    ? 'https://api.groq.com/openai/v1/audio/transcriptions'
    : 'https://api.openai.com/v1/audio/transcriptions'

  console.log('[Transcricao] A enviar para', isGroq ? 'Groq' : 'OpenAI', '— ext:', ext, 'size:', audioBlob.size)

  try {
    const res = await fetch(whisperUrl, {
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
