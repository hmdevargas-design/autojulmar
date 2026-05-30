import { NextRequest, NextResponse } from 'next/server'
import { processarComAgenteJulmar, pausarAgenteJulmar } from '@/lib/whatsapp/agente-julmar'
import { enviarMensagem }                from '@/lib/whatsapp/sender'
import { registarAtendimento }           from '@/lib/whatsapp/log-atendimento'
import { criarClienteAdmin }             from '@/lib/supabase/admin'
import { transcreverAudio }              from '@/lib/whatsapp/transcricao'
import { resolverTenant }                from '@/lib/tenant/resolver'

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

function agenteWhatsappAtivo(): boolean {
  return process.env.WHATSAPP_AGENT_ENABLED === 'true'
    && process.env.WHATSAPP_OUTBOX_READY === 'true'
}

export async function GET() {
  return NextResponse.json({ ok: true, servico: 'uazapi' })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as PayloadUazapi

    console.log('[WhatsApp] Webhook — EventType:', payload.EventType, '| fromMe:', payload.message?.fromMe)

    if (payload.EventType !== 'messages') return NextResponse.json({ ok: true })

    if (!agenteWhatsappAtivo()) {
      console.warn('[WhatsApp] Agente bloqueado por flags de seguranca')
      return NextResponse.json({ ok: true, paused: true })
    }

    const msg = payload.message

    if (msg.isGroup === true) return NextResponse.json({ ok: true })

    // Takeover: admin enviou mensagem manual (fromMe=true, nao via API)
    // Pausa o bot para o cliente desse chat
    if (msg.fromMe === true) {
      if (msg.wasSentByApi === false && msg.type === 'text') {
        const chatJid    = msg.chatid ?? ''
        const clienteTel = chatJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
        if (clienteTel && !eAdmin(clienteTel)) {
          const tenantSlug = process.env.WHATSAPP_TENANT_SLUG
          if (tenantSlug) {
            const tenant = await resolverTenant(tenantSlug)
            if (tenant) {
              await pausarAgenteJulmar(tenant.id, clienteTel)
              console.log('[WhatsApp] Takeover — bot pausado para:', clienteTel)
            }
          }
        }
      }
      return NextResponse.json({ ok: true })
    }

    // Extrai numero real: sender_pn tem o formato @s.whatsapp.net mesmo quando sender e @lid
    const senderRaw = msg.sender ?? ''
    const telefone  = (msg.sender_pn ?? senderRaw)
      .replace('@s.whatsapp.net', '')
      .replace('@c.us', '')
      .replace('@lid', '')
      .replace(/\D/g, '')

    // Modo de teste: so responde a numeros autorizados quando WHATSAPP_NUMEROS_TESTE esta definido
    const numerosTeste = (process.env.WHATSAPP_NUMEROS_TESTE ?? '')
      .split(',').map(n => n.trim().replace(/\D/g, '')).filter(Boolean)
    if (numerosTeste.length > 0 && !numerosTeste.some(n => telefone.endsWith(n))) {
      console.log('[WhatsApp] Modo teste — numero ignorado:', telefone)
      return NextResponse.json({ ok: true })
    }

    // Audio (ptt / audio / AudioMessage) — aceita de todos os utilizadores
    // uazapi envia type="ptt"|"audio" ou type="media" com mediaType="ptt"/"audio"
    const tipoAudio = msg.type === 'ptt' || msg.type === 'audio'
      || msg.mediaType === 'ptt' || msg.mediaType === 'audio'
      || msg.messageType === 'AudioMessage'
      || (msg.type === 'media' && (msg.mediaType === 'ptt' || msg.mediaType === 'audio'))

    if (tipoAudio) {
      // Dedup por messageId
      const audioDedupKey = `audio:${msg.messageid ?? msg.messageId ?? ''}`
      if (audioDedupKey !== 'audio:') {
        const supabaseDedup = criarClienteAdmin()
        const { error: errDedup } = await supabaseDedup.from('msg_dedup').insert({ hash: audioDedupKey })
        if (errDedup?.code === '23505') {
          console.log('[WhatsApp] Dedup audio — ignorado:', telefone)
          return NextResponse.json({ ok: true })
        }
      }

      const mimeType   = msg.mimetype ?? (msg.content?.mimetype as string | undefined)
      const messageId  = msg.messageid ?? msg.messageId
      const chatId     = msg.chatid ?? msg.sender_pn ?? msg.sender
      const mediaUrl   = (msg.mediaUrl ?? msg.content?.URL) as string | undefined
      const mediaKey   = (msg.content?.mediaKey ?? msg.content?.MediaKey) as string | undefined
      const fileSha256 = (msg.content?.fileSha256 ?? msg.content?.FileSHA256 ?? msg.content?.fileEncSha256) as string | undefined
      const fileLength = (msg.content?.fileLength ?? msg.content?.FileLength) as number | undefined

      console.log('[WhatsApp] Audio detectado — telefone:', telefone, 'messageId:', messageId, 'chatId:', chatId, 'mime:', mimeType, 'type:', msg.type, 'mediaType:', msg.mediaType)
      console.log('[WhatsApp] Audio campos media — mediaUrl:', mediaUrl ?? '(vazio)', '| mediaKey:', mediaKey ? '[presente]' : '(vazio)', '| content keys:', Object.keys(msg.content ?? {}).join(', '))

      const transcricao = await transcreverAudio({ messageId, chatId, mimetype: mimeType, mediaUrl, mediaKey, fileSha256, fileLength })

      if (!transcricao) {
        console.warn('[WhatsApp] Transcricao falhou para:', telefone)
        await enviarMensagem(telefone, 'Nao consegui perceber o audio. Pode enviar em texto?')
        return NextResponse.json({ ok: true })
      }

      console.log('[WhatsApp] Audio transcrito:', telefone, '|', transcricao)
      if (!eAdmin(telefone)) {
        registarAtendimento(telefone, msg.senderName).catch(e =>
          console.warn('[WhatsApp] Falha ao registar atendimento (audio):', String(e))
        )
      }
      await enviarMensagem(telefone, `🎙️ _${transcricao}_`)
      await processarComAgenteJulmar(telefone, transcricao)
      return NextResponse.json({ ok: true })
    }

    // Texto
    if (msg.type !== 'text' || !msg.text?.trim()) {
      return NextResponse.json({ ok: true })
    }

    // Dedup atomico — uazapi envia messageId ou messageid conforme o evento
    const chaveDedup = msg.messageId ?? msg.messageid
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

    if (!eAdmin(telefone)) {
      registarAtendimento(telefone, msg.senderName).catch(e =>
        console.warn('[WhatsApp] Falha ao registar atendimento:', String(e))
      )
    }

    try {
      await processarComAgenteJulmar(telefone, msg.text.trim())
    } catch (err) {
      console.error('[WhatsApp] Erro:', String(err))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[WhatsApp] Erro no webhook:', err)
    return NextResponse.json({ ok: true })
  }
}
