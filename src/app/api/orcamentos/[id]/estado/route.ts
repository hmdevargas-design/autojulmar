import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  tenantId: z.string().min(1),
  estado: z.enum(['rascunho', 'enviado', 'em_acompanhamento', 'aprovado', 'recusado', 'convertido']),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const input = schema.parse(await request.json())
    const supabase = criarClienteAdmin()

    const { error } = await supabase
      .from('orcamentos')
      .update({ estado: input.estado })
      .eq('id', id)
      .eq('tenant_id', input.tenantId)

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ erro: 'Dados inválidos', detalhes: error.issues }, { status: 400 })
    }
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
