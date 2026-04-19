import { NextRequest, NextResponse } from 'next/server'
import { processarMensagem } from '@/lib/whatsapp/conversa'

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

// Cache de deduplicação — evita processar o mesmo webhook duas vezes
// O uazapi envia duplicados em janelas de ~200ms; esta cache protege dentro da mesma instância
const dedupCache = new Map<string, number>()
const DEDUP_TTL_MS = 30_000

function isDuplicado(chave: string): boolean {
  const ultimo = dedupCache.get(chave)
  const agora  = Date.now()
  if (ultimo && agora - ultimo < DEDUP_TTL_MS) return true
  dedupCache.set(chave, agora)
  // Limpeza periódica para não crescer indefinidamente
  if (dedupCache.size > 200) {
    const corte = agora - DEDUP_TTL_MS
    for (const [k, v] of dedupCache) {
      if (v < corte) dedupCache.delete(k)
    }
  }
  return false
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

    if (isDuplicado(chaveDedup)) {
      console.log('[WhatsApp] Dedup — ignorando duplicado:', telefone)
      return NextResponse.json({ ok: true })
    }

    console.log('[WhatsApp] A processar:', telefone, '|', msg.text.trim())

    try {
      await processarMensagem(telefone, msg.text.trim())
    } catch (err) {
      console.error('[WhatsApp] Erro ao processar mensagem:', String(err))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[WhatsApp] Erro no webhook:', err)
    return NextResponse.json({ ok: true })
  }
}
