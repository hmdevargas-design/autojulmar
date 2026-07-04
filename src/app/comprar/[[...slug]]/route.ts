import { existsSync, readFileSync } from 'fs'
import { join, normalize, sep } from 'path'
import { NextResponse } from 'next/server'

type RouteContext = {
  params: Promise<{
    slug?: string[]
  }>
}

function resolvePublicFile(slug: string[]) {
  const publicComprar = join(process.cwd(), 'public', 'comprar')
  const filePath =
    slug.length === 1 && slug[0] === 'catalogo.js'
      ? join(publicComprar, 'catalogo.js')
      : join(publicComprar, ...slug, 'index.html')

  const safePath = normalize(filePath)
  const safeBase = normalize(publicComprar + sep)

  if (!safePath.startsWith(safeBase)) {
    return null
  }

  return safePath
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug = [] } = await context.params
  const filePath = resolvePublicFile(slug)

  if (!filePath || !existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const isScript = filePath.endsWith('.js')
  const body = readFileSync(filePath, 'utf-8')

  return new NextResponse(body, {
    headers: {
      'Content-Type': isScript
        ? 'application/javascript; charset=utf-8'
        : 'text/html; charset=utf-8',
    },
  })
}
