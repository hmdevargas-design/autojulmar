// Transcricao de audio via OpenAI Whisper
// Descarrega o audio pelo endpoint uazapi (ficheiro ja desencriptado)

interface OptsTranscricao {
  messageId?: string
  chatId?:    string
  mimetype?:  string
}

export async function transcreverAudio(opts: OptsTranscricao): Promise<string | null> {
  const apiKey      = process.env.OPENAI_API_KEY
  const uazapiUrl   = process.env.UAZAPI_URL
  const uazapiToken = process.env.UAZAPI_TOKEN

  if (!apiKey) {
    console.warn('[Transcricao] OPENAI_API_KEY nao configurada')
    return null
  }
  if (!uazapiUrl || !uazapiToken) {
    console.warn('[Transcricao] Credenciais uazapi nao configuradas')
    return null
  }
  if (!opts.messageId || !opts.chatId) {
    console.warn('[Transcricao] messageId ou chatId em falta — messageId:', opts.messageId, 'chatId:', opts.chatId)
    return null
  }

  try {
    console.log('[Transcricao] A descarregar audio — messageId:', opts.messageId, 'chatId:', opts.chatId, 'mime:', opts.mimetype)

    const params = new URLSearchParams({ messageId: opts.messageId, chatId: opts.chatId })
    const downloadRes = await fetch(`${uazapiUrl}/message/download-media?${params}`, {
      method:  'GET',
      headers: { token: uazapiToken },
    })

    const status      = downloadRes.status
    const contentType = downloadRes.headers.get('content-type') ?? ''
    console.log('[Transcricao] uazapi resposta — status:', status, 'content-type:', contentType)

    if (!downloadRes.ok) {
      const errBody = await downloadRes.text()
      console.error('[Transcricao] Falha no download uazapi:', status, errBody)
      return null
    }

    let audioBlob: Blob

    if (contentType.includes('application/json')) {
      const rawText = await downloadRes.text()
      console.log('[Transcricao] JSON uazapi (primeiros 300 chars):', rawText.slice(0, 300))

      let json: Record<string, unknown>
      try { json = JSON.parse(rawText) } catch { console.error('[Transcricao] JSON invalido'); return null }

      // Tenta varios campos onde uazapi pode colocar os dados
      const b64 = (json.base64 ?? json.data ?? json.fileBase64 ?? json.content) as string | undefined
      const url = (json.url ?? json.mediaUrl ?? json.fileUrl) as string | undefined

      if (b64) {
        const bin = Buffer.from(b64, 'base64')
        audioBlob = new Blob([bin], { type: opts.mimetype ?? 'audio/ogg' })
        console.log('[Transcricao] Audio via base64 — bytes:', bin.length)
      } else if (url) {
        console.log('[Transcricao] Audio via URL:', url)
        const r2 = await fetch(url)
        if (!r2.ok) {
          console.error('[Transcricao] Falha ao descarregar URL:', r2.status)
          return null
        }
        audioBlob = await r2.blob()
        console.log('[Transcricao] Audio via URL — size:', audioBlob.size)
      } else {
        console.error('[Transcricao] JSON sem campo de audio reconhecido. Chaves:', Object.keys(json).join(', '))
        return null
      }
    } else {
      // Resposta binaria directa
      audioBlob = await downloadRes.blob()
      console.log('[Transcricao] Audio binario — size:', audioBlob.size, 'type:', audioBlob.type)
      if (audioBlob.size === 0) {
        console.error('[Transcricao] Audio vazio')
        return null
      }
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
    console.error('[Transcricao] Excecao:', String(err))
    return null
  }
}
