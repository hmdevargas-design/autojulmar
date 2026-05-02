// Transcricao de audio via Groq/OpenAI Whisper
// Estratégia:
//   1. Descarrega URL encriptada do CDN WhatsApp
//   2. Desencripta com mediaKey (AES-256-CBC via HKDF — esquema WhatsApp)
//   3. Envia audio desencriptado para Groq/OpenAI Whisper

import { hkdfSync, createDecipheriv } from 'crypto'

interface OptsTranscricao {
  messageId?:  string
  chatId?:     string
  mimetype?:   string
  mediaUrl?:   string   // URL encriptada do CDN WhatsApp
  mediaKey?:   string   // Chave de desencriptação (base64) do webhook
  fileSha256?: string
  fileLength?: number
}

// Desencriptação WhatsApp: HKDF(mediaKey) → AES-256-CBC
function desencriptarWhatsAppAudio(encBuffer: Buffer, mediaKeyBase64: string): Buffer {
  const mediaKey = Buffer.from(mediaKeyBase64, 'base64')
  const derived  = Buffer.from(
    hkdfSync('sha256', mediaKey, Buffer.alloc(0), Buffer.from('WhatsApp Audio Keys'), 112)
  )
  const iv         = derived.subarray(0, 16)
  const cipherKey  = derived.subarray(16, 48)
  const ciphertext = encBuffer.subarray(0, encBuffer.length - 10) // remove MAC (últimos 10 bytes)
  const decipher   = createDecipheriv('aes-256-cbc', cipherKey, iv)
  decipher.setAutoPadding(true)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export async function transcreverAudio(opts: OptsTranscricao): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY ?? process.env.OPENAI_API_KEY
  const isGroq = !!process.env.GROQ_API_KEY

  if (!apiKey) { console.warn('[Transcricao] GROQ_API_KEY (ou OPENAI_API_KEY) nao configurada'); return null }

  console.log('[Transcricao] Inicio — messageId:', opts.messageId, 'mediaKey:', opts.mediaKey ? '[presente]' : '(vazio)', 'mime:', opts.mimetype)

  if (!opts.mediaUrl) {
    console.warn('[Transcricao] mediaUrl em falta — nao ha URL para descarregar')
    return null
  }

  // 1. Descarregar ficheiro encriptado
  const res = await fetch(opts.mediaUrl)
  console.log('[Transcricao] Download — status:', res.status, 'ct:', res.headers.get('content-type'))
  if (!res.ok) {
    console.error('[Transcricao] Falha no download:', res.status)
    return null
  }
  const encBuffer = Buffer.from(await res.arrayBuffer())
  console.log('[Transcricao] Encriptado — bytes:', encBuffer.length)

  // 2. Desencriptar com mediaKey
  let audioBuffer: Buffer
  if (opts.mediaKey) {
    try {
      audioBuffer = desencriptarWhatsAppAudio(encBuffer, opts.mediaKey)
      console.log('[Transcricao] Desencriptado — bytes:', audioBuffer.length)
    } catch (err) {
      console.error('[Transcricao] Erro na desencriptacao:', String(err))
      return null
    }
  } else {
    console.warn('[Transcricao] mediaKey ausente — a tentar sem desencriptacao (provavel falha)')
    audioBuffer = encBuffer
  }

  // 3. Determinar extensão pelo mimetype
  const ext = (opts.mimetype?.includes('ogg') || opts.mimetype?.includes('opus')) ? 'ogg'
            : opts.mimetype?.includes('mp4')   ? 'mp4'
            : opts.mimetype?.includes('mpeg')  ? 'mp3'
            : opts.mimetype?.includes('wav')   ? 'wav'
            : opts.mimetype?.includes('webm')  ? 'webm'
            : 'ogg'

  // 4. Enviar para Groq/OpenAI Whisper
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(audioBuffer)]), `audio.${ext}`)
  form.append('model', isGroq ? 'whisper-large-v3' : 'whisper-1')
  form.append('language', 'pt')

  const whisperUrl = isGroq
    ? 'https://api.groq.com/openai/v1/audio/transcriptions'
    : 'https://api.openai.com/v1/audio/transcriptions'

  console.log('[Transcricao] A enviar para', isGroq ? 'Groq' : 'OpenAI', '— ext:', ext, 'size:', audioBuffer.length)

  try {
    const whisperRes = await fetch(whisperUrl, {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body:    form,
    })
    if (!whisperRes.ok) {
      const err = await whisperRes.text()
      console.error('[Transcricao] Erro Whisper:', whisperRes.status, err)
      return null
    }
    const data  = await whisperRes.json() as { text?: string }
    const texto = data.text?.trim() ?? null
    console.log('[Transcricao] Sucesso:', texto?.slice(0, 80))
    return texto
  } catch (err) {
    console.error('[Transcricao] Excecao Whisper:', String(err))
    return null
  }
}
