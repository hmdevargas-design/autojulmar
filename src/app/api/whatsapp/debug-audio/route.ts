// Endpoint de diagnostico — mostra exactamente o que uazapi devolve para download-media
// Uso: POST /api/whatsapp/debug-audio  body: { messageId, chatId }
// Protegido por token simples (env DEBUG_TOKEN)

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-debug-token')
  if (!token || token !== (process.env.DEBUG_TOKEN ?? 'debug-autojulmar')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messageId, chatId } = await request.json() as { messageId?: string; chatId?: string }

  const uazapiUrl   = process.env.UAZAPI_URL
  const uazapiToken = process.env.UAZAPI_TOKEN

  if (!uazapiUrl || !uazapiToken) {
    return NextResponse.json({ error: 'Credenciais uazapi nao configuradas' }, { status: 500 })
  }

  if (!messageId || !chatId) {
    return NextResponse.json({ error: 'messageId e chatId sao obrigatorios' }, { status: 400 })
  }

  try {
    const res = await fetch(`${uazapiUrl}/message/download-media`, {
      method:  'POST',
      headers: { token: uazapiToken, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messageId, chatId }),
    })

    const status      = res.status
    const contentType = res.headers.get('content-type') ?? ''
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => { headers[k] = v })

    if (contentType.includes('application/json')) {
      const json = await res.json()
      // Não devolve base64 completo para não encher a resposta
      const resumo = { ...json }
      if (typeof resumo.base64 === 'string')    resumo.base64    = `[base64 ${resumo.base64.length} chars]`
      if (typeof resumo.data === 'string')      resumo.data      = `[base64 ${resumo.data.length} chars]`
      if (typeof resumo.fileBase64 === 'string') resumo.fileBase64 = `[base64 ${resumo.fileBase64.length} chars]`
      if (typeof resumo.content === 'string')   resumo.content   = `[base64 ${resumo.content.length} chars]`
      return NextResponse.json({ status, contentType, headers, body: resumo })
    } else {
      const blob = await res.blob()
      return NextResponse.json({ status, contentType, headers, bodySize: blob.size, bodyType: blob.type })
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
