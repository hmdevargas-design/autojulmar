// Agente Julmar — atendimento WhatsApp com Claude
// Representa a Autojulmar sem se identificar como IA
// Suporta: delay humano, admin parcial, audio, instrucoes dinamicas, palavra-chave SISTEMA

import Anthropic from '@anthropic-ai/sdk'
import {
  enviarMensagem as enviarMensagemWhatsapp,
  enviarImagem as enviarImagemWhatsapp,
} from './sender'
import { obterSessao, guardarSessao, eliminarSessao }    from './session'
import {
  memoriaParaPrompt,
  obterMemoriaConversa,
  registrarTurnoConversa,
} from './conversation-memory'
import { resolverTenant }                                from '@/lib/tenant/resolver'
import { criarClienteAdmin }                             from '@/lib/supabase/admin'

export const AGENTE_JULMAR_NOME = 'Agente Julmar'

const claude              = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MAX_HISTORICO       = 14
const AGENTE_JULMAR_SOURCE = 'agente-julmar'
// Mantem a chave antiga para nao perder instrucoes ja guardadas antes da renomeacao interna.
const TELEFONE_INSTRUCOES = '__instrucoes_agente__'
const RATE_LIMIT_ALERT_COOLDOWN_MS = 10 * 60 * 1000

let ultimoAlertaRateLimit = 0

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

async function enviarMensagem(para: string, texto: string): Promise<void> {
  await enviarMensagemWhatsapp(para, texto, { source: AGENTE_JULMAR_SOURCE })
}

async function enviarImagem(para: string, imageUrl: string, caption?: string): Promise<void> {
  await enviarImagemWhatsapp(para, imageUrl, caption, { source: AGENTE_JULMAR_SOURCE })
}

async function registarTurnoAgenteJulmar(
  tenantId: string,
  telefone: string,
  userMessage: string,
  assistantMessage: string,
  state: string,
): Promise<void> {
  await registrarTurnoConversa({
    tenantId,
    telefone,
    userMessage,
    assistantMessage,
    state,
    metadata: { source: AGENTE_JULMAR_SOURCE },
  })
}

interface PerfilClienteAgenteJulmar {
  nome: string | null
  tipoNome: string | null
  ultimoPedido: {
    numeroPedido: number
    criadoEm: string
    material: string | null
    tipoTapete: string[]
    matricula: string | null
    viatura: string | null
  } | null
}

// ─── Helpers de identidade ─────────────────────────────────────────────────────

function obterNumeroHumano(): string {
  return (process.env.WHATSAPP_NUMERO_HUMANO ?? '').replace(/\D/g, '')
}

function eOwner(telefone: string): boolean {
  const owner = obterNumeroHumano()
  return owner !== '' && telefone.replace(/\D/g, '').endsWith(owner)
}

function eAdmin(telefone: string): boolean {
  if (eOwner(telefone)) return true
  const t = telefone.replace(/\D/g, '')
  return (process.env.WHATSAPP_ADMIN_NUMEROS ?? '')
    .split(',').map(n => n.trim().replace(/\D/g, '')).filter(Boolean)
    .some(n => t.endsWith(n))
}

// Envia mensagem para o owner E para todos os admins parciais
async function notificarTodosAdmins(mensagem: string): Promise<void> {
  const owner  = obterNumeroHumano()
  const admins = (process.env.WHATSAPP_ADMIN_NUMEROS ?? '')
    .split(',').map(n => n.trim().replace(/\D/g, '')).filter(Boolean)

  const destinos = [...new Set([owner, ...admins].filter(Boolean))]
  await Promise.all(destinos.map(n => enviarMensagem(n, mensagem)))
}

function erroParaTexto(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function isRateLimitError(err: unknown): boolean {
  const texto = erroParaTexto(err).toLowerCase()
  return texto.includes('rate_limit') || texto.includes('rate limit') || texto.includes('429')
}

function resumirErroTecnico(err: unknown): string {
  const texto = erroParaTexto(err)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (isRateLimitError(err)) {
    return 'Rate limit do Claude atingido. O agente vai responder em modo fallback e tentar novamente nas proximas mensagens.'
  }

  return texto.slice(0, 500)
}

async function notificarErroAgente(telefone: string, mensagem: string, err: unknown): Promise<void> {
  const numeroHumano = obterNumeroHumano()
  if (!numeroHumano) return

  if (isRateLimitError(err)) {
    const agora = Date.now()
    if (agora - ultimoAlertaRateLimit < RATE_LIMIT_ALERT_COOLDOWN_MS) return
    ultimoAlertaRateLimit = agora
  }

  await enviarMensagem(numeroHumano, [
    'ERRO AGENTE JULMAR',
    `Cliente: ${telefone}`,
    `Mensagem: "${mensagem.slice(0, 180)}${mensagem.length > 180 ? '...' : ''}"`,
    `Erro: ${resumirErroTecnico(err)}`,
  ].join('\n'))
}

async function chamarClaude(
  model: string,
  system: string,
  messages: Msg[],
): Promise<string> {
  const res = await claude.messages.create({
    model,
    max_tokens: 500,
    system,
    messages,
  })
  return (res.content[0] as { type: string; text: string }).text.trim()
}

// ─── Delay humano ─────────────────────────────────────────────────────────────

async function delayHumano(): Promise<void> {
  const min = Number(process.env.WHATSAPP_DELAY_MIN ?? 10) * 1000
  const max = Number(process.env.WHATSAPP_DELAY_MAX ?? 20) * 1000
  const ms  = Math.floor(Math.random() * (max - min + 1)) + min
  await new Promise(r => setTimeout(r, ms))
}

async function enviarComDelay(para: string, texto: string): Promise<void> {
  await delayHumano()
  await enviarMensagem(para, texto)
}

// ─── Fotos de material ─────────────────────────────────────────────────────────

const TODOS_MATERIAIS = [
  { nome: 'ECO PRETO',    arquivo: 'eco-preto'    },
  { nome: 'GTI PRETO',    arquivo: 'gti-preto'    },
  { nome: 'GTI CINZA',    arquivo: 'gti-cinza'    },
  { nome: 'VELUDO PRETO', arquivo: 'veludo-preto' },
  { nome: 'VELUDO CINZA', arquivo: 'veludo-cinza' },
  { nome: 'BORRACHA',     arquivo: 'borracha'     },
  { nome: 'CANELADO',     arquivo: 'canelado'     },
  { nome: 'CINZA CABRIO', arquivo: 'cinza-cabrio' },
  { nome: 'TAPETES 3D',   arquivo: 'tapetes-3d'   },
  { nome: 'MALAS 3D',     arquivo: 'malas-3d'     },
]

// filtro: lista separada por vírgulas, ex: "GTI PRETO,GTI CINZA" ou "todos"
async function enviarFotosMaterial(telefone: string, filtro?: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ''

  let lista = TODOS_MATERIAIS
  if (filtro && filtro.toUpperCase() !== 'TODOS') {
    const pedidos = filtro.split(',').map(s => s.trim().toUpperCase())
    lista = TODOS_MATERIAIS.filter(m => pedidos.some(p => m.nome.toUpperCase().includes(p) || p.includes(m.nome.toUpperCase())))
    if (lista.length === 0) lista = TODOS_MATERIAIS // fallback se filtro não bater em nada
  }

  for (const mat of lista) {
    await enviarImagem(telefone, `${baseUrl}/materiais/${mat.arquivo}.jpg`, mat.nome)
    await new Promise(r => setTimeout(r, 600))
  }
}

// ─── Takeover (pausa/retoma o bot para um numero) ────────────────────────────

export async function pausarBot(tenantId: string, telefone: string): Promise<void> {
  const sessao    = await obterSessao(tenantId, telefone)
  const historico = (sessao?.dados?.historico as Msg[] | undefined) ?? []
  await guardarSessao(tenantId, telefone, { step: 'takeover', dados: { historico, takeoverTs: Date.now() } })
}

async function retomarBot(tenantId: string, telefone: string): Promise<void> {
  const sessao    = await obterSessao(tenantId, telefone)
  const historico = (sessao?.dados?.historico as Msg[] | undefined) ?? []
  await guardarSessao(tenantId, telefone, { step: 'conversando', dados: { historico } })
}

// ─── Instrucoes persistentes ──────────────────────────────────────────────────

async function carregarInstrucoes(tenantId: string): Promise<string> {
  const supabase = criarClienteAdmin()
  const { data } = await supabase
    .from('sessoes_whatsapp')
    .select('estado_conversa')
    .eq('tenant_id', tenantId)
    .eq('telefone', TELEFONE_INSTRUCOES)
    .single()
  return (data?.estado_conversa as { instrucoes?: string } | null)?.instrucoes ?? ''
}

async function guardarInstrucao(tenantId: string, novaInstrucao: string): Promise<boolean> {
  const supabase        = criarClienteAdmin()
  const instrucaoActual = await carregarInstrucoes(tenantId)
  const timestamp       = new Date().toLocaleDateString('pt-PT')
  const actualizado     = instrucaoActual
    ? `${instrucaoActual}\n- [${timestamp}] ${novaInstrucao}`
    : `- [${timestamp}] ${novaInstrucao}`

  const expira_em = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase
    .from('sessoes_whatsapp')
    .upsert(
      { tenant_id: tenantId, telefone: TELEFONE_INSTRUCOES, estado_conversa: { instrucoes: actualizado }, expira_em },
      { onConflict: 'tenant_id,telefone' }
    )

  if (error) {
    console.error('[Agente Julmar] Erro ao guardar instrucao:', error.message, error.code)
    return false
  }
  return true
}

// ─── Verificar se cliente e VIP ───────────────────────────────────────────────

async function verificarEhVip(tenantId: string, contacto: string): Promise<boolean> {
  const tiposVip = (process.env.WHATSAPP_TIPOS_VIP ?? '')
    .split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
  if (tiposVip.length === 0) return false

  const supabase  = criarClienteAdmin()
  const contactoN = contacto.replace(/\D/g, '').slice(-9)
  const { data }  = await supabase
    .from('clientes')
    .select('tipos_cliente ( nome )')
    .eq('tenant_id', tenantId)
    .eq('contacto', contactoN)
    .single()

  const tipoNome = (data?.tipos_cliente as unknown as { nome: string } | null)?.nome?.toUpperCase() ?? ''
  return tiposVip.some(v => tipoNome.includes(v))
}

// ─── Perfil do cliente (nome + tipo) para contexto do agente ─────────────────

async function carregarPerfilCliente(
  tenantId: string,
  telefone: string
): Promise<PerfilClienteAgenteJulmar> {
  const supabase  = criarClienteAdmin()
  const contactoN = telefone.replace(/\D/g, '').slice(-9)
  const { data } = await supabase
    .from('clientes')
    .select('id, nome, tipos_cliente ( nome )')
    .eq('tenant_id', tenantId)
    .eq('contacto', contactoN)
    .single()

  const clienteId = data?.id as string | undefined
  let ultimoPedido: PerfilClienteAgenteJulmar['ultimoPedido'] = null

  if (clienteId) {
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('numero_pedido, criado_em, dados')
      .eq('tenant_id', tenantId)
      .eq('cliente_id', clienteId)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    const dadosPedido = (pedido?.dados as {
      matricula?: string
      viatura?: string
      material?: string
      tipo_tapete?: unknown
    } | null) ?? null
    ultimoPedido = pedido
      ? {
          numeroPedido: Number(pedido.numero_pedido),
          criadoEm: String(pedido.criado_em),
          material: dadosPedido?.material ?? null,
          tipoTapete: Array.isArray(dadosPedido?.tipo_tapete) ? dadosPedido.tipo_tapete.map(String) : [],
          matricula: dadosPedido?.matricula ?? null,
          viatura: dadosPedido?.viatura ?? null,
        }
      : null
  }

  return {
    nome:     (data?.nome as string | null) ?? null,
    tipoNome: (data?.tipos_cliente as unknown as { nome: string } | null)?.nome ?? null,
    ultimoPedido,
  }
}

// ─── Tabela de preços real da BD ─────────────────────────────────────────────

async function carregarTabelaPrecos(tenantId: string): Promise<string> {
  const supabase = criarClienteAdmin()

  const [baseRes, extraRes, tiposRes] = await Promise.all([
    supabase
      .from('tabela_preco_base')
      .select('campo1_valor, campo2_valor, preco')
      .eq('tenant_id', tenantId)
      .order('campo1_valor')
      .order('campo2_valor'),
    supabase
      .from('tabela_preco_extra')
      .select('opcao_valor, preco_adicional')
      .eq('tenant_id', tenantId),
    supabase
      .from('tipos_cliente')
      .select('nome, desconto_pct')
      .eq('tenant_id', tenantId)
      .order('ordem'),
  ])

  const base   = baseRes.data   ?? []
  const extras = extraRes.data  ?? []
  const tipos  = tiposRes.data  ?? []

  if (base.length === 0) return ''

  const porMaterial = new Map<string, { tipo: string; preco: number }[]>()
  for (const row of base) {
    if (!porMaterial.has(row.campo1_valor)) porMaterial.set(row.campo1_valor, [])
    porMaterial.get(row.campo1_valor)!.push({ tipo: row.campo2_valor, preco: Number(row.preco) })
  }

  let tabela = 'TABELA DE PRECOS EXACTOS (euros, sem desconto de cliente):\n'
  for (const [material, tipos_] of porMaterial) {
    tabela += `\n${material}:\n`
    for (const { tipo, preco } of tipos_) {
      tabela += `  ${tipo}: ${preco.toFixed(2)}€\n`
    }
  }

  if (extras.length > 0) {
    tabela += '\nEXTRAS (acrescentar ao preco base):\n'
    for (const e of extras) {
      tabela += `  ${e.opcao_valor}: +${Number(e.preco_adicional).toFixed(2)}€\n`
    }
  }

  if (tipos.length > 0) {
    tabela += '\nDESCONTOS POR TIPO DE CLIENTE (aplicar ao subtotal):\n'
    for (const t of tipos) {
      tabela += `  ${t.nome}: ${Number(t.desconto_pct)}% de desconto\n`
    }
  }

  tabela += '\nREGRAS DE CALCULO:\n'
  tabela += '  preco_base = tabela[material][tipo_tapete]\n'
  tabela += '  subtotal   = (preco_base + soma_extras) × quantidade\n'
  tabela += '  valor_final = subtotal - (subtotal × desconto_pct / 100)\n'
  tabela += '  Apresenta SEMPRE o valor_final (com desconto do tipo de cliente se conhecido).\n'
  tabela += '  Se o cliente nao estiver na BD, usa desconto 0%.\n'

  return tabela
}

// ─── System prompt ────────────────────────────────────────────────────────────

function resumoUltimoPedido(ultimoPedido: PerfilClienteAgenteJulmar['ultimoPedido']): string {
  if (!ultimoPedido) return ''

  const partes = [
    `#${ultimoPedido.numeroPedido}`,
    ultimoPedido.viatura,
    ultimoPedido.matricula,
    ultimoPedido.material,
    ultimoPedido.tipoTapete.length > 0 ? ultimoPedido.tipoTapete.join(' + ') : null,
  ].filter(Boolean)

  return partes.join(' | ')
}

function buildSystemPrompt(
  instrucoes:      string,
  tipoUtilizador:  'owner' | 'admin' | 'cliente',
  nomeOwner:       string,
  tabelaPrecos:    string,
  perfilCliente?:  PerfilClienteAgenteJulmar,
  descontoCupao?:  number,
  saudacaoAtiva?:  boolean,
  memoriaCompacta?: string
): string {
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

  const ultimoPedidoResumo = resumoUltimoPedido(perfilCliente?.ultimoPedido ?? null)
  const secaoPerfilCliente = (tipoUtilizador === 'cliente' && (perfilCliente?.tipoNome || perfilCliente?.nome || perfilCliente?.ultimoPedido))
    ? `\nPERFIL DO CLIENTE (injectado pelo core):\n${perfilCliente.nome ? `- Nome: ${perfilCliente.nome}\n` : ''}${perfilCliente.tipoNome ? `- Tipo: ${perfilCliente.tipoNome}\n` : ''}${ultimoPedidoResumo ? `- Ultimo pedido: ${ultimoPedidoResumo}\n` : ''}`
    : ''

  const secaoSaudacaoAtiva = (tipoUtilizador === 'cliente' && saudacaoAtiva)
    ? `\nSAUDACAO ACTIVA / TRANSPARENCIA:\nEsta e a primeira mensagem desta conversa. A primeira resposta deve identificar de forma natural que es o assistente inteligente da ${nomeLoja}.\n- Nao digas que es humano.\n- Nao uses a expressao "sou uma IA" salvo se o cliente perguntar directamente.\n- Usa "assistente inteligente da ${nomeLoja}" ou "sistema criado pela ${nomeLoja}" de forma simples.\n- Se o cliente ja veio com um pedido directo, responde ao pedido na mesma mensagem depois da identificacao curta.\n- Cliente novo: base recomendada: "Ola! Sou o assistente inteligente da ${nomeLoja}. Consigo ajudar com orcamentos, materiais, prazos e pedidos. Em que posso ajudar?"\n- Cliente com historico: trata pelo nome quando existir e podes referir o ultimo pedido/viatura se for natural. Exemplo: "Ola ${perfilCliente?.nome ?? ''}! Sou o assistente inteligente da ${nomeLoja}. Vi o seu historico connosco e consigo ajudar com novos pedidos, precos ou estado dos tapetes."\n- Stands, lojas, oficinas, taxi/TVDE e VIP: saudacao mais curta e directa, sem tom promocional.\n`
    : ''

  const secaoCupao = (descontoCupao && descontoCupao > 0)
    ? `\nCUPAO ACTIVO: AMERICO10 — desconto de ${descontoCupao}EUR aplicado no jogo\n`
    : ''

  const secaoMemoria = memoriaCompacta
    ? `\n${memoriaCompacta}\n`
    : ''

  return `${secaoUtilizador}${secaoPerfilCliente}${secaoMemoria}${secaoSaudacaoAtiva}${secaoCupao}Representas a ${nomeLoja}, loja de tapetes personalizados para automovel em Loures, Portugal.

IDENTIDADE:
- Es o assistente inteligente da ${nomeLoja}, um sistema criado para responder mais rapido, consultar contexto da loja e encaminhar para a equipa quando necessario.
- Nunca digas que es humano.
- Nao uses espontaneamente as palavras IA, robot, bot ou chatbot, excepto se o cliente perguntar directamente.
- Se perguntarem o que es ou se es um bot/IA/robot/humano, responde EXACTAMENTE com:
  "Sou o assistente inteligente da ${nomeLoja}! Um sistema criado pelo ${nomeOwner} para responder mais rapido, consultar pedidos e ajudar com orcamentos. Se quiser falar com a equipa, e so pedir."
- Representes a loja, nao te identificas com nenhum nome proprio

CAPACIDADES DO SISTEMA:
- Mensagens de audio sao transcritas automaticamente para texto — responde ao conteudo, nao ao meio
- Envio de fotos: quando incluis [ENVIAR_FOTOS_MATERIAL:lista] na resposta, o sistema envia automaticamente as fotos indicadas — NAO digas que nao consegues enviar fotos

SOBRE A LOJA:
- Fabricamos tapetes personalizados para qualquer viatura
- Prazo de entrega normal: 5 a 10 dias uteis
- O que fazemos na hora e apenas a recolha das informacoes do cliente e da viatura
- Morada: ${morada}
- Horario: ${horario}${mbway ? `\n- MBWay: ${mbway}` : ''}
- Nao abrimos aos sabados (excepto ocasionalmente de manha)

${tabelaPrecos || 'PRECOS: consultar na loja (tabela nao configurada)'}

OUTROS SERVICOS (sem preco fixo — escalar obrigatoriamente):
Capas, volantes, reparacoes

FLUXO PARA CLIENTES (fora de loja):
1. Cumprimento e apresentacao breve da loja
2. Pergunta pela viatura (matricula ou modelo)
3. Pede o nome do cliente
4. Pede o contacto telefonico — explica que e "para registo e para envio de confirmacao do pedido"
5. SE o cliente nao especificou preferencia de material, pergunta NATURALMENTE se prefere tapetes em borracha ou alcatifa (tecido) antes de apresentar opcoes
   Exemplo: "Prefere os tapetes em borracha ou em alcatifa (tecido)?"
6. Apresenta os materiais disponiveis dentro da categoria escolhida e INCLUI SEMPRE o marcador com os materiais exactos
   Se borracha: "Temos Borracha standard e Tapetes 3D. Seguem fotos!\n\n[ENVIAR_FOTOS_MATERIAL:BORRACHA,TAPETES 3D,MALAS 3D]"
   Se alcatifa: "Temos os seguintes materiais. Veja as fotos:\n\n[ENVIAR_FOTOS_MATERIAL:ECO PRETO,GTI PRETO,GTI CINZA,VELUDO PRETO,VELUDO CINZA,CANELADO,CINZA CABRIO]"
   Se cliente pediu material especifico (ex: "GTI preto"): envia so esse — [ENVIAR_FOTOS_MATERIAL:GTI PRETO]
   Se nao sabe: [ENVIAR_FOTOS_MATERIAL:todos]
   IMPORTANTE: especifica SEMPRE os materiais no marcador, nunca uses o marcador sem parametros
7. Cliente escolhe material → apresenta os tipos de tapete e preco estimado
8. Cliente escolhe tipo → confirma o pedido completo com preco total
9. Cliente diz que quer prosseguir → gera o bloco [PEDIDO_PENDENTE]

CRIACAO DE PEDIDOS:
Quando tiveres todos os dados e o cliente confirmar que quer prosseguir, responde APENAS com:

[PEDIDO_PENDENTE]
{"clienteNome":"...","contacto":"...","matricula":"...","viatura":"...","material":"...","tipoTapete":["..."],"extras":[],"quantidade":1,"formaPagamento":"PAGAR NA ENTREGA"}

Campos OBRIGATORIOS: clienteNome, contacto, material, tipoTapete
Tipos de tapete: JOGO, JOGO EM 3, JOGO EM 4, FRENTES, CONDUTOR, TRASEIRO, MALA

${secaoInstrucoes}REGRAS:
1. Resposta curta — maximo 3 linhas (excepto quando apresentas materiais/precos)
2. Adapta o tom ao cliente
3. Emojis: so se o cliente os usar primeiro (excepcao: saudacao AMERICO10)
4. Responde sempre em portugues de Portugal (nao PT-BR)
5. Mantem transparencia: se for a primeira resposta da conversa, identifica-te como assistente inteligente da loja; se perguntarem directamente, explica que es um sistema de atendimento da Autojulmar.

QUANDO ESCALAR — responder APENAS com [ESCALAR] motivo:
Usa SEMPRE o formato: [ESCALAR] descricao do pedido do cliente

Escala obrigatoriamente quando:
- Cliente pede orcamento de MALA (que nao seja MALAS 3D — estas tem preco fixo)
  Exemplo: [ESCALAR] Orcamento de mala — cliente: [nome] | viatura: [viatura] | contacto: [contacto]
- Cliente pede orcamento de REPARACAO
  Exemplo: [ESCALAR] Orcamento reparacao — cliente: [nome] | avaria: [descricao] | contacto: [contacto]
- Cliente pede orcamento de CAPAS (banco, volante, etc.)
  Exemplo: [ESCALAR] Orcamento capas — cliente: [nome] | viatura: [viatura] | contacto: [contacto]
- Cliente pede orcamento de ACESSORIOS ou outros servicos sem preco fixo
  Exemplo: [ESCALAR] Orcamento acessorio — cliente: [nome] | pedido: [descricao] | contacto: [contacto]
- Reclamacoes, devolucoes, reembolsos
- Cliente pede para falar com pessoa
- Situacao que nao consegues resolver

Antes de escalar, recolhe sempre: nome do cliente, contacto e detalhes do pedido.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOM E PERSONALIZACAO POR TIPO DE CLIENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O perfil do cliente (nome, tipo, historico) e injectado pelo core antes deste prompt.
Usa essas informacoes para adaptar o tom:

STD/LJ/OFI (stand, loja, oficina):
- Tom seco, directo, zero floreados
- Confirmar pedido em 1-2 linhas + prazo
- Nao questionar especificacoes se o cliente as deu todas
- Nao cumprimentar extensamente — confirmar e avancar
- Preco de revenda (o core calcula com desconto_pct do tipo)

TAXI/TVDE:
- Tratar pelo nome se conhecido
- Pedidos em bloco sao normais — confirmar todos de uma vez
- Pedir NIF proactivamente se for pedido de frota
- Urgencia e frequente — dar prazo imediato ou dizer quando consegues

VIP:
- Nunca pedir pagamento antecipado — apenas recolher o pedido
- Referenciar "como os anteriores" para confirmar especificacoes
- Nao questionar o obvio — confiam no processo
- Tom confiante, sem rodeios

INTERNET / WORTEN / AMAZON:
- Cliente veio de canal online — pode nao conhecer a loja fisicamente
- Explicar que fabricamos na hora e que pode vir levantar ou combinar envio
- Tom acolhedor, mais orientacao que um cliente presencial

ORCAMENTO:
- Lead que ainda nao comprou — ser mais comercial, ajudar a decidir
- Apresentar 2 opcoes de material, enviar fotos, convidar a visitar a loja

NORMAL / Sem tipo:
- Tom informal, perguntas de qualificacao (borracha ou alcatifa? traseiro inteiro?)
- Explicar o processo se parecer primeiro contacto

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMO APRESENTAR MATERIAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NUNCA listar todos os materiais de uma vez — confunde o cliente.
Apresentar SEMPRE 2 opcoes no maximo, as mais adequadas ao perfil.

RECOMENDACOES FIXAS (usar sempre que o cliente nao especifica):
- Alcatifa → recomendar CANELADO ou VELUDO (nao ECO, nao GTI como primeira opcao)
- Borracha → recomendar TAPETES 3D (chamar "Borracha 3D") como opcao principal
- A Borracha Standard so mencionas como alternativa mais economica

ARGUMENTOS DE VENDA obrigatorios ao apresentar:
CANELADO: "Material premium com textura elegante, muito duravel e facil de limpar. Um dos mais vendidos."
VELUDO: "Acabamento luxuoso, suave ao toque, da um aspecto muito cuidado ao interior."
TAPETES 3D / BORRACHA 3D: "Moldados ao habitaculo da viatura — cobrem o chao todo, sem folgas. A melhor proteccao que existe, especialmente para quem entra com botas ou lama."

Sugestao por tipo de cliente:
- NORMAL / ORCAMENTO / INTERNET → Canelado ou Veludo (com argumentos acima)
- STD/LJ/OFI                    → GTI ou Eco (preco de revenda, sem argumento de venda — directo)
- TAXI/TVDE                     → Tapetes 3D ou GTI (durabilidade e facilidade de limpeza)

Depois de sugerir, o core envia as fotos via [ENVIAR_FOTOS_MATERIAL:material1,material2].
Mencionar que se preferir outro material tambem e possivel.

Se o cliente escolher borracha → apresentar Tapetes 3D primeiro:
"Em borracha temos os Tapetes 3D — moldados ao habitaculo, cobrem o chao todo sem folgas, a melhor proteccao. Temos tambem a Borracha Standard, mais economica. Seguem fotos! [ENVIAR_FOTOS_MATERIAL:TAPETES 3D,BORRACHA]"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRA ABSOLUTA DE PRECOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Usa EXCLUSIVAMENTE os precos da tabela acima (TABELA DE PRECOS EXACTOS).
NUNCA inventes, estimes ou uses valores de memoria — so os da tabela.
Se a tabela nao estiver disponivel, responde:
"Vou confirmar o preco exacto e respondo em breve."
Nao dás qualquer valor sem a tabela carregada.

ESCALAR SEMPRE para preco especial:
- Viaturas 8 ou 9 lugares
- Dacia Jogger, Dacia MCV, Dacia Lodgy
- Malas 3D (dar 65EUR fixo, confirmar sempre com humano antes de fechar)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUPAO AMERICO10 — PARCERIA INFLUENCIADOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Se o cupao AMERICO10 estiver activo (o core injeta esta informacao no contexto):
1. Cumprimentar com saudacao especial e confirmar o desconto
2. Tratar como cliente NORMAL para efeitos de tom e sugestao de material
3. O desconto de 10EUR e aplicado no jogo — o core trata o calculo automaticamente

Resposta de entrada quando o cupao esta activo:
"Ola! 👋 Bem-vindo a Autojulmar! Vi que tens o codigo do Americo — tens 10EUR de desconto no teu jogo de tapetes. Qual e a tua viatura?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXEMPLOS DE RESPOSTA IDEAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[NORMAL — apresentar 2 opcoes]
Cliente: "Tem tapetes para Tesla Model 3 2020?"
Tu: "Temos sim! Por exemplo o Canelado ou o Veludo Preto — seguem fotos. Se preferir borracha tambem temos."

[NORMAL — cliente escolhe borracha]
Cliente: "Quero em borracha."
Tu: "Em borracha temos a Standard ou os Tapetes 3D — muito mais completos. Seguem fotos, diz qual preferes!"

[STD — pedido completo]
Cliente: "Tapetes frente Seat Leon 2018, 3 portas, fixadores, GTI preto, sem reforco"
Tu: "Ok, anotado. Aviso quando estiverem prontos."

[STD — urgencia]
Cliente: "Preciso jogo Ford Fiesta 99, simples sem reforco, urgente"
Tu: "Consigo para hoje a tarde. Aviso assim que estiver pronto."

[VIP — recolher pedido sem pagamento]
Cliente: "Preciso de um jogo para o Audi A4 2022, veludo preto"
Tu: "Anotado! Aviso quando estiver pronto."

[AMERICO10 — entrada]
Cliente: "AMERICO10"
Tu: "Ola! 👋 Bem-vindo a Autojulmar! Tens 10EUR de desconto no teu jogo de tapetes. Qual e a tua viatura?"

[MALA — dar intervalo]
Cliente: "Quanto custa mala para Peugeot 308?"
Tu: "Em GTI fica entre 30EUR e 52EUR dependendo do tamanho. Qual o ano? Confirmo o exacto."

[SEM MOLDE]
Cliente: "Orcamento para Jaecoo J5, borracha"
Tu: "Ainda nao temos molde para esse modelo. E da zona de Lisboa? Podemos marcar visita — jogo base fica 65EUR."`
}

// ─── Keyword SISTEMA ──────────────────────────────────────────────────────────

async function tratarKeywordSistema(tenantId: string, telefone: string): Promise<void> {
  const numeroHumano = obterNumeroHumano()
  const nomeLoja     = process.env.WHATSAPP_LOJA_NOME ?? 'Autojulmar'
  const nomeOwner    = process.env.WHATSAPP_OWNER_NOME ?? 'Matheus'
  const resposta      = `Optimo! O ${nomeOwner} vai entrar em contacto consigo em breve.`

  await enviarComDelay(telefone, resposta)

  if (numeroHumano) {
    await enviarMensagem(numeroHumano,
      `SISTEMA | Lead interessado no sistema ${nomeLoja}. Numero: ${telefone}`)
  }

  const sessao    = await obterSessao(tenantId, telefone)
  const historico = (sessao?.dados?.historico as Msg[] | undefined) ?? []
  historico.push({ role: 'user',      content: 'SISTEMA' })
  historico.push({ role: 'assistant', content: resposta })
  await guardarSessao(tenantId, telefone, { step: 'conversando', dados: { historico } })
  await registarTurnoAgenteJulmar(tenantId, telefone, 'SISTEMA', resposta, 'conversando')
}

// ─── Preview para admin/owner (com confirmacao SIM/NAO) ───────────────────────

async function mostrarPreviewAdmin(
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

  await enviarMensagem(telefone, linhas)
}

// ─── Processamento de pedido de cliente (sem confirmacao) ─────────────────────

async function processarPedidoCliente(
  tenantId: string,
  telefone: string,
  mensagemOriginal: string,
  dados: DadosPedidoPendente,
  historico: Msg[],
  descontoManual: number = 0
): Promise<void> {
  const numeroHumano = obterNumeroHumano()
  const mbway        = process.env.WHATSAPP_MBWAY ?? ''

  // Lookup do tipo de cliente
  const supabase  = criarClienteAdmin()
  const contacto  = String(dados.contacto).replace(/\D/g, '').slice(-9)

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

  // Cria o pedido
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/pedidos`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      clienteNome:     dados.clienteNome,
      clienteContacto: contacto,
      tipoClienteId,
      estadoId:        '',
      dados:           { matricula: dados.matricula ?? '', viatura: dados.viatura ?? '' },
      material:        dados.material,
      tipoTapete:      dados.tipoTapete,
      extras:          dados.extras        ?? [],
      quantidade:      dados.quantidade    ?? 1,
      descontoManual,
      sinal:           0,
      formaPagamento:  dados.formaPagamento ?? 'PAGAR NA ENTREGA',
      origem:          'whatsapp',
    }),
  })

  const resultado = await res.json()

  if (!res.ok) {
    const msgErro = 'Ocorreu um erro ao registar o pedido. A nossa equipa contacta em breve.'
    await enviarComDelay(telefone, msgErro)
    console.error('[Agente Julmar] Erro ao criar pedido de cliente:', resultado)
    await registarTurnoAgenteJulmar(tenantId, telefone, mensagemOriginal, msgErro, 'erro_pedido')
    return
  }

  const valorFinal = Number(resultado.valorFinal)
  const tapetes    = dados.tipoTapete.join(' + ')
  const matricFmt  = dados.matricula
    ? String(dados.matricula).replace(/([A-Z0-9]{2})([A-Z0-9]{2})([A-Z0-9]+)/, '$1-$2-$3')
    : ''

  // Notifica o owner/admin
  if (numeroHumano) {
    const linhasAdmin = [
      `NOVO PEDIDO DE CLIENTE — #${resultado.numeroPedido}`,
      `Cliente: ${dados.clienteNome} | ${contacto} | ${tipoNome}`,
      matricFmt ? `Viatura: ${matricFmt}${dados.viatura ? ' · ' + dados.viatura : ''}` : '',
      `Produto: ${dados.material} · ${tapetes}`,
      `Valor: ${valorFinal.toFixed(2)}EUR`,
    ].filter(Boolean).join('\n')
    await enviarMensagem(numeroHumano, linhasAdmin)
  }

  // Avisa o cliente para aguardar
  const respostasCliente = [
    `Pedido registado. Por favor aguarde enquanto a nossa equipa confirma a disponibilidade.`,
  ]
  await enviarComDelay(telefone, respostasCliente[0])

  // Mensagem de pagamento para nao-VIP
  const ehVip = await verificarEhVip(tenantId, contacto)
  if (!ehVip && mbway) {
    const metade = (valorFinal / 2).toFixed(2)
    const msgPagamento = `O pedido sera processado a partir do pagamento de ${valorFinal.toFixed(2)}EUR (ou 50% = ${metade}EUR) via MBWay: ${mbway}`
    await new Promise(r => setTimeout(r, 2000))
    await enviarMensagem(telefone, msgPagamento)
    respostasCliente.push(msgPagamento)
  }

  // Guarda historico
  historico.push({ role: 'assistant', content: `Pedido #${resultado.numeroPedido} registado.` })
  await guardarSessao(tenantId, telefone, { step: 'pedido_criado', dados: { historico } })
  await registarTurnoAgenteJulmar(
    tenantId,
    telefone,
    mensagemOriginal,
    respostasCliente.join('\n'),
    'pedido_criado',
  )
}

// ─── Confirmacao de pedido (fluxo admin/owner com SIM/NAO) ────────────────────

async function tratarConfirmacao(
  tenantId: string,
  telefone: string,
  mensagem: string,
  dadosPendentes: DadosPedidoPendente
): Promise<void> {
  const respNorm = mensagem.trim().toUpperCase()

  if (['NAO', 'NÃO', 'CANCELAR', 'N', 'NO'].includes(respNorm)) {
    await eliminarSessao(tenantId, telefone)
    const resposta = 'Pedido cancelado.'
    await enviarMensagem(telefone, resposta)
    await registarTurnoAgenteJulmar(tenantId, telefone, mensagem, resposta, 'cancelado')
    return
  }

  if (!['SIM', 'S', 'CONFIRMAR', 'OK'].includes(respNorm)) {
    const resposta = 'Responde SIM para criar o pedido ou NAO para cancelar.'
    await enviarMensagem(telefone, resposta)
    await registarTurnoAgenteJulmar(tenantId, telefone, mensagem, resposta, 'aguarda_confirmacao')
    return
  }

  await eliminarSessao(tenantId, telefone)

  const supabase  = criarClienteAdmin()
  const contacto  = String(dadosPendentes.contacto).replace(/\D/g, '').slice(-9)

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
    const resposta = `Erro ao criar pedido: ${resultado.erro ?? 'tente novamente'}`
    await enviarMensagem(telefone, resposta)
    await registarTurnoAgenteJulmar(tenantId, telefone, mensagem, resposta, 'erro_pedido')
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
  await registarTurnoAgenteJulmar(tenantId, telefone, mensagem, confirmacao, 'pedido_criado')
}

// ─── Entrada principal ────────────────────────────────────────────────────────

export async function processarComAgente(telefone: string, mensagem: string): Promise<void> {
  const tenantSlug   = process.env.WHATSAPP_TENANT_SLUG
  const nomeOwner    = process.env.WHATSAPP_OWNER_NOME ?? 'Matheus'
  const isOwner      = eOwner(telefone)
  const isAdmin      = eAdmin(telefone)

  if (!tenantSlug) { console.error('[Agente Julmar] WHATSAPP_TENANT_SLUG nao configurado'); return }

  const tenant = await resolverTenant(tenantSlug)
  if (!tenant)  { console.error('[Agente Julmar] Tenant nao encontrado:', tenantSlug); return }

  // ── Keyword SISTEMA ──────────────────────────────────────────────────────
  if (mensagem.trim().toUpperCase() === 'SISTEMA') {
    await tratarKeywordSistema(tenant.id, telefone)
    return
  }

  // ── Comandos do owner/admin (prefixo !) ─────────────────────────────────
  if (isAdmin && mensagem.startsWith('!')) {
    const cmd = mensagem.slice(1).trim()

    if (/^instruc[aã]o\s+/i.test(cmd)) {
      const texto = cmd.replace(/^instruc[aã]o\s+/i, '').trim()
      const ok = await guardarInstrucao(tenant.id, texto)
      await enviarMensagem(telefone, ok ? `Instrucao guardada: "${texto}"` : 'Erro ao guardar instrucao. Tente novamente.')
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

    // !pausar NUMERO — pausa o bot manualmente para um numero
    if (/^pausar\s+/i.test(cmd)) {
      const num = cmd.replace(/^pausar\s+/i, '').trim().replace(/\D/g, '')
      if (num) {
        await pausarBot(tenant.id, num)
        await enviarMensagem(telefone, `Bot pausado para ${num}.`)
      }
      return
    }

    // !retomar NUMERO — retoma o bot para um numero apos takeover
    if (/^retomar\s+/i.test(cmd)) {
      const num = cmd.replace(/^retomar\s+/i, '').trim().replace(/\D/g, '')
      if (num) {
        await retomarBot(tenant.id, num)
        await enviarMensagem(telefone, `Bot retomado para ${num}.`)
      }
      return
    }

    await enviarMensagem(telefone,
      'Comandos:\n!instrucao [texto]\n!ver instrucoes\n!limpar instrucoes\n!pausar [numero]\n!retomar [numero]')
    return
  }

  const sessao = await obterSessao(tenant.id, telefone)

  // ── Takeover activo — verifica se expirou, senão fica em silêncio ────────
  if (sessao?.step === 'takeover') {
    const takeoverTtl = Number(process.env.WHATSAPP_TAKEOVER_TTL ?? 7200) * 1000
    const takeoverTs  = (sessao.dados?.takeoverTs as number | undefined) ?? 0
    if (takeoverTs && Date.now() - takeoverTs > takeoverTtl) {
      console.log('[Agente Julmar] Takeover expirado — a retomar bot para:', telefone)
      await retomarBot(tenant.id, telefone)
    } else {
      console.log('[Agente Julmar] Takeover activo — ignorando mensagem de:', telefone)
      return
    }
  }

  // ── Aguarda confirmacao de pedido (fluxo admin/owner) ────────────────────
  if (sessao?.step === 'aguarda_confirmacao') {
    const pendente = sessao.dados?.pedidoPendente as DadosPedidoPendente | undefined
    if (pendente) {
      await tratarConfirmacao(tenant.id, telefone, mensagem, pendente)
      return
    }
  }

  // ── Carrega historico, instrucoes e tabela de preços ────────────────────
  const historico: Msg[] = (sessao?.dados?.historico as Msg[] | undefined) ?? []
  const tipoUtilizador = isOwner ? 'owner' : isAdmin ? 'admin' : 'cliente'

  // Cupão AMERICO10: detecta na 1ª mensagem ou recupera da sessão
  const descontoCupaoSessao = (sessao?.dados?.descontoCupao as number | undefined) ?? 0
  const descontoCupao = descontoCupaoSessao > 0
    ? descontoCupaoSessao
    : (!isOwner && !isAdmin && historico.length === 0 && mensagem.toUpperCase().includes('AMERICO10') ? 10 : 0)

  const primeiraMensagemCliente = tipoUtilizador === 'cliente' && historico.length === 0

  const [instrucoes, tabelaPrecos, perfilCliente, memoriaConversa] = await Promise.all([
    carregarInstrucoes(tenant.id),
    carregarTabelaPrecos(tenant.id),
    (!isOwner && !isAdmin) ? carregarPerfilCliente(tenant.id, telefone) : Promise.resolve(undefined),
    (!isOwner && !isAdmin) ? obterMemoriaConversa(tenant.id, telefone) : Promise.resolve(null),
  ])
  const memoriaCompacta = memoriaParaPrompt(memoriaConversa)

  historico.push({ role: 'user', content: mensagem })
  if (historico.length > MAX_HISTORICO) historico.splice(0, historico.length - MAX_HISTORICO)

  // ── Chama Claude Sonnet ──────────────────────────────────────────────────
  let resposta: string
  const systemPrompt = buildSystemPrompt(
    instrucoes,
    tipoUtilizador,
    nomeOwner,
    tabelaPrecos,
    perfilCliente ?? undefined,
    descontoCupao,
    primeiraMensagemCliente,
    memoriaCompacta
  )

  try {
    resposta = await chamarClaude('claude-sonnet-4-6', systemPrompt, historico)
  } catch (err) {
    console.error('[Agente Julmar] Erro Claude Sonnet:', String(err))

    if (isRateLimitError(err)) {
      try {
        resposta = await chamarClaude('claude-haiku-4-5-20251001', systemPrompt, historico.slice(-6))
      } catch (fallbackErr) {
        console.error('[Agente Julmar] Erro Claude Haiku fallback:', String(fallbackErr))
        await notificarErroAgente(telefone, mensagem, fallbackErr)
        await guardarSessao(tenant.id, telefone, { step: 'escalado', dados: { historico } })
        const msgFallback = 'Recebemos a sua mensagem. Estamos com muito movimento neste momento, mas a nossa equipa vai acompanhar o seu pedido em breve.'
        await enviarComDelay(telefone, msgFallback)
        await registarTurnoAgenteJulmar(tenant.id, telefone, mensagem, msgFallback, 'escalado')
        return
      }
    } else {
      await notificarErroAgente(telefone, mensagem, err)
      const msgErro = 'Problema tecnico. A nossa equipa contacta em breve.'
      await enviarComDelay(telefone, msgErro)
      await registarTurnoAgenteJulmar(tenant.id, telefone, mensagem, msgErro, sessao?.step ?? 'erro')
      return
    }
  }

  // ── Pedido pendente ──────────────────────────────────────────────────────
  if (resposta.startsWith('[PEDIDO_PENDENTE]')) {
    const jsonStr = resposta.replace('[PEDIDO_PENDENTE]', '').trim()
    try {
      const dados = JSON.parse(jsonStr) as DadosPedidoPendente
      historico.push({ role: 'assistant', content: resposta })

      if (isOwner || isAdmin) {
        // Admin/owner: mostra preview e pede confirmacao
        await mostrarPreviewAdmin(tenant.id, telefone, dados, historico)
      } else {
        // Cliente: cria pedido, notifica admin, envia mensagem de pagamento
        await processarPedidoCliente(tenant.id, telefone, mensagem, dados, historico, descontoCupao)
      }
    } catch {
      console.error('[Agente Julmar] JSON invalido no PEDIDO_PENDENTE:', jsonStr)
      await guardarSessao(tenant.id, telefone, { step: 'conversando', dados: { historico } })
      const msgErro = isOwner || isAdmin
        ? 'Nao consegui processar o pedido. Pode repetir os dados?'
        : 'Ocorreu um problema. A nossa equipa contacta em breve.'
      if (isOwner || isAdmin) await enviarMensagem(telefone, msgErro)
      else await enviarComDelay(telefone, msgErro)
      await registarTurnoAgenteJulmar(tenant.id, telefone, mensagem, msgErro, 'conversando')
    }
    return
  }

  // ── Envio de fotos de material ───────────────────────────────────────────
  const markerMatch = resposta.match(/\[ENVIAR_FOTOS_MATERIAL(?::([^\]]*))?\]/)
  if (markerMatch) {
    const filtro     = markerMatch[1]?.trim() // ex: "GTI PRETO,GTI CINZA" ou undefined
    const textoLimpo = resposta.replace(markerMatch[0], '').trim()
    historico.push({ role: 'assistant', content: textoLimpo })
    const dadosSessaoFotos = descontoCupao > 0 ? { historico, descontoCupao } : { historico }
    await guardarSessao(tenant.id, telefone, { step: 'conversando', dados: dadosSessaoFotos })

    if (isOwner || isAdmin) {
      await enviarMensagem(telefone, textoLimpo)
    } else {
      await enviarComDelay(telefone, textoLimpo)
    }
    await enviarFotosMaterial(telefone, filtro)
    await registarTurnoAgenteJulmar(
      tenant.id,
      telefone,
      mensagem,
      textoLimpo,
      'conversando',
    )
    return
  }

  // ── Escalamento ──────────────────────────────────────────────────────────
  if (resposta.startsWith('[ESCALAR]')) {
    const motivo = resposta.replace('[ESCALAR]', '').trim()
    await notificarTodosAdmins(`ORCAMENTO/ESCALAMENTO\nCliente: ${telefone}\n${motivo}`)
    const msgEscalar = 'Vou passar o seu pedido a nossa equipa, que entra em contacto para confirmar o orcamento.'
    await enviarComDelay(telefone, msgEscalar)
    historico.push({ role: 'assistant', content: resposta })
    await guardarSessao(tenant.id, telefone, { step: 'escalado', dados: { historico } })
    await registarTurnoAgenteJulmar(tenant.id, telefone, mensagem, msgEscalar, 'escalado')
    return
  }

  // ── Resposta normal ──────────────────────────────────────────────────────
  historico.push({ role: 'assistant', content: resposta })
  const dadosSessao = descontoCupao > 0 ? { historico, descontoCupao } : { historico }
  await guardarSessao(tenant.id, telefone, { step: 'conversando', dados: dadosSessao })

  if (isOwner || isAdmin) {
    await enviarMensagem(telefone, resposta)
  } else {
    await enviarComDelay(telefone, resposta)
  }
  await registarTurnoAgenteJulmar(tenant.id, telefone, mensagem, resposta, 'conversando')
}
