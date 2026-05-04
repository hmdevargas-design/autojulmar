import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  const desde    = request.nextUrl.searchParams.get('desde')

  if (!tenantId || !desde) {
    return NextResponse.json([], { status: 400 })
  }

  const supabase = criarClienteAdmin()
  const { data } = await supabase
    .from('pedidos')
    .select('id, numero_pedido')
    .eq('tenant_id', tenantId)
    .gt('criado_em', desde)
    .order('criado_em')

  return NextResponse.json(data ?? [])
}
