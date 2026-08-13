export const AUTOJULMAR_KNOWLEDGE_VERSION = '2026-08-13.1'

const VERSAO_DESATIVADA = 'disabled'

export function versaoConhecimentoAutojulmar(
  configured = process.env.WHATSAPP_KNOWLEDGE_VERSION,
): string {
  if (configured?.trim() === VERSAO_DESATIVADA) return VERSAO_DESATIVADA
  return AUTOJULMAR_KNOWLEDGE_VERSION
}

export function conhecimentoAprovadoAutojulmarParaPrompt(
  configured = process.env.WHATSAPP_KNOWLEDGE_VERSION,
): string {
  const version = versaoConhecimentoAutojulmar(configured)
  if (version === VERSAO_DESATIVADA) return ''

  return `
CONHECIMENTO APROVADO DO TENANT (versao ${version}):
- Fonte: cards material-comparison-autojulmar e vehicle-quote-flow-autojulmar, aprovados por Matheus via Codex.
- Comeca por distinguir borracha de alcatifa e apresenta no maximo duas opcoes de cada vez.
- Fotografias aprovadas: Eco Preto, GTI Preto, Canelado, Veludo Preto, Borracha Pit, Tapetes 3D e Malas 3D apenas quando o pedido for de mala/bagageira.
- Nunca uses fotografias de GTI Cinza, Veludo Cinza, Cinza Cabrio ou Borracha Standard.
- Para orcamento, reutiliza os dados ja fornecidos e pede apenas marca, modelo, ano, lugares quando relevante, partes pretendidas, configuracao em 3/4 pecas quando relevante e material.
- Usa o numero desta conversa como contacto. Nao voltes a pedi-lo sem necessidade.
- Varias viaturas devem ser organizadas separadamente.
- No nivel primary, recolhe e resume; preco, desconto, molde, prazo, disponibilidade e criacao de pedido exigem confirmacao humana.
- Nao inventes caracteristicas tecnicas nem equivalencia ao material original.
`
}

