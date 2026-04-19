// Agente de atendimento WhatsApp — Claude Sonnet
// Atende clientes, cria pedidos com confirmacao previa e escala para humano

import Anthropic from '@anthropic-ai/sdk'
import { enviarMensagem }                            from './sender'
import { obterSessao, guardarSessao, eliminarSessao } from './session'
import { resolverTenant }                            from '@/lib/tenant/resolver'
import { criarClienteAdmin }                         from '@/lib/supabase/admin'

const claude        = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MAX_HISTORICO = 10

type Msg = { role: 'user' | 'assistant'; content: string }

interface DadosPedidoPendente {
  clienteNome:     string
  contacto:        string
  matricula?:      string
  viatura?:        string
  material:        string
  tipoTapete:      string[]
  extras?:         string[]
  quantidade?:     number
  formaPagamento?: string
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const nomeLoja = process.env.WHATSAPP_LOJA_NOME    ?? 'Autojulmar'
  const morada   = process.env.WHATSAPP_LOJA_MORADA  ?? 'R. Camara de Lobos 7 Loja C, 2670-489 Loures'
  const horario  = process.env.WHATSAPP_LOJA_HORARIO ?? 'segunda a sexta, 9h30-13h e 15h-18h'
  const mbway    = process.env.WHATSAPP_MBWAY         ?? ''

  return `Es o assistente de atendimento da ${nomeLoja}, loja de tapetes para automovel em Loures, Portugal.

SOBRE A LOJA:
- Fabricamos tapetes personalizados para qualquer viatura, na hora
- Morada: ${morada}
- Horario: ${horario}${mbway ? `\n- MBWay: ${mbway}` : ''}
- Nao abrimos aos sabados (excepto ocasionalmente de manha)

MATERIAIS E PRECOS ORIENTATIVOS:
- Eco Preto: a partir de 24 euros/jogo
- GTI Preto/Cinza: 33-39 euros/jogo
- Veludo Preto/Cinza: 39-45 euros/jogo
- Borracha: 39-65 euros/jogo (depende da viatura)
- Canelado: 28-39 euros/jogo
- Capas, volantes, reparacoes: orcamento personalizado

EXTRAS: molas condutor (+2 euros), reforco plastico, velcro, traseiro inteiro

CRIACAO DE PEDIDOS:
Quando o operador enviar dados de um pedido com todos os campos obrigatorios, responde APENAS com o bloco abaixo, sem mais texto:

[PEDIDO_PENDENTE]
{"clienteNome":"...","contacto":"...","matricula":"...","viatura":"...","material":"...","tipoTapete":["..."],"extras":[],"quantidade":1,"formaPagamento":"PAGAR NA ENTREGA"}

Campos OBRIGATORIOS: clienteNome, contacto, material, tipoTapete
Campos opcionais: matricula, viatura, extras, quantidade, formaPagamento
Se faltar campo obrigatorio, pede-o de forma natural. Nao uses o bloco [PEDIDO_PENDENTE] sem todos os campos.

Tipos de tapete validos: JOGO, JOGO EM 3, JOGO EM 4, FRENTES, CONDUTOR, TRASEIRO, MALA

REGRAS GERAIS:
1. Resposta curta — maximo 3 linhas
2. Adapta o tom — informal com quem fala informal, directo com stands
3. Se nao souberes: passa para humano
4. Responde SEMPRE em portugues de Portugal, sem emojis
5. Nunca uses emojis em nenhuma resposta

QUANDO PASSAR PARA HUMANO — responder apenas com [ESCALAR] seguido do motivo:
- Reclamacoes, devolucoes, reembolsos
- Orcamentos complexos (capas, volantes, restauro)
- Cliente pede para falar com pessoa
- Situacao que nao sabes resolver`
}

// ─── Confirmacao de pedido pendente ──────────────────────────────────────────

async function tratarConfirmacao(
  tenantId: string,
  telefone: string,
  mensagem: string,
  dadosPendentes: DadosPedidoPendente
): Promise<void> {
  const respNorm = mensagem.trim().toUpperCase()

  if (['NAO', 'NÃO', 'CANCELAR', 'N', 'NO'].includes(respNorm)) {
    await eliminarSessao(tenantId, telefone)
    await enviarMensagem(telefone, 'Pedido cancelado.')
    return
  }

  if (!['SIM', 'S', 'CONFIRMAR', 'OK'].includes(respNorm)) {
    await enviarMensagem(telefone, 'Responde SIM para criar o pedido ou NAO para cancelar.')
    return
  }

  // Confirma — cria o pedido
  await eliminarSessao(tenantId, telefone)

  const supabase = criarClienteAdmin()
  const contacto = String(dadosPendentes.contacto).replace(/\D/g, '').slice(-9)

  const { data: clienteExistente } = await supabase
    .from('clientes')
    .select('tipo_cliente_id, tipos_cliente ( nome )')
    .eq('tenant_id', tenantId)
    .eq('contacto', contacto)
    .single()

  const { data: tipoDefault } = await supabase
    .from('tipos_cliente')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single()

  const tipoClienteId = (clienteExistente?.tipo_cliente_id as string | null) ?? tipoDefault?.id ?? ''
  const tipoNome      = (clienteExistente?.tipos_cliente as unknown as { nome: string } | null)?.nome ?? 'NORMAL'

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/pedidos`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      clienteNome:     dadosPendentes.clienteNome,
      clienteContacto: contacto,
      tipoClienteId,
      estadoId:        '',
      dados: {
        matricula: dadosPendentes.matricula ?? '',
        viatura:   dadosPendentes.viatura   ?? '',
      },
      material:       dadosPendentes.material,
      tipoTapete:     dadosPendentes.tipoTapete,
      extras:         dadosPendentes.extras        ?? [],
      quantidade:     dadosPendentes.quantidade    ?? 1,
      descontoManual: 0,
      sinal:          0,
      formaPagamento: dadosPendentes.formaPagamento ?? 'PAGAR NA ENTREGA',
      origem:         'whatsapp',
    }),
  })

  const resultado = await res.json()

  if (!res.ok) {
    await enviarMensagem(telefone, `Erro ao criar pedido: ${resultado.erro ?? 'tente novamente'}`)
    return
  }

  const tapetes   = dadosPendentes.tipoTapete.join(' + ')
  const matricFmt = dadosPendentes.matricula
    ? String(dadosPendentes.matricula).replace(/([A-Z0-9]{2})([A-Z0-9]{2})([A-Z0-9]+)/, '$1-$2-$3')
    : ''

  const confirmacao = [
    `Pedido #${resultado.numeroPedido} criado`,
    `${dadosPendentes.clienteNome} | ${tipoNome}`,
    matricFmt ? `${matricFmt}${dadosPendentes.viatura ? ' · ' + dadosPendentes.viatura : ''}` : '',
    `${dadosPendentes.material} · ${tapetes} | ${Number(resultado.valorFinal).toFixed(2)}EUR`,
  ].filter(Boolean).join('\n')

  await enviarMensagem(telefone, confirmacao)
}

// ─── Pre-visualizacao do pedido pendente ─────────────────────────────────────

async function mostrarPreviewPedido(
  tenantId: string,
  telefone: string,
  dados: DadosPedidoPendente,
  historico: Msg[]
): Promise<void> {
  const matricFmt = dados.matricula
    ? String(dados.matricula).replace(/([A-Z0-9]{2})([A-Z0-9]{2})([A-Z0-9]+)/, '$1-$2-$3')
    : null

  const linhas = [
    `Pedido a criar`,
    ``,
    `Cliente: ${dados.clienteNome} | ${dados.contacto}`,
    matricFmt ? `Viatura: ${matricFmt}${dados.viatura ? ' · ' + dados.viatura : ''}` : dados.viatura ? `Viatura: ${dados.viatura}` : null,
    `Produto: ${dados.material} · ${dados.tipoTapete.join(' + ')}`,
    dados.extras?.length ? `Extras: ${dados.extras.join(', ')}` : null,
    dados.quantidade && dados.quantidade > 1 ? `Qtd: ${dados.quantidade}` : null,
    `Pagamento: ${dados.formaPagamento ?? 'PAGAR NA ENTREGA'}`,
    ``,
    `Responde SIM para criar ou NAO para cancelar.`,
  ].filter((l) => l !== null).join('\n')

  await guardarSessao(tenantId, telefone, {
    step:  'aguarda_confirmacao',
    dados: { historico, pedidoPendente: dados },
  })

  await enviarMensagem(telefone, linhas)
}

// ─── Entrada principal ────────────────────────────────────────────────────────

export async function processarComAgente(telefone: string, mensagem: string): Promise<void> {
  const tenantSlug   = process.env.WHATSAPP_TENANT_SLUG
  const numeroHumano = process.env.WHATSAPP_NUMERO_HUMANO

  if (!tenantSlug) { console.error('[Agente] WHATSAPP_TENANT_SLUG nao configurado'); return }

  const tenant = await resolverTenant(tenantSlug)
  if (!tenant)  { console.error('[Agente] Tenant nao encontrado:', tenantSlug); return }

  const sessao = await obterSessao(tenant.id, telefone)

  // Se esta a aguardar confirmacao de pedido, trata directamente
  if (sessao?.step === 'aguarda_confirmacao') {
    const pendente = sessao.dados?.pedidoPendente as DadosPedidoPendente | undefined
    if (pendente) {
      await tratarConfirmacao(tenant.id, telefone, mensagem, pendente)
      return
    }
  }

  // Carrega historico da sessao
  const historico: Msg[] = (sessao?.dados?.historico as Msg[] | undefined) ?? []
  historico.push({ role: 'user', content: mensagem })
  if (historico.length > MAX_HISTORICO) {
    historico.splice(0, historico.length - MAX_HISTORICO)
  }

  // Chama Claude Sonnet
  let resposta: string
  try {
    const res = await claude.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 400,
      system:     buildSystemPrompt(),
      messages:   historico,
    })
    resposta = (res.content[0] as { type: string; text: string }).text.trim()
  } catch (err) {
    console.error('[Agente] Erro Claude Sonnet:', String(err))
    if (numeroHumano) {
      await enviarMensagem(numeroHumano,
        `ERRO AGENTE\nCliente: ${telefone}\nMensagem: "${mensagem}"\nErro: ${String(err)}`)
    }
    await enviarMensagem(telefone, 'Problema tecnico. A nossa equipa contacta em breve.')
    return
  }

  // Pedido pendente — mostra preview e aguarda confirmacao
  if (resposta.startsWith('[PEDIDO_PENDENTE]')) {
    const jsonStr = resposta.replace('[PEDIDO_PENDENTE]', '').trim()
    try {
      const dados = JSON.parse(jsonStr) as DadosPedidoPendente
      historico.push({ role: 'assistant', content: resposta })
      await mostrarPreviewPedido(tenant.id, telefone, dados, historico)
    } catch {
      console.error('[Agente] JSON do pedido invalido:', jsonStr)
      await guardarSessao(tenant.id, telefone, { step: 'conversando', dados: { historico } })
      await enviarMensagem(telefone, 'Nao consegui processar o pedido. Pode repetir os dados?')
    }
    return
  }

  // Escalamento para humano
  if (resposta.startsWith('[ESCALAR]')) {
    const motivo = resposta.replace('[ESCALAR]', '').trim()
    console.log(`[Agente] Escalamento — ${telefone}: ${motivo}`)
    if (numeroHumano) {
      await enviarMensagem(numeroHumano,
        `ESCALAMENTO AGENTE\nCliente: ${telefone}\nMotivo: ${motivo}\nMensagem: "${mensagem}"`)
    }
    await enviarMensagem(telefone, 'Vou passar o seu contacto a nossa equipa, que responde em breve.')
    historico.push({ role: 'assistant', content: resposta })
    await guardarSessao(tenant.id, telefone, { step: 'escalado', dados: { historico } })
    return
  }

  // Resposta normal — guarda historico e envia
  historico.push({ role: 'assistant', content: resposta })
  await guardarSessao(tenant.id, telefone, { step: 'conversando', dados: { historico } })
  await enviarMensagem(telefone, resposta)
}
