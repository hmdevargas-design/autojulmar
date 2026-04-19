import { NextRequest, NextResponse } from 'next/server'
import { processarComAgente } from '@/lib/whatsapp/agente'
import { enviarMensagem }     from '@/lib/whatsapp/sender'
import { criarClienteAdmin }  from '@/lib/supabase/admin'
import { transcreverAudio }   from '@/lib/whatsapp/transcricao'

interface MensagemUazapi {
  fromMe:       boolean
  isGroup:      boolean
  sender:       string
  senderName:   string
  text:         string
  type:         string       // "text" | "ptt" | "audio" | "image" | ...
  wasSentByApi: boolean
  messageId?:   string
  mediaUrl?:    string       // URL do ficheiro de audio/imagem
  mimetype?:    string       // ex: "audio/ogg; codecs=opus"
  caption?:     string       // legenda (audio com texto)
  phone?:       string       // numero real (quando sender e @lid)
  number?:      string
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

    // Quando o sender e @lid, tenta extrair o numero real de campos alternativos
    const senderRaw = msg.sender ?? ''
    const isLid     = senderRaw.includes('@lid')
    if (isLid) {
      console.log('[WhatsApp] Sender @lid detectado — payload completo:', JSON.stringify(payload))
    }

    const telefone = (msg.phone ?? msg.number ?? senderRaw)
      .replace('@s.whatsapp.net', '')
      .replace('@c.us', '')
      .replace('@lid', '')
      .replace(/\D/g, '')

    // Audio — so aceita de admins; tenta transcrever
    const tipoAudio = msg.type === 'ptt' || msg.type === 'audio'
    if (tipoAudio) {
      if (!eAdmin(telefone)) {
        await enviarMensagem(telefone, 'Por favor envie a mensagem em texto.')
        return NextResponse.json({ ok: true })
      }

      if (!msg.mediaUrl) {
        await enviarMensagem(telefone, 'Nao consegui aceder ao audio. Pode escrever o pedido em texto?')
        return NextResponse.json({ ok: true })
      }

      const transcricao = await transcreverAudio(msg.mediaUrl, msg.mimetype)
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
