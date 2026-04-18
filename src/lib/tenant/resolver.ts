// Resolução de tenant a partir do slug — consulta Supabase
import { criarClienteAdmin } from '@/lib/supabase/admin'
import type { Tenant } from '@/core/entities'

// Cache em memória para a duração do processo (evita N queries por request)
const cache = new Map<string, Tenant | null>()

/** Invalida o cache do resolver para um slug (chamar após alterações ao tenant) */
export function limparCacheTenant(slug: string): void {
  cache.delete(slug)
}

export async function resolverTenant(slug: string): Promise<Tenant | null> {
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null

  if (cache.has(slug)) return cache.get(slug)!

  const supabase = criarClienteAdmin()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, nome, slug, logo_url, cor_primaria, template_id, plano, criado_em')
    .eq('slug', slug)
    .eq('activo', true)
    .single()

  if (error || !data) {
    cache.set(slug, null)
    return null
  }

  const tenant: Tenant = {
    id:          data.id,
    nome:        data.nome,
    slug:        data.slug,
    logoUrl:     data.logo_url,
    corPrimaria: data.cor_primaria,
    templateId:  data.template_id,
    plano:       data.plano,
    criadoEm:    data.criado_em,
  }

  cache.set(slug, tenant)
  return tenant
}
