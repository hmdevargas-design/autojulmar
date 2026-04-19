// Gestão de sessões de conversa WhatsApp no Supabase
// Cada sessão é identificada por (tenant_id, telefone) e expira após TTL

import { criarClienteAdmin } from '@/lib/supabase/admin'

const TTL = Number(process.env.WHATSAPP_SESSION_TTL ?? 86400) // segundos (default 24h)

export interface EstadoSessao {
  step: string          // campo que estamos a aguardar (ex: 'aguarda_tipo_tapete')
  dados: Record<string, unknown>  // campos já recolhidos
}

export async function obterSessao(tenantId: string, telefone: string): Promise<EstadoSessao | null> {
  const supabase = criarClienteAdmin()
  const { data } = await supabase
    .from('sessoes_whatsapp')
    .select('estado, expira_em')
    .eq('tenant_id', tenantId)
    .eq('telefone', telefone)
    .single()

  if (!data) return null

  // Limpa sessão expirada
  if (new Date(data.expira_em) < new Date()) {
    await eliminarSessao(tenantId, telefone)
    return null
  }

  return data.estado as EstadoSessao
}

export async function guardarSessao(tenantId: string, telefone: string, estado: EstadoSessao): Promise<void> {
  const supabase  = criarClienteAdmin()
  const expira_em = new Date(Date.now() + TTL * 1000).toISOString()

  await supabase
    .from('sessoes_whatsapp')
    .upsert(
      { tenant_id: tenantId, telefone, estado, expira_em },
      { onConflict: 'tenant_id,telefone' }
    )
}

export async function eliminarSessao(tenantId: string, telefone: string): Promise<void> {
  const supabase = criarClienteAdmin()
  await supabase
    .from('sessoes_whatsapp')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('telefone', telefone)
}
