import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { limparCacheConfig } from '@/lib/tenant/config'
import { limparCacheTenant } from '@/lib/tenant/resolver'
import { z } from 'zod'

const schemaPut = z.object({
  tenantId:    z.string().min(1),
  tenantSlug:  z.string().min(1),
  nome:        z.string().min(1).max(100),
  logoUrl:     z.string().url().nullable().or(z.literal('')),
  corPrimaria: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (formato: #RRGGBB)'),
})

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const input = schemaPut.parse(body)
    const supabase = criarClienteAdmin()

    const { error } = await supabase
      .from('tenants')
      .update({
        nome:         input.nome,
        logo_url:     input.logoUrl || null,
        cor_primaria: input.corPrimaria,
      })
      .eq('id', input.tenantId)

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

    // Invalida ambos os caches para reflectir alterações imediatamente
    limparCacheConfig(input.tenantId)
    limparCacheTenant(input.tenantSlug)

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      const msg = err.issues[0]?.message ?? 'Dados inválidos'
      return NextResponse.json({ erro: msg }, { status: 400 })
    }
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
