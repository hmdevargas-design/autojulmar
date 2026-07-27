export interface MensagemHistorico {
  role: 'user' | 'assistant'
  content: string
}

export function normalizarRespostaWhatsapp(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?;,:\s]+$/g, '')
    .trim()
}

export function respostaExisteNoHistorico(
  texto: string,
  historico: MensagemHistorico[],
  limite = 8,
): boolean {
  const alvo = normalizarRespostaWhatsapp(texto)
  if (!alvo) return false

  return historico
    .filter(item => item.role === 'assistant')
    .slice(-Math.max(1, limite))
    .some(item => normalizarRespostaWhatsapp(item.content) === alvo)
}

export function mensagemEhCortesia(texto: string): boolean {
  const normalizada = normalizarRespostaWhatsapp(texto)
  return /^((ok )?(muito )?obrigad[oa]|ok|certo|combinado|perfeito|entendido|fico a aguardar|esta bem|ta bem|de acordo)$/
    .test(normalizada)
}

function hashCurto(valor: string): string {
  let hash = 2166136261
  for (let i = 0; i < valor.length; i += 1) {
    hash ^= valor.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function chaveIdempotenciaResposta(
  telefone: string,
  texto: string,
  source: string,
  janelaSegundos: number,
  agoraMs = Date.now(),
): string {
  const numero = telefone.replace(/\D/g, '')
  const janelaMs = Math.max(60, janelaSegundos) * 1000
  const bucket = Math.floor(agoraMs / janelaMs)
  const conteudo = normalizarRespostaWhatsapp(texto)
  return `reply:${source}:${numero}:${bucket}:${hashCurto(conteudo)}`
}
