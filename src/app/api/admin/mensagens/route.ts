import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { carregarMensagemPedidoPronto, guardarMensagemPedidoPronto } from '@/lib/tenant/mensagens'
import { CHAVE_MENSAGEM_PEDIDO_PRONTO } from '@/core/messages/templates'

const schema = z.object({
  tenantId: z.string().min(1),
  chave: z.literal(CHAVE_MENSAGEM_PEDIDO_PRONTO),
  corpo: z.string().max(1000),
})

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId')
    if (!tenantId) {
      return NextResponse.json({ erro: 'tenantId obrigatório' }, { status: 400 })
    }

    const mensagem = await carregarMensagemPedidoPronto(tenantId)
    return NextResponse.json({ mensagens: [mensagem] })
  } catch (error) {
    console.error('[Admin mensagens] Erro ao carregar:', error)
    return NextResponse.json({ erro: 'Erro ao carregar mensagens' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const input = schema.parse(await request.json())
    const mensagem = await guardarMensagemPedidoPronto(input.tenantId, input.corpo)
    return NextResponse.json({ mensagem })
  } catch (error) {
    console.error('[Admin mensagens] Erro ao guardar:', error)
    return NextResponse.json({ erro: 'Erro ao guardar mensagem' }, { status: 500 })
  }
}
