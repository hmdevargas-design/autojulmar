// Transcricao de audio via OpenAI Whisper
// Necessita de OPENAI_API_KEY nas variaveis de ambiente

export async function transcreverAudio(mediaUrl: string, mimetype?: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[Transcricao] OPENAI_API_KEY nao configurada — audio nao suportado')
    return null
  }

  try {
    // Descarrega o audio
    const audioRes = await fetch(mediaUrl)
    if (!audioRes.ok) {
      console.error('[Transcricao] Falha ao descarregar audio:', audioRes.status)
      return null
    }

    const audioBlob = await audioRes.blob()
    const ext       = mimetype?.includes('ogg') ? 'ogg'
                    : mimetype?.includes('mp4') ? 'mp4'
                    : mimetype?.includes('mpeg') ? 'mp3'
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
