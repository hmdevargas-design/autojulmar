import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'

// GET /api/clientes?tenantId=X&q=texto    → pesquisa por nome ou contacto
// GET /api/clientes?tenantId=X&contacto=Y → lookup exacto por contacto
// PUT /api/clientes                        → editar cliente

import { z } from 'zod'

const schemaPut = z.object({
  id:             z.string().uuid(),
  tenantId:       z.string().uuid(),
  nome:           z.string().min(1),
  contacto:       z.string().min(9),
  tipoClienteId:  z.string().uuid().nullable(),
  codigo:         z.string().max(20).nullable().optional(),
})

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const input = schemaPut.parse(body)
    const supabase = criarClienteAdmin()

    // Normaliza contacto (remove não-dígitos, fica com os últimos 9)
    const contacto = input.contacto.replace(/\D/g, '').slice(-9)
    if (contacto.length < 9) {
      return NextResponse.json({ erro: 'Contacto inválido' }, { status: 400 })
    }

    const { error } = await supabase
      .from('clientes')
      .update({
        nome:            input.nome.trim(),
        contacto,
        tipo_cliente_id: input.tipoClienteId,
        codigo:          input.codigo?.trim() || null,
      })
      .eq('id', input.id)
      .eq('tenant_id', input.tenantId)

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tenantId = searchParams.get('tenantId')
  const q        = searchParams.get('q')?.trim()
  const contacto = searchParams.get('contacto')?.replace(/\D/g, '').slice(-9)
  const codigo   = searchParams.get('codigo')?.trim()

  if (!tenantId) return NextResponse.json({ erro: 'tenantId obrigatório' }, { status: 400 })

  const supabase = criarClienteAdmin()

  // Lookup exacto por contacto
  if (contacto) {
    const { data } = await supabase
      .from('clientes')
      .select('id, nome, contacto, tipo_cliente_id, tipos_cliente ( nome, desconto_pct )')
      .eq('tenant_id', tenantId)
      .eq('contacto', contacto)
      .single()
    return NextResponse.json(data ?? null)
  }

  // Lookup por código de identificação rápida (case-insensitive)
  if (codigo) {
    const { data } = await supabase
      .from('clientes')
      .select('id, nome, contacto, tipo_cliente_id, tipos_cliente ( nome, desconto_pct )')
      .eq('tenant_id', tenantId)
      .ilike('codigo', codigo)
      .single()
    return NextResponse.json(data ?? null)
  }

  // Pesquisa por nome ou contacto (para a página de clientes)
  let query = supabase
    .from('clientes')
    .select(`
      id, nome, contacto,
      tipos_cliente ( nome ),
      pedidos ( id )
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('nome')
    .limit(50)

  if (q) {
    query = query.or(`nome.ilike.%${q}%,contacto.ilike.%${q}%`)
  }

  const { data, count } = await query
  return NextResponse.json({ clientes: data ?? [], total: count ?? 0 })
}
