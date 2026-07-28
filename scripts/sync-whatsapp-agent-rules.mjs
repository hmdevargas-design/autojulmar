import { createClient } from '@supabase/supabase-js'

const START = '[REGRAS_GERIDAS_AGENTE_JULMAR_V1]'
const END = '[/REGRAS_GERIDAS_AGENTE_JULMAR_V1]'
const TELEFONE_INSTRUCOES = '__instrucoes_agente__'

const regras = `${START}
Estas regras operacionais sao absolutas e substituem qualquer instrucao anterior que entre em conflito:
- Fotografias de alcatifa aprovadas: ECO PRETO, GTI PRETO, CANELADO e VELUDO PRETO.
- Fotografia de borracha aprovada: BORRACHA PIT.
- TAPETES 3D so podem ser enviados quando o cliente pedir tapetes em borracha ou Tapetes 3D.
- MALAS 3D so podem ser enviadas quando o cliente pedir tapete para mala, bagageira ou porta-bagagens.
- Nunca enviar fotografias de GTI CINZA, VELUDO CINZA, CINZA CABRIO ou BORRACHA STANDARD.
- Horario fixo de atendimento: segunda a sexta-feira, das 09:30 as 13:00 e das 15:00 as 18:00.
- A Autojulmar fecha sempre as 18:00. Nunca prometer esperar um cliente depois desse horario.
- A Autojulmar nao abre aos sabados nem aos domingos, sem excepcoes.
- Fecho extraordinario: quarta-feira, 29/07/2026, fechada de manha. Reabre as 15:00 e fecha normalmente as 18:00.
${END}`

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const tenantSlug = process.env.WHATSAPP_TENANT_SLUG ?? 'autojulmar'

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: tenant, error: tenantError } = await supabase
  .from('tenants')
  .select('id,slug')
  .eq('slug', tenantSlug)
  .single()

if (tenantError || !tenant) {
  throw new Error(`Tenant nao encontrado: ${tenantError?.message ?? tenantSlug}`)
}

const { data: sessao, error: sessaoError } = await supabase
  .from('sessoes_whatsapp')
  .select('estado_conversa')
  .eq('tenant_id', tenant.id)
  .eq('telefone', TELEFONE_INSTRUCOES)
  .maybeSingle()

if (sessaoError) {
  throw new Error(`Erro ao ler instrucoes: ${sessaoError.message}`)
}

const estadoAtual = sessao?.estado_conversa ?? {}
const instrucoesAtuais = typeof estadoAtual.instrucoes === 'string'
  ? estadoAtual.instrucoes
  : ''
const blocoGerido = new RegExp(
  `${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  'g',
)
const instrucoesPreservadas = instrucoesAtuais
  .replace(blocoGerido, '')
  .trim()
const instrucoes = [instrucoesPreservadas, regras].filter(Boolean).join('\n\n')
const expiraEm = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

const { error: upsertError } = await supabase
  .from('sessoes_whatsapp')
  .upsert({
    tenant_id: tenant.id,
    telefone: TELEFONE_INSTRUCOES,
    estado_conversa: {
      ...estadoAtual,
      instrucoes,
      regras_geridas_atualizadas_em: new Date().toISOString(),
    },
    expira_em: expiraEm,
  }, {
    onConflict: 'tenant_id,telefone',
  })

if (upsertError) {
  throw new Error(`Erro ao guardar instrucoes: ${upsertError.message}`)
}

console.log(`Regras persistentes sincronizadas para o tenant ${tenant.slug}.`)
