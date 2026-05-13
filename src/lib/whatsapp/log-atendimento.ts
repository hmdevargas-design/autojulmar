import { criarClienteAdmin } from '@/lib/supabase/admin'
import { resolverTenant }    from '@/lib/tenant/resolver'

export async function registarAtendimento(telefone: string, nome?: string): Promise<void> {
  const tenantSlug = process.env.WHATSAPP_TENANT_SLUG
  if (!tenantSlug) return

  const tenant = await resolverTenant(tenantSlug)
  if (!tenant) return

  const supabase = criarClienteAdmin()
  const { error } = await supabase.rpc('registar_atendimento_whatsapp', {
    p_tenant_id: tenant.id,
    p_telefone:  telefone,
    p_nome:      nome ?? null,
  })

  if (error) console.warn('[Log Atendimento] Erro ao registar:', error.message)
}

export async function marcarPedidoNoAtendimento(
  tenantId:     string,
  telefone:     string,
  numeroPedido: number,
): Promise<void> {
  const supabase = criarClienteAdmin()
  const hoje     = new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from('log_atendimentos_whatsapp')
    .update({ resultou_em_pedido: true, numero_pedido: numeroPedido, atualizado_em: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('telefone',  telefone)
    .eq('dia',       hoje)

  if (error) console.warn('[Log Atendimento] Erro ao marcar pedido:', error.message)
}
