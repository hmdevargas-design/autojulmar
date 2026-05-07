// Agente de atendimento WhatsApp — Claude Sonnet
// Representa a Autojulmar sem se identificar como IA
// Suporta: delay humano, admin parcial, audio, instrucoes dinamicas, palavra-chave SISTEMA

import Anthropic from '@anthropic-ai/sdk'
import { enviarMensagem, enviarImagem }                  from './sender'
import { obterSessao, guardarSessao, eliminarSessao }    from './session'
import { resolverTenant }                                from '@/lib/tenant/resolver'
import { criarClienteAdmin }                             from '@/lib/supabase/admin'

const claude              = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MAX_HISTORICO       = 14
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
  const supabase  = criarClienteAdmin()
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
    console.error('[Agente] Erro ao guardar instrucao:', error.message, error.code)
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
): Promise<{ nome: string | null; tipoNome: string | null }> {
  const supabase  = criarClienteAdmin()
  const contactoN = telefone.replace(/\D/g, '').slice(-9)
  const { data }  = await supabase
    .from('clientes')
    .select('nome, tipos_cliente ( nome )')
    .eq('tenant_id', tenantId)
    .eq('contacto', contactoN)
    .single()
  return {
    nome:     (data?.nome as string | null) ?? null,
    tipoNome: (data?.tipos_cliente as unknown as { nome: string } | null)?.nome ?? null,
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

function buildSystemPrompt(
  instrucoes:      string,
  tipoUtilizador:  'owner' | 'admin' | 'cliente',
  nomeOwner:       string,
  tabelaPrecos:    string,
  perfilCliente?:  { nome: string | null; tipoNome: string | null },
  descontoCupao?:  number
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

  const secaoPerfilCliente = (tipoUtilizador === 'cliente' && perfilCliente?.tipoNome)
    ? `\nPERFIL DO CLIENTE (injectado pelo core):\n- Tipo: ${perfilCliente.tipoNome}${perfilCliente.nome ? `\n- Nome: ${perfilCliente.nome}` : ''}\n`
    : ''

  const secaoCupao = (descontoCupao && descontoCupao > 0)
    ? `\nCUPAO ACTIVO: AMERICO10 — desconto de ${descontoCupao}EUR aplicado no jogo\n`
    : ''

  return `${secaoUtilizador}${secaoPerfilCliente}${secaoCupao}Representas a ${nomeLoja}, loja de tapetes personalizados para automovel em Loures, Portugal.

IDENTIDADE:
- Nunca digas que es uma IA, robot, assistente virtual, chatbot ou sistema automatico
- Se perguntarem o que es ou se es um bot/IA/robot/humano, responde EXACTAMENTE com:
  "Sou o assistente da ${nomeLoja}! Um sistema criado pelo ${nomeOwner} para responder mais rapido e gerir os pedidos da loja. Se tiver curiosidade sobre o sistema ou quiser saber como funciona, escreva SISTEMA que aviso o ${nomeOwner} para entrar em contacto consigo."
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
5. Nunca uses as palavras: IA, inteligencia artificial, bot, chatbot, assistente virtual, sistema automatico

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

  await enviarComDelay(telefone,
    `Optimo! O ${nomeOwner} vai entrar em contacto consigo em breve.`)

  if (numeroHumano) {
    await enviarMensagem(numeroHumano,
      `SISTEMA | Lead interessado no sistema ${nomeLoja}. Numero: ${telefone}`)
  }

  const sessao    = await obterSessao(tenantId, telefone)
  const historico = (sessao?.dados?.historico as Msg[] | undefined) ?? []
  historico.push({ role: 'user',      content: 'SISTEMA' })
  historico.push({ role: 'assistant', content: `Optimo! O ${nomeOwner} vai entrar em contacto consigo em breve.` })
  await guardarSessao(tenantId, telefone, { step: 'conversando', dados: { historico } })
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
    await enviarComDelay(telefone, 'Ocorreu um erro ao registar o pedido. A nossa equipa contacta em breve.')
    console.error('[Agente] Erro ao criar pedido de cliente:', resultado)
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
  await enviarComDelay(telefone,
    `Pedido registado. Por favor aguarde enquanto a nossa equipa confirma a disponibilidade.`)

  // Mensagem de pagamento para nao-VIP
  const ehVip = await verificarEhVip(tenantId, contacto)
  if (!ehVip && mbway) {
    const metade = (valorFinal / 2).toFixed(2)
    await new Promise(r => setTimeout(r, 2000))
    await enviarMensagem(telefone,
      `O pedido sera processado a partir do pagamento de ${valorFinal.toFixed(2)}EUR (ou 50% = ${metade}EUR) via MBWay: ${mbway}`)
  }

  // Guarda historico
  historico.push({ role: 'assistant', content: `Pedido #${resultado.numeroPedido} registado.` })
  await guardarSessao(tenantId, telefone, { step: 'pedido_criado', dados: { historico } })
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
    await enviarMensagem(telefone, 'Pedido cancelado.')
    return
  }

  if (!['SIM', 'S', 'CONFIRMAR', 'OK'].includes(respNorm)) {
    await enviarMensagem(telefone, 'Responde SIM para criar o pedido ou NAO para cancelar.')
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
      console.log('[Agente] Takeover expirado — a retomar bot para:', telefone)
      await retomarBot(tenant.id, telefone)
    } else {
      console.log('[Agente] Takeover activo — ignorando mensagem de:', telefone)
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

  const [instrucoes, tabelaPrecos, perfilCliente] = await Promise.all([
    carregarInstrucoes(tenant.id),
    carregarTabelaPrecos(tenant.id),
    (!isOwner && !isAdmin) ? carregarPerfilCliente(tenant.id, telefone) : Promise.resolve(undefined),
  ])

  historico.push({ role: 'user', content: mensagem })
  if (historico.length > MAX_HISTORICO) historico.splice(0, historico.length - MAX_HISTORICO)

  // ── Chama Claude Sonnet ──────────────────────────────────────────────────
  let resposta: string
  try {
    const res = await claude.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 500,
      system:     buildSystemPrompt(instrucoes, tipoUtilizador, nomeOwner, tabelaPrecos, perfilCliente ?? undefined, descontoCupao),
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

      if (isOwner || isAdmin) {
        // Admin/owner: mostra preview e pede confirmacao
        await mostrarPreviewAdmin(tenant.id, telefone, dados, historico)
      } else {
        // Cliente: cria pedido, notifica admin, envia mensagem de pagamento
        await processarPedidoCliente(tenant.id, telefone, dados, historico, descontoCupao)
      }
    } catch {
      console.error('[Agente] JSON invalido no PEDIDO_PENDENTE:', jsonStr)
      await guardarSessao(tenant.id, telefone, { step: 'conversando', dados: { historico } })
      const msgErro = isOwner || isAdmin
        ? 'Nao consegui processar o pedido. Pode repetir os dados?'
        : 'Ocorreu um problema. A nossa equipa contacta em breve.'
      if (isOwner || isAdmin) await enviarMensagem(telefone, msgErro)
      else await enviarComDelay(telefone, msgErro)
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
    return
  }

  // ── Escalamento ──────────────────────────────────────────────────────────
  if (resposta.startsWith('[ESCALAR]')) {
    const motivo = resposta.replace('[ESCALAR]', '').trim()
    await notificarTodosAdmins(`ORCAMENTO/ESCALAMENTO\nCliente: ${telefone}\n${motivo}`)
    await enviarComDelay(telefone, 'Vou passar o seu pedido a nossa equipa, que entra em contacto para confirmar o orcamento.')
    historico.push({ role: 'assistant', content: resposta })
    await guardarSessao(tenant.id, telefone, { step: 'escalado', dados: { historico } })
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
}
