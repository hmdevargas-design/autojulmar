import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'

function há7Dias() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  if (!tenantId) {
    return NextResponse.json({ erro: 'tenantId obrigatório' }, { status: 400 })
  }

  const supabase = criarClienteAdmin()

  // Pedidos activos (todos) + entregues dos últimos 7 dias
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id, numero_pedido, estado_producao, dados, valor_final, sinal, forma_pagamento,
      clientes ( nome, contacto, tipos_cliente ( nome, desconto_pct ) )
    `)
    .eq('tenant_id', tenantId)
    .or(`estado_producao.neq.entregue,criado_em.gte.${há7Dias()}`)
    .order('numero_pedido', { ascending: true })

  if (error) {
    console.error('[Producao] Erro ao buscar pedidos:', error)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
