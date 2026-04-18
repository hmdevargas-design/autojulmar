import { NextRequest, NextResponse } from 'next/server'
import { processarMensagem } from '@/lib/whatsapp/conversa'

// Payload confirmado via logs reais do uazapi (2026-04-18)
interface MensagemUazapi {
  fromMe:      boolean  // true = enviada pelo próprio número
  isGroup:     boolean
  sender:      string   // "351916958780@s.whatsapp.net"
  senderName:  string
  text:        string   // conteúdo da mensagem
  type:        string   // "text" | "image" | ...
  wasSentByApi: boolean
}

interface PayloadUazapi {
  EventType: string          // "messages"
  message:   MensagemUazapi
  owner:     string          // número do dono da instância
  [key: string]: unknown
}

// GET — health check
export async function GET() {
  return NextResponse.json({ ok: true, servico: 'uazapi' })
}

// POST — recebe eventos do uazapi
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as PayloadUazapi

    // Só processa evento de mensagens
    if (payload.EventType !== 'messages') {
      return NextResponse.json({ ok: true })
    }

    const msg = payload.message

    // Ignorar mensagens enviadas pelo próprio número (evita loops)
    if (msg.fromMe === true) {
      return NextResponse.json({ ok: true })
    }

    // Ignorar grupos
    if (msg.isGroup === true) {
      return NextResponse.json({ ok: true })
    }

    // Só processar mensagens de texto
    if (msg.type !== 'text' || !msg.text?.trim()) {
      return NextResponse.json({ ok: true })
    }

    // Normalizar número — remover sufixo WhatsApp
    const telefone = msg.sender
      .replace('@s.whatsapp.net', '')
      .replace('@c.us', '')

    // Processa em background — responde imediatamente ao uazapi
    processarMensagem(telefone, msg.text.trim()).catch(err =>
      console.error('[WhatsApp] Erro ao processar mensagem:', err)
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[WhatsApp] Erro no webhook:', err)
    return NextResponse.json({ ok: true }) // sempre 200 para o uazapi não reenviar
  }
}
