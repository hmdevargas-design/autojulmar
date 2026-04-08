import { NextRequest, NextResponse } from 'next/server'

// GET /api/matricula?matricula=XX-00-XX
// Chama regcheck.org.uk (matricula.co.pt) e devolve { viatura, ano }
// Se MATRICULA_USERNAME não estiver configurado, devolve null silenciosamente

// Extrai o conteúdo de uma tag XML simples: <Tag>valor</Tag>
function extrairTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))
  return match?.[1]?.trim() ?? ''
}

// Extrai CurrentTextValue dentro de um bloco: <Tag>...<CurrentTextValue>valor</CurrentTextValue>...</Tag>
function extrairTexto(xml: string, bloco: string): string {
  const blocoMatch = xml.match(new RegExp(`<${bloco}[^>]*>([\\s\\S]*?)</${bloco}>`))
  if (!blocoMatch) return ''
  return extrairTag(blocoMatch[1], 'CurrentTextValue')
}

export async function GET(request: NextRequest) {
  const matricula = request.nextUrl.searchParams
    .get('matricula')
    ?.replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()

  if (!matricula || matricula.length < 6) {
    return NextResponse.json({ erro: 'Matrícula inválida' }, { status: 400 })
  }

  const username = process.env.MATRICULA_USERNAME
  if (!username) {
    // Não configurado — devolve null sem bloquear o formulário
    return NextResponse.json(null)
  }

  try {
    const url = `https://www.regcheck.org.uk/api/reg.asmx/CheckPortugal?RegistrationNumber=${encodeURIComponent(matricula)}&username=${encodeURIComponent(username)}`

    const res = await fetch(url, {
      headers: { Accept: 'text/xml' },
      signal: AbortSignal.timeout(6000),
    })

    if (!res.ok) return NextResponse.json(null)

    const xml = await res.text()

    const marca       = extrairTexto(xml, 'CarMake') || extrairTag(xml, 'MakeDescription')
    const modelo      = extrairTag(xml, 'CarModel')
    const ano         = extrairTag(xml, 'RegistrationYear') || extrairTag(xml, 'ManufactureYearFrom')
    const combustivel = extrairTexto(xml, 'FuelType')

    const viatura = [marca, modelo].filter(Boolean).join(' ')
    if (!viatura) return NextResponse.json(null)

    return NextResponse.json({ viatura, ano, combustivel })
  } catch {
    // Timeout ou erro de rede — não bloqueia o formulário
    return NextResponse.json(null)
  }
}
