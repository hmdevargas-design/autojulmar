import { NextRequest, NextResponse } from 'next/server'
import { processarMensagem } from '@/lib/whatsapp/conversa'

// GET — verificação do webhook pelo Meta
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ erro: 'Token inválido' }, { status: 403 })
}

// POST — recebe mensagens do WhatsApp
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Estrutura do payload da Meta Cloud API
    const entry   = body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value   = changes?.value

    // Ignora eventos que não sejam mensagens (ex: status de entrega)
    if (!value?.messages?.length) {
      return NextResponse.json({ ok: true })
    }

    const mensagem = value.messages[0]

    // Só processa mensagens de texto
    if (mensagem.type !== 'text') {
      return NextResponse.json({ ok: true })
    }

    const telefone = mensagem.from          // número do remetente (ex: 351912345678)
    const texto    = mensagem.text?.body ?? ''

    if (!texto.trim()) return NextResponse.json({ ok: true })

    // Processa em background para responder imediatamente ao Meta (evita timeout)
    processarMensagem(telefone, texto).catch(err =>
      console.error('[WhatsApp] Erro ao processar mensagem:', err)
    )

    // Meta exige resposta 200 em menos de 20s
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[WhatsApp] Erro no webhook:', err)
    return NextResponse.json({ ok: true }) // sempre 200 para o Meta não reenviar
  }
}
