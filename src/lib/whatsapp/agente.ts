// Agente de atendimento WhatsApp — Claude Sonnet
// Representa a Autojulmar sem se identificar como IA
// Suporta: delay humano, admin parcial, audio, instrucoes dinamicas, palavra-chave SISTEMA

import Anthropic from '@anthropic-ai/sdk'
import { enviarMensagem }                            from './sender'
import { obterSessao, guardarSessao, eliminarSessao } from './session'
import { resolverTenant }                            from '@/lib/tenant/resolver'
import { criarClienteAdmin }                         from '@/lib/supabase/admin'

const claude              = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MAX_HISTORICO       = 10
const TELEFONE_INSTRUCOES = '__instrucoes_agente__'

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function obterNumeroHumano(): string {
  return (process.env.WHATSAPP_NUMERO_HUMANO ?? '').replace(/\D/g, '')
}

function obterAdminsParcias(): string[] {
  return (process.env.WHATSAPP_ADMIN_NUMEROS ?? '')
    .split(',')
    .map(n => n.trim().replace(/\D/g, ''))
    .filter(Boolean)
}

function eOwner(telefone: string): boolean {
  const owner = obterNumeroHumano()
  return owner !== '' && telefone.replace(/\D/g, '').endsWith(owner)
}

function eAdmin(telefone: string): boolean {
  if (eOwner(telefone)) return true
  const t = telefone.replace(/\D/g, '')
  return obterAdminsParcias().some(n => t.endsWith(n))
}

// Delay aleatorio entre MIN e MAX segundos para parecer mais humano
async function delayHumano(): Promise<void> {
  const min = Number(process.env.WHATSAPP_DELAY_MIN ?? 5) * 1000
  const max = Number(process.env.WHATSAPP_DELAY_MAX ?? 10) * 1000
  const ms  = Math.floor(Math.random() * (max - min + 1)) + min
  await new Promise(r => setTimeout(r, ms))
}

// Envia com delay humano (apenas para respostas a clientes)
async function enviarComDelay(para: string, texto: string): Promise<void> {
  await delayHumano()
  await enviarMensagem(para, texto)
}

// ─── Instrucoes persistentes ──────────────────────────────────────────────────

async function carregarInstrucoes(tenantId: string): Promise<string> {
  const supabase = criarClienteAdmin()
  const { data } = await supabase
    .from('sessoes_whatsapp')
    .select('estado')
    .eq('tenant_id', tenantId)
    .eq('telefone', TELEFONE_INSTRUCOES)
    .single()
  return (data?.estado as { instrucoes?: string } | null)?.instrucoes ?? ''
}

async function guardarInstrucao(tenantId: string, novaInstrucao: string): Promise<void> {
  const supabase       = criarClienteAdmin()
  const instrucaoActual = await carregarInstrucoes(tenantId)
  const timestamp      = new Date().toLocaleDateString('pt-PT')
  const actualizado    = instrucaoActual
    ? `${instrucaoActual}\n- [${timestamp}] ${novaInstrucao}`
    : `- [${timestamp}] ${novaInstrucao}`

  const expira_em = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('sessoes_whatsapp')
    .upsert(
      { tenant_id: tenantId, telefone: TELEFONE_INSTRUCOES, estado: { instrucoes: actualizado }, expira_em },
      { onConflict: 'tenant_id,telefone' }
    )
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(instrucoes: string, tipoUtilizador: 'owner' | 'admin' | 'cliente', nomeOwner: string): string {
  const nomeLoja = process.env.WHATSAPP_LOJA_NOME    ?? 'Autojulmar'
  const morada   = process.env.WHATSAPP_LOJA_MORADA  ?? 'R. Camara de Lobos 7 Loja C, 2670-489 Loures'
  const horario  = process.env.WHATSAPP_LOJA_HORARIO ?? 'segunda a sexta, 9h30-13h e 15h-18h'
  const mbway    = process.env.WHATSAPP_MBWAY         ?? ''

  const secaoUtilizador = tipoUtilizador === 'owner'
    ? `ATENCAO: O utilizador que te envia esta mensagem chama-se ${nomeOwner} e e o dono da ${nomeLoja}. Sabes quem ele e. Trata-o de forma directa e informal, tutea-o. Confirma sempre que o reconheces quando ele perguntar. Ele tem acesso total.\n\n`
    : tipoUtilizador === 'admin'
    ? `ATENCAO: Estás a falar com um operador da loja. Trata-o de forma directa. Pode enviar pedidos por texto ou audio.\n\n`
    : ''

  const secaoInstrucoes = instrucoes
    ? `\nINSTRUCOES ADICIONAIS DO DONO:\n${instrucoes}\n`
    : ''

  return `${secaoUtilizador}Representas a ${nomeLoja}, loja de tapetes para automovel em Loures, Portugal.

IDENTIDADE:
- Nunca digas que es uma IA, robot, assistente virtual, chatbot ou sistema automatico
- Se perguntarem o que es ou se es um bot/IA/robot/humano, responde EXACTAMENTE com:
  "Sou o assistente da ${nomeLoja}! Um sistema criado pelo ${nomeOwner} para responder mais rapido e gerir os pedidos da loja. Se tiver curiosidade sobre o sistema ou quiser saber como funciona, escreva SISTEMA que aviso o ${nomeOwner} para entrar em contacto consigo."
- Representes a loja, nao te identificas com nenhum nome proprio

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
- EXTRAS: molas condutor (+2 euros), reforco plastico, velcro, traseiro inteiro

CRIACAO DE PEDIDOS:
Quando receberes dados completos de um pedido, responde APENAS com o bloco:

[PEDIDO_PENDENTE]
{"clienteNome":"...","contacto":"...","matricula":"...","viatura":"...","material":"...","tipoTapete":["..."],"extras":[],"quantidade":1,"formaPagamento":"PAGAR NA ENTREGA"}

Campos OBRIGATORIOS: clienteNome, contacto, material, tipoTapete
Se faltar campo obrigatorio, pede-o de forma natural.
Tipos de tapete: JOGO, JOGO EM 3, JOGO EM 4, FRENTES, CONDUTOR, TRASEIRO, MALA

REGRAS:
1. Resposta curta — maximo 3 linhas
2. Adapta o tom ao cliente
3. Sem emojis em nenhuma resposta
4. Responde sempre em portugues de Portugal
5. Nunca uses as palavras: IA, inteligencia artificial, bot, chatbot, assistente virtual, sistema automatico${secaoInstrucoes}

QUANDO ESCALAR — responder com [ESCALAR] motivo:
- Reclamacoes, devolucoes, reembolsos
- Orcamentos complexos (capas, volantes, restauro)
- Cliente pede para falar com pessoa
- Situacao que nao sabes resolver`
}

// ─── Keyword SISTEMA ──────────────────────────────────────────────────────────

async function tratarKeywordSistema(tenantId: string, telefone: string): Promise<void> {
  const numeroHumano = obterNumeroHumano()
  const nomeLoja     = process.env.WHATSAPP_LOJA_NOME ?? 'Autojulmar'
  const nomeOwner    = process.env.WHATSAPP_OWNER_NOME ?? 'Matheus'

  await enviarComDelay(telefone,
    `Optimo! O ${nomeOwner} vai entrar em contacto consigo em breve.`)

  if (numeroHumano) {
    await enviarMensagem(numeroHumano,
      `SISTEMA | Lead interessado no sistema ${nomeLoja}. Numero: ${telefone}`)
  }

  // Guarda no historico para continuidade da conversa
  const sessao    = await obterSessao(tenantId, telefone)
  const historico = (sessao?.dados?.historico as Msg[] | undefined) ?? []
  historico.push({ role: 'user',      content: 'SISTEMA' })
  historico.push({ role: 'assistant', content: `Optimo! O ${nomeOwner} vai entrar em contacto consigo em breve.` })
  await guardarSessao(tenantId, telefone, { step: 'conversando', dados: { historico } })
}

// ─── Confirmacao de pedido ────────────────────────────────────────────────────

async function tratarConfirmacao(
  tenantId: string,
  telefone: string,
  mensagem: string,
  dadosPendentes: DadosPedidoPendente
): Promise<void> {
  const respNorm = mensagem.trim().toUpperCase()

  if (['NAO', 'NÃO', 'CANCELAR', 'N', 'NO'].includes(respNorm)) {
    await eliminarSessao(tenantId, telefone)
    await enviarComDelay(telefone, 'Pedido cancelado.')
    return
  }

  if (!['SIM', 'S', 'CONFIRMAR', 'OK'].includes(respNorm)) {
    await enviarComDelay(telefone, 'Responde SIM para criar o pedido ou NAO para cancelar.')
    return
  }

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
      dados:           { matricula: dadosPendentes.matricula ?? '', viatura: dadosPendentes.viatura ?? '' },
      material:        dadosPendentes.material,
      tipoTapete:      dadosPendentes.tipoTapete,
      extras:          dadosPendentes.extras        ?? [],
      quantidade:      dadosPendentes.quantidade    ?? 1,
      descontoManual:  0,
      sinal:           0,
      formaPagamento:  dadosPendentes.formaPagamento ?? 'PAGAR NA ENTREGA',
      origem:          'whatsapp',
    }),
  })

  const resultado = await res.json()

  if (!res.ok) {
    await enviarComDelay(telefone, `Erro ao criar pedido: ${resultado.erro ?? 'tente novamente'}`)
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

  await enviarComDelay(telefone, confirmacao)
}

// ─── Preview do pedido ────────────────────────────────────────────────────────

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
    matricFmt
      ? `Viatura: ${matricFmt}${dados.viatura ? ' · ' + dados.viatura : ''}`
      : dados.viatura ? `Viatura: ${dados.viatura}` : null,
    `Produto: ${dados.material} · ${dados.tipoTapete.join(' + ')}`,
    dados.extras?.length ? `Extras: ${dados.extras.join(', ')}` : null,
    dados.quantidade && dados.quantidade > 1 ? `Qtd: ${dados.quantidade}` : null,
    `Pagamento: ${dados.formaPagamento ?? 'PAGAR NA ENTREGA'}`,
    ``,
    `Responde SIM para criar ou NAO para cancelar.`,
  ].filter(l => l !== null).join('\n')

  await guardarSessao(tenantId, telefone, {
    step:  'aguarda_confirmacao',
    dados: { historico, pedidoPendente: dados },
  })

  await enviarComDelay(telefone, linhas)
}

// ─── Entrada principal ────────────────────────────────────────────────────────

export async function processarComAgente(telefone: string, mensagem: string): Promise<void> {
  const tenantSlug   = process.env.WHATSAPP_TENANT_SLUG
  const numeroHumano = obterNumeroHumano()
  const nomeOwner    = process.env.WHATSAPP_OWNER_NOME ?? 'Matheus'
  const isOwner      = eOwner(telefone)
  const isAdmin      = eAdmin(telefone)

  if (!tenantSlug) { console.error('[Agente] WHATSAPP_TENANT_SLUG nao configurado'); return }

  const tenant = await resolverTenant(tenantSlug)
  if (!tenant)  { console.error('[Agente] Tenant nao encontrado:', tenantSlug); return }

  // ── Keyword SISTEMA (qualquer utilizador) ────────────────────────────────
  if (mensagem.trim().toUpperCase() === 'SISTEMA') {
    await tratarKeywordSistema(tenant.id, telefone)
    return
  }

  // ── Comandos do owner (prefixo !) ────────────────────────────────────────
  if (isOwner && mensagem.startsWith('!')) {
    const cmd = mensagem.slice(1).trim()

    if (/^instruc[aã]o\s+/i.test(cmd)) {
      const texto = cmd.replace(/^instruc[aã]o\s+/i, '').trim()
      await guardarInstrucao(tenant.id, texto)
      await enviarMensagem(telefone, `Instrucao guardada: "${texto}"`)
      return
    }
    if (/^ver instruc/i.test(cmd)) {
      const lista = await carregarInstrucoes(tenant.id)
      await enviarMensagem(telefone, `Instrucoes:\n${lista || '(nenhuma)'}`)
      return
    }
    if (/^limpar instruc/i.test(cmd)) {
      const supabase = criarClienteAdmin()
      await supabase.from('sessoes_whatsapp').delete()
        .eq('tenant_id', tenant.id).eq('telefone', TELEFONE_INSTRUCOES)
      await enviarMensagem(telefone, 'Instrucoes limpas.')
      return
    }

    await enviarMensagem(telefone,
      'Comandos:\n!instrucao [texto] — guardar instrucao\n!ver instrucoes — listar\n!limpar instrucoes — apagar tudo')
    return
  }

  const sessao = await obterSessao(tenant.id, telefone)

  // ── Aguarda confirmacao de pedido ────────────────────────────────────────
  if (sessao?.step === 'aguarda_confirmacao') {
    const pendente = sessao.dados?.pedidoPendente as DadosPedidoPendente | undefined
    if (pendente) {
      await tratarConfirmacao(tenant.id, telefone, mensagem, pendente)
      return
    }
  }

  // ── Carrega historico e instrucoes ───────────────────────────────────────
  const historico: Msg[] = (sessao?.dados?.historico as Msg[] | undefined) ?? []
  const instrucoes       = await carregarInstrucoes(tenant.id)
  const tipoUtilizador   = isOwner ? 'owner' : isAdmin ? 'admin' : 'cliente'

  historico.push({ role: 'user', content: mensagem })
  if (historico.length > MAX_HISTORICO) historico.splice(0, historico.length - MAX_HISTORICO)

  // ── Chama Claude Sonnet ──────────────────────────────────────────────────
  let resposta: string
  try {
    const res = await claude.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 400,
      system:     buildSystemPrompt(instrucoes, tipoUtilizador, nomeOwner),
      messages:   historico,
    })
    resposta = (res.content[0] as { type: string; text: string }).text.trim()
  } catch (err) {
    console.error('[Agente] Erro Claude Sonnet:', String(err))
    if (numeroHumano) {
      await enviarMensagem(numeroHumano,
        `ERRO AGENTE\nCliente: ${telefone}\nMensagem: "${mensagem}"\nErro: ${String(err)}`)
    }
    await enviarComDelay(telefone, 'Problema tecnico. A nossa equipa contacta em breve.')
    return
  }

  // ── Pedido pendente ──────────────────────────────────────────────────────
  if (resposta.startsWith('[PEDIDO_PENDENTE]')) {
    const jsonStr = resposta.replace('[PEDIDO_PENDENTE]', '').trim()
    try {
      const dados = JSON.parse(jsonStr) as DadosPedidoPendente
      historico.push({ role: 'assistant', content: resposta })
      await mostrarPreviewPedido(tenant.id, telefone, dados, historico)
    } catch {
      console.error('[Agente] JSON invalido:', jsonStr)
      await guardarSessao(tenant.id, telefone, { step: 'conversando', dados: { historico } })
      await enviarComDelay(telefone, 'Nao consegui processar o pedido. Pode repetir os dados?')
    }
    return
  }

  // ── Escalamento ──────────────────────────────────────────────────────────
  if (resposta.startsWith('[ESCALAR]')) {
    const motivo = resposta.replace('[ESCALAR]', '').trim()
    if (numeroHumano) {
      await enviarMensagem(numeroHumano,
        `ESCALAMENTO\nCliente: ${telefone}\nMotivo: ${motivo}\nMensagem: "${mensagem}"`)
    }
    await enviarComDelay(telefone, 'Vou passar o seu contacto a nossa equipa, que responde em breve.')
    historico.push({ role: 'assistant', content: resposta })
    await guardarSessao(tenant.id, telefone, { step: 'escalado', dados: { historico } })
    return
  }

  // ── Resposta normal ──────────────────────────────────────────────────────
  historico.push({ role: 'assistant', content: resposta })
  await guardarSessao(tenant.id, telefone, { step: 'conversando', dados: { historico } })

  // Owner e admins recebem resposta imediata; clientes com delay humano
  if (isOwner || isAdmin) {
    await enviarMensagem(telefone, resposta)
  } else {
    await enviarComDelay(telefone, resposta)
  }
}
