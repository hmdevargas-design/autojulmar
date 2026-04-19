import { NextRequest, NextResponse } from 'next/server'
import { processarComAgente } from '@/lib/whatsapp/agente'
import { criarClienteAdmin } from '@/lib/supabase/admin'

// Payload confirmado via logs reais do uazapi (2026-04-18)
interface MensagemUazapi {
  fromMe:      boolean
  isGroup:     boolean
  sender:      string    // "351916958780@s.whatsapp.net"
  senderName:  string
  text:        string
  type:        string    // "text" | "image" | ...
  wasSentByApi: boolean
  messageId?:  string    // ID único da mensagem (se disponível)
}

interface PayloadUazapi {
  EventType: string
  message:   MensagemUazapi
  owner:     string
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

    console.log('[WhatsApp] Webhook recebido — EventType:', payload.EventType, '| fromMe:', payload.message?.fromMe)

    if (payload.EventType !== 'messages') {
      return NextResponse.json({ ok: true })
    }

    const msg = payload.message

    if (msg.fromMe === true)  return NextResponse.json({ ok: true })
    if (msg.isGroup === true) return NextResponse.json({ ok: true })

    if (msg.type !== 'text' || !msg.text?.trim()) {
      return NextResponse.json({ ok: true })
    }

    const telefone = msg.sender
      .replace('@s.whatsapp.net', '')
      .replace('@c.us', '')

    // Chave de dedup: prefere messageId único; fallback para sender+texto+janela de 10s
    const chaveDedup = msg.messageId
      ?? `${telefone}:${msg.text.trim()}:${Math.floor(Date.now() / 10_000)}`

    // Dedup atómico via Supabase — funciona em múltiplas instâncias Vercel
    const supabase = criarClienteAdmin()
    const { error: errDedup } = await supabase
      .from('msg_dedup')
      .insert({ hash: chaveDedup })

    if (errDedup) {
      // Código 23505 = unique_violation (duplicado); outros erros deixam passar para não silenciar mensagens
      if (errDedup.code === '23505') {
        console.log('[WhatsApp] Dedup — duplicado ignorado:', telefone)
        return NextResponse.json({ ok: true })
      }
      console.warn('[WhatsApp] Dedup falhou (continuando):', errDedup.message)
    }

    // Limpa registos com mais de 60s para não crescer indefinidamente
    supabase
      .from('msg_dedup')
      .delete()
      .lt('criado_em', new Date(Date.now() - 60_000).toISOString())
      .then(() => {/* fire-and-forget */})

    console.log('[WhatsApp] A processar:', telefone, '|', msg.text.trim())

    try {
      await processarComAgente(telefone, msg.text.trim())
    } catch (err) {
      console.error('[WhatsApp] Erro ao processar mensagem:', String(err))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[WhatsApp] Erro no webhook:', err)
    return NextResponse.json({ ok: true })
  }
}
