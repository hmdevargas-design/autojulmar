import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { limparCacheConfig } from '@/lib/tenant/config'
import { z } from 'zod'

const schemaOpcao = z.object({
  valor:   z.string().min(1),
  label:   z.string().min(1),
  ordem:   z.number().int().min(0),
  activo:  z.boolean(),
})

const schemaPut = z.object({
  tenantId:   z.string().min(1),
  nomeCampo:  z.string().min(1),
  opcoes:     z.array(schemaOpcao),
})

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ erro: 'tenantId obrigatório' }, { status: 400 })

  const supabase = criarClienteAdmin()
  const { data, error } = await supabase
    .from('campos_definicao')
    .select('id, nome, label, tipo, opcoes, obrigatorio, ordem, e_variavel_preco, papel_preco')
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .order('ordem')

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const input = schemaPut.parse(body)
    const supabase = criarClienteAdmin()

    const { error } = await supabase
      .from('campos_definicao')
      .update({ opcoes: input.opcoes })
      .eq('tenant_id', input.tenantId)
      .eq('nome', input.nomeCampo)

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    limparCacheConfig(input.tenantId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
