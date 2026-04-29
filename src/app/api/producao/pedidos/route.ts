import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  if (!tenantId) {
    return NextResponse.json({ erro: 'tenantId obrigatório' }, { status: 400 })
  }

  const supabase = criarClienteAdmin()

  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id, numero_pedido, estado_producao, dados, valor_final, sinal, forma_pagamento,
      clientes ( nome, contacto, tipos_cliente ( nome, desconto_pct ) )
    `)
    .eq('tenant_id', tenantId)
    .neq('estado_producao', 'entregue')
    .order('numero_pedido', { ascending: true })

  if (error) {
    console.error('[Producao] Erro ao buscar pedidos:', error)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
