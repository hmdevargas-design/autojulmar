// Parser LLM — interpreta mensagens em linguagem natural e extrai campos do pedido
// Usa Claude Haiku (rápido e barato) via Anthropic SDK

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface CamposExtraidos {
  clienteNome:   string | null
  contacto:      string | null   // 9 dígitos
  matricula:     string | null   // normalizada sem hífens
  viatura:       string | null
  material:      string | null
  tipoTapete:    string[]
  extras:        string[]
  quantidade:    number
  formaPagamento: string | null
}

export async function parsearMensagem(
  mensagem: string,
  materiais: string[],
  tiposTapete: string[],
  extrasDisponiveis: string[]
): Promise<CamposExtraidos> {

  const prompt = `Analisa esta mensagem de um operador de uma oficina de tapetes de automóvel e extrai os campos indicados em JSON.

MENSAGEM: "${mensagem}"

CAMPOS A EXTRAIR:
- clienteNome: nome do cliente (string ou null)
- contacto: número de telefone português, apenas 9 dígitos, sem espaços ou hífens (string ou null)
- matricula: matrícula do carro, apenas letras e números sem hífens em maiúsculas (string ou null)
- viatura: marca e modelo do carro se mencionado (string ou null)
- material: um dos seguintes EXACTAMENTE como está escrito: ${materiais.join(' · ')} (string ou null)
- tipoTapete: array com um ou mais dos seguintes EXACTAMENTE como estão escritos: ${tiposTapete.join(' · ')} (array, pode ser vazio)
- extras: array com um ou mais dos seguintes EXACTAMENTE como estão escritos: ${extrasDisponiveis.join(' · ')} (array, pode ser vazio)
- quantidade: número inteiro, default 1
- formaPagamento: um de PAGO · PAGAR NA ENTREGA · ENVIO A COBRANÇA · TRANSFERENCIA (string ou null, default null)

REGRAS:
- Para material e tipoTapete, faz correspondência aproximada (ex: "eco preto" → "ECO PRETO", "jogo" → "JOGO", "jogo em 4" → "JOGO EM 4")
- Se o número tiver 9 dígitos após remover espaços/hífens, é o contacto
- Matrícula: formato XX-00-XX ou XX-00-0X ou 00-XX-XX — extrai só os caracteres alfanuméricos em maiúsculas
- Se não conseguires extrair um campo, põe null (ou [] para arrays)

Responde APENAS com JSON válido, sem explicações.`

  const resposta = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages:   [{ role: 'user', content: prompt }],
  })

  const texto = resposta.content[0].type === 'text' ? resposta.content[0].text : '{}'

  // Extrai o JSON da resposta (pode vir com markdown)
  const jsonMatch = texto.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return camposVazios()

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      clienteNome:    parsed.clienteNome    ?? null,
      contacto:       parsed.contacto       ?? null,
      matricula:      parsed.matricula      ?? null,
      viatura:        parsed.viatura        ?? null,
      material:       parsed.material       ?? null,
      tipoTapete:     Array.isArray(parsed.tipoTapete) ? parsed.tipoTapete : [],
      extras:         Array.isArray(parsed.extras)     ? parsed.extras     : [],
      quantidade:     Number(parsed.quantidade)        || 1,
      formaPagamento: parsed.formaPagamento ?? null,
    }
  } catch {
    return camposVazios()
  }
}

function camposVazios(): CamposExtraidos {
  return {
    clienteNome: null, contacto: null, matricula: null, viatura: null,
    material: null, tipoTapete: [], extras: [], quantidade: 1, formaPagamento: null,
  }
}
