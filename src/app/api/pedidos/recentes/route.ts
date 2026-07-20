import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  const desde = request.nextUrl.searchParams.get('desde')
  const ate = request.nextUrl.searchParams.get('ate') ?? new Date().toISOString()

  const desdeData = desde ? new Date(desde) : null
  const ateData = new Date(ate)

  if (
    !tenantId ||
    !desdeData ||
    Number.isNaN(desdeData.getTime()) ||
    Number.isNaN(ateData.getTime()) ||
    desdeData > ateData
  ) {
    return NextResponse.json({ erro: 'Intervalo de consulta invalido' }, { status: 400 })
  }

  const supabase = criarClienteAdmin()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, criado_em')
    .eq('tenant_id', tenantId)
    .gt('criado_em', desdeData.toISOString())
    .lte('criado_em', ateData.toISOString())
    .order('criado_em', { ascending: true })
    .limit(1000)

  if (error) {
    console.error('Erro ao consultar pedidos para impressao:', error)
    return NextResponse.json({ erro: 'Erro ao consultar pedidos' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
