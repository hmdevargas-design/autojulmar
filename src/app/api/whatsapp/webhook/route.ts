import { NextRequest, NextResponse } from 'next/server'
import { processarMensagem } from '@/lib/whatsapp/conversa'

// Payload que o uazapi envia para este webhook (evento "messages")
interface PayloadUazapi {
  event:   string           // "messages"
  fromMe:  boolean          // true = enviada pelo próprio número
  number?: string           // remetente: "351912345678"
  from?:   string           // alternativa: "351912345678@c.us"
  body?:   string           // texto da mensagem
  text?:   string           // alternativa ao body
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

    // Debug: log do payload completo nas primeiras mensagens
    if (process.env.WHATSAPP_DEBUG === '1') {
      console.log('[WhatsApp] Payload uazapi:', JSON.stringify(payload, null, 2))
    }

    // Só processa evento de mensagens recebidas
    if (payload.event !== 'messages') {
      return NextResponse.json({ ok: true })
    }

    // Ignorar mensagens enviadas pelo próprio número (evita loops)
    if (payload.fromMe === true) {
      return NextResponse.json({ ok: true })
    }

    // Extrair número — normaliza removendo sufixo do WhatsApp se presente
    const telefone = (payload.number ?? payload.from ?? '')
      .replace('@c.us', '')
      .replace('@s.whatsapp.net', '')

    // Extrair texto
    const texto = payload.body ?? payload.text ?? ''

    if (!telefone || !texto.trim()) {
      return NextResponse.json({ ok: true })
    }

    // Processa em background — responde imediatamente ao uazapi
    processarMensagem(telefone, texto).catch(err =>
      console.error('[WhatsApp] Erro ao processar mensagem:', err)
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[WhatsApp] Erro no webhook:', err)
    return NextResponse.json({ ok: true }) // sempre 200 para o uazapi não reenviar
  }
}
