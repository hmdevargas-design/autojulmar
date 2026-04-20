import { NextRequest, NextResponse } from 'next/server'
import { processarComAgente } from '@/lib/whatsapp/agente'
import { enviarMensagem }     from '@/lib/whatsapp/sender'
import { criarClienteAdmin }  from '@/lib/supabase/admin'
import { transcreverAudio }   from '@/lib/whatsapp/transcricao'

interface MensagemUazapi {
  fromMe:       boolean
  isGroup:      boolean
  sender:       string
  sender_pn?:   string       // numero real em formato @s.whatsapp.net (quando sender e @lid)
  senderName:   string
  text:         string
  type:         string       // "text" | "media" | "ptt" | "audio" | ...
  mediaType?:   string       // "ptt" | "audio" | "image" | ... (quando type="media")
  messageType?: string       // "AudioMessage" | "ImageMessage" | ...
  wasSentByApi: boolean
  messageId?:   string
  messageid?:   string       // ID da mensagem (uazapi lowercase)
  chatid?:      string       // JID do chat (ex: 351916958780@s.whatsapp.net)
  mediaUrl?:    string
  content?:     { URL?: string; mimetype?: string; [key: string]: unknown }
  mimetype?:    string
  caption?:     string
  [key: string]: unknown
}

interface PayloadUazapi {
  EventType: string
  message:   MensagemUazapi
  owner:     string
  [key: string]: unknown
}

function numerosAdmin(): string[] {
  return (process.env.WHATSAPP_ADMIN_NUMEROS ?? '')
    .split(',')
    .map(n => n.trim().replace(/\D/g, ''))
    .filter(Boolean)
}

function eAdmin(telefone: string): boolean {
  const t = telefone.replace(/\D/g, '')
  const owner = (process.env.WHATSAPP_NUMERO_HUMANO ?? '').replace(/\D/g, '')
  if (owner && t.endsWith(owner)) return true
  return numerosAdmin().some(n => t.endsWith(n))
}

export async function GET() {
  return NextResponse.json({ ok: true, servico: 'uazapi' })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as PayloadUazapi

    console.log('[WhatsApp] Webhook — EventType:', payload.EventType, '| fromMe:', payload.message?.fromMe)

    if (payload.EventType !== 'messages') return NextResponse.json({ ok: true })

    const msg = payload.message

    if (msg.fromMe === true)  return NextResponse.json({ ok: true })
    if (msg.isGroup === true) return NextResponse.json({ ok: true })

    // Extrai numero real: sender_pn tem o formato @s.whatsapp.net mesmo quando sender e @lid
    const senderRaw = msg.sender ?? ''
    const telefone  = (msg.sender_pn ?? senderRaw)
      .replace('@s.whatsapp.net', '')
      .replace('@c.us', '')
      .replace('@lid', '')
      .replace(/\D/g, '')

    // Audio — so aceita de admins; tenta transcrever
    // uazapi envia type="media" com mediaType="ptt"/"audio" ou messageType="AudioMessage"
    const tipoAudio = msg.type === 'ptt' || msg.type === 'audio'
      || msg.mediaType === 'ptt' || msg.mediaType === 'audio'
      || msg.messageType === 'AudioMessage'

    if (tipoAudio) {
      // Dedup para audio (usa messageid)
      const audioDedupKey = `audio:${msg.messageid ?? msg.messageId ?? ''}`
      if (audioDedupKey !== 'audio:') {
        const supabaseDedup = criarClienteAdmin()
        const { error: errDedup } = await supabaseDedup.from('msg_dedup').insert({ hash: audioDedupKey })
        if (errDedup?.code === '23505') {
          console.log('[WhatsApp] Dedup audio — ignorado:', telefone)
          return NextResponse.json({ ok: true })
        }
      }

      if (!eAdmin(telefone)) {
        await enviarMensagem(telefone, 'Por favor envie a mensagem em texto.')
        return NextResponse.json({ ok: true })
      }

      const mimeType = msg.mimetype ?? (msg.content?.mimetype as string | undefined)
      const messageId = msg.messageid ?? msg.messageId
      const chatId    = msg.chatid ?? (msg.sender_pn ?? msg.sender)

      const transcricao = await transcreverAudio({ messageId, chatId, mimetype: mimeType })
      if (!transcricao) {
        await enviarMensagem(telefone, 'Nao consegui transcrever o audio. Pode escrever o pedido em texto?')
        return NextResponse.json({ ok: true })
      }

      console.log('[WhatsApp] Audio transcrito:', telefone, '|', transcricao)
      await processarComAgente(telefone, transcricao)
      return NextResponse.json({ ok: true })
    }

    // Texto
    if (msg.type !== 'text' || !msg.text?.trim()) {
      return NextResponse.json({ ok: true })
    }

    // Dedup atomico
    const chaveDedup = msg.messageId
      ?? `${telefone}:${msg.text.trim()}:${Math.floor(Date.now() / 10_000)}`

    const supabase = criarClienteAdmin()
    const { error: errDedup } = await supabase
      .from('msg_dedup')
      .insert({ hash: chaveDedup })

    if (errDedup) {
      if (errDedup.code === '23505') {
        console.log('[WhatsApp] Dedup — ignorado:', telefone)
        return NextResponse.json({ ok: true })
      }
      console.warn('[WhatsApp] Dedup falhou (continuando):', errDedup.message)
    }

    supabase.from('msg_dedup')
      .delete()
      .lt('criado_em', new Date(Date.now() - 60_000).toISOString())
      .then(() => { /* fire-and-forget */ })

    console.log('[WhatsApp] A processar:', telefone, '|', msg.text.trim())

    try {
      await processarComAgente(telefone, msg.text.trim())
    } catch (err) {
      console.error('[WhatsApp] Erro:', String(err))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[WhatsApp] Erro no webhook:', err)
    return NextResponse.json({ ok: true })
  }
}
