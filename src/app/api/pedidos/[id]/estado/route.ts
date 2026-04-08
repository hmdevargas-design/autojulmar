import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  estadoId: z.string().min(1),
  tenantId: z.string().min(1),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const input = schema.parse(body)
    const supabase = criarClienteAdmin()

    const { error } = await supabase
      .from('pedidos')
      .update({ estado_id: input.estadoId })
      .eq('id', id)
      .eq('tenant_id', input.tenantId)

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
