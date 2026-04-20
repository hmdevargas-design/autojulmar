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
    console.warn('[Transcricao] messageId ou chatId em falta')
    return null
  }

  try {
    // Descarrega o audio desencriptado via uazapi
    const downloadRes = await fetch(`${uazapiUrl}/message/download-media`, {
      method:  'POST',
      headers: { token: uazapiToken, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messageId: opts.messageId, chatId: opts.chatId }),
    })

    if (!downloadRes.ok) {
      const err = await downloadRes.text()
      console.error('[Transcricao] Falha no download uazapi:', downloadRes.status, err)
      return null
    }

    const contentType = downloadRes.headers.get('content-type') ?? ''
    let audioBlob: Blob

    if (contentType.includes('application/json')) {
      // Alguns endpoints retornam JSON com campo base64 ou url
      const json = await downloadRes.json() as { base64?: string; url?: string; data?: string }

      if (json.base64 ?? json.data) {
        const b64  = (json.base64 ?? json.data)!
        const bin  = Buffer.from(b64, 'base64')
        audioBlob  = new Blob([bin], { type: opts.mimetype ?? 'audio/ogg' })
      } else if (json.url) {
        const r2 = await fetch(json.url)
        if (!r2.ok) { console.error('[Transcricao] Falha ao descarregar URL do JSON'); return null }
        audioBlob = await r2.blob()
      } else {
        console.error('[Transcricao] JSON sem base64 nem url:', JSON.stringify(json))
        return null
      }
    } else {
      audioBlob = await downloadRes.blob()
    }

    const ext = (opts.mimetype?.includes('ogg') || opts.mimetype?.includes('opus')) ? 'ogg'
              : opts.mimetype?.includes('mp4')  ? 'mp4'
              : opts.mimetype?.includes('mpeg') ? 'mp3'
              : 'ogg'

    const form = new FormData()
    form.append('file', audioBlob, `audio.${ext}`)
    form.append('model', 'whisper-1')
    form.append('language', 'pt')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body:    form,
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[Transcricao] Erro Whisper:', err)
      return null
    }

    const data = await res.json() as { text?: string }
    return data.text?.trim() ?? null

  } catch (err) {
    console.error('[Transcricao] Excecao:', String(err))
    return null
  }
}
