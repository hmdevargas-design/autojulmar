// Motor de conversa progressiva — orquestra o fluxo de mensagens WhatsApp
// Recolhe campos em falta, cria pedidos e responde ao operador

import { parsearMensagem }                    from './parser'
import { obterSessao, guardarSessao, eliminarSessao } from './session'
import { enviarMensagem }                     from './sender'
import { criarClienteAdmin }                  from '@/lib/supabase/admin'
import { resolverTenant }                     from '@/lib/tenant/resolver'

// Campos obrigatórios para criar pedido
const CAMPOS_OBRIGATORIOS = ['clienteNome', 'contacto', 'material', 'tipoTapete'] as const

// Perguntas a fazer quando o campo está em falta
const PERGUNTA: Record<string, string> = {
  clienteNome: 'Qual é o nome do cliente?',
  contacto:    'Qual é o contacto (telemóvel) do cliente?',
  material:    'Qual é o material?\nEx: ECO PRETO · GTI PRETO · VELUDO PRETO · BORRACHA',
  tipoTapete:  'Qual é o tipo de tapete?\n1-JOGO  2-JOGO EM 3  3-JOGO EM 4  4-FRENTES  5-CONDUTOR  6-outro',
}

export async function processarMensagem(telefone: string, mensagem: string): Promise<void> {
  const tenantSlug = process.env.WHATSAPP_TENANT_SLUG
  if (!tenantSlug) {
    console.error('[WhatsApp] WHATSAPP_TENANT_SLUG não configurado')
    return
  }

  const tenant = await resolverTenant(tenantSlug)
  if (!tenant) {
    console.error('[WhatsApp] Tenant não encontrado:', tenantSlug)
    return
  }

  const supabase = criarClienteAdmin()

  // Carrega opções configuradas do tenant para o parser
  const [materiaisRes, tiposRes, extrasRes] = await Promise.all([
    supabase.from('campos_definicao').select('opcoes').eq('tenant_id', tenant.id).eq('nome', 'material').single(),
    supabase.from('campos_definicao').select('opcoes').eq('tenant_id', tenant.id).eq('nome', 'tipo_tapete').single(),
    supabase.from('campos_definicao').select('opcoes').eq('tenant_id', tenant.id).eq('nome', 'extras').single(),
  ])

  const materiais    = (materiaisRes.data?.opcoes as string[] | null) ?? []
  const tiposTapete  = (tiposRes.data?.opcoes    as string[] | null) ?? []
  const extrasDisp   = (extrasRes.data?.opcoes   as string[] | null) ?? []

  // Verifica se é um comando especial
  const msgNorm = mensagem.trim().toUpperCase()
  if (msgNorm === 'CANCELAR') {
    await eliminarSessao(tenant.id, telefone)
    await enviarMensagem(telefone, '❌ Operação cancelada.')
    return
  }

  // Recupera sessão existente
  const sessao = await obterSessao(tenant.id, telefone)

  // Saudação inicial — apenas na primeira mensagem (sem sessão prévia)
  if (!sessao) {
    await guardarSessao(tenant.id, telefone, { step: 'aguarda_pedido', dados: {} })
    await enviarMensagem(telefone, 'Boa tarde! 👋 Como podemos ajudar?\nSe pretende fazer um pedido, envie os dados do cliente e do tapete.')
  }

  // Parse da mensagem actual
  const extraido = await parsearMensagem(mensagem, materiais, tiposTapete, extrasDisp)

  // Funde com dados da sessão anterior
  const dados: Record<string, unknown> = { ...(sessao?.dados ?? {}), }

  if (extraido.clienteNome)          dados.clienteNome    = extraido.clienteNome
  if (extraido.contacto)             dados.contacto       = extraido.contacto
  if (extraido.matricula)            dados.matricula      = extraido.matricula
  if (extraido.viatura)              dados.viatura        = extraido.viatura
  if (extraido.material)             dados.material       = extraido.material
  if (extraido.tipoTapete.length)    dados.tipoTapete     = extraido.tipoTapete
  if (extraido.extras.length)        dados.extras         = extraido.extras
  if (extraido.quantidade > 1)       dados.quantidade     = extraido.quantidade
  if (extraido.formaPagamento)       dados.formaPagamento = extraido.formaPagamento

  // Se sessão estava à espera de um campo específico e a mensagem é uma resposta simples
  if (sessao?.step === 'aguarda_tipo_tapete' && !extraido.tipoTapete.length) {
    const mapa: Record<string, string> = {
      '1': 'JOGO', '2': 'JOGO EM 3', '3': 'JOGO EM 4', '4': 'FRENTES', '5': 'CONDUTOR'
    }
    const resposta = mapa[mensagem.trim()]
    if (resposta) dados.tipoTapete = [resposta]
    else dados.tipoTapete = [mensagem.trim().toUpperCase()]
  }

  // Verifica campos em falta
  for (const campo of CAMPOS_OBRIGATORIOS) {
    const val = dados[campo]
    const falta = !val || (Array.isArray(val) && val.length === 0)
    if (falta) {
      await guardarSessao(tenant.id, telefone, { step: `aguarda_${campo}`, dados })
      await enviarMensagem(telefone, PERGUNTA[campo] ?? `Falta o campo: ${campo}`)
      return
    }
  }

  // Todos os campos presentes — cria o pedido
  await eliminarSessao(tenant.id, telefone)

  // Lookup de tipo de cliente pelo histórico do contacto
  const contacto = String(dados.contacto).replace(/\D/g, '').slice(-9)
  const { data: clienteExistente } = await supabase
    .from('clientes')
    .select('tipo_cliente_id, tipos_cliente ( nome )')
    .eq('tenant_id', tenant.id)
    .eq('contacto', contacto)
    .single()

  const { data: tipoDefault } = await supabase
    .from('tipos_cliente')
    .select('id')
    .eq('tenant_id', tenant.id)
    .limit(1)
    .single()

  const tipoClienteId = (clienteExistente?.tipo_cliente_id as string | null) ?? tipoDefault?.id ?? ''
  const tipoNome      = (clienteExistente?.tipos_cliente as unknown as { nome: string } | null)?.nome ?? 'NORMAL'

  // Chama a API interna de criação de pedido
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/pedidos`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId:        tenant.id,
      clienteNome:     dados.clienteNome,
      clienteContacto: contacto,
      tipoClienteId,
      estadoId:        '',
      dados: {
        matricula: dados.matricula ?? '',
        viatura:   dados.viatura  ?? '',
      },
      material:      dados.material,
      tipoTapete:    dados.tipoTapete,
      extras:        dados.extras ?? [],
      quantidade:    dados.quantidade ?? 1,
      descontoManual: 0,
      sinal:          0,
      formaPagamento: dados.formaPagamento ?? 'PAGAR NA ENTREGA',
      origem:         'whatsapp',
    }),
  })

  const resultado = await res.json()

  if (!res.ok) {
    await enviarMensagem(telefone, `❌ Erro ao criar pedido: ${resultado.erro ?? 'tente novamente'}`)
    return
  }

  const tapetes = (dados.tipoTapete as string[]).join(' + ')
  const matriculaFormatada = dados.matricula
    ? String(dados.matricula).replace(/([A-Z0-9]{2})([A-Z0-9]{2})([A-Z0-9]+)/, '$1-$2-$3')
    : ''

  const confirmacao = [
    `✅ Pedido #${resultado.numeroPedido} criado`,
    `${dados.clienteNome} | ${tipoNome}`,
    matriculaFormatada ? `${matriculaFormatada}${dados.viatura ? ' · ' + dados.viatura : ''}` : '',
    `${dados.material} · ${tapetes} | ${Number(resultado.valorFinal).toFixed(2)}€`,
    `Responde CANCELAR para anular`,
  ].filter(Boolean).join('\n')

  await enviarMensagem(telefone, confirmacao)
}
