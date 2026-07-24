export interface FotoMaterialAprovada {
  nome: string
  caminho: string
  categoria: 'alcatifa' | 'borracha' | 'mala'
}

const FOTOS_BASE: FotoMaterialAprovada[] = [
  { nome: 'ECO PRETO', caminho: '/materiais/eco-preto.jpg', categoria: 'alcatifa' },
  { nome: 'GTI PRETO', caminho: '/materiais/gti-preto.jpg', categoria: 'alcatifa' },
  { nome: 'CANELADO', caminho: '/materiais/canelado.jpg', categoria: 'alcatifa' },
  { nome: 'VELUDO PRETO', caminho: '/materiais/veludo-preto.jpg', categoria: 'alcatifa' },
  { nome: 'BORRACHA PIT', caminho: '/images/borracha-pit.jpg', categoria: 'borracha' },
]

const TAPETES_3D: FotoMaterialAprovada = {
  nome: 'TAPETES 3D',
  caminho: '/materiais/tapetes-3d.jpg',
  categoria: 'borracha',
}

const MALAS_3D: FotoMaterialAprovada = {
  nome: 'MALAS 3D',
  caminho: '/materiais/malas-3d.jpg',
  categoria: 'mala',
}

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function materialPorToken(token: string): FotoMaterialAprovada | null {
  switch (normalizar(token)) {
    case 'ECO':
    case 'ECO PRETO':
      return FOTOS_BASE[0]
    case 'GTI':
    case 'GTI PRETO':
      return FOTOS_BASE[1]
    case 'CANELADO':
      return FOTOS_BASE[2]
    case 'VELUDO':
    case 'VELUDO PRETO':
      return FOTOS_BASE[3]
    case 'BORRACHA':
    case 'BORRACHA STANDARD':
    case 'BORRACHA PIT':
      return FOTOS_BASE[4]
    case 'TAPETE 3D':
    case 'TAPETES 3D':
      return TAPETES_3D
    case 'MALA 3D':
    case 'MALAS 3D':
      return MALAS_3D
    default:
      return null
  }
}

function mensagemPedeBorracha(mensagem: string): boolean {
  const texto = normalizar(mensagem)
  return /\b(BORRACHA|RUBBER|TAPETE 3D|TAPETES 3D)\b/.test(texto)
}

function mensagemPedeMala(mensagem: string): boolean {
  const texto = normalizar(mensagem)
  return /\b(MALA|MALAS|BAGAGEIRA|PORTA BAGAGENS|PORTA-BAGAGENS)\b/.test(texto)
}

export function selecionarFotosMaterial(
  filtro?: string,
  mensagemCliente = '',
): FotoMaterialAprovada[] {
  const pedeBorracha = mensagemPedeBorracha(mensagemCliente)
  const pedeMala = mensagemPedeMala(mensagemCliente)
  const filtroNormalizado = normalizar(filtro ?? '')

  if (!filtroNormalizado || filtroNormalizado === 'TODOS') {
    if (pedeMala) return [MALAS_3D]
    if (pedeBorracha) return [FOTOS_BASE[4], TAPETES_3D]
    return FOTOS_BASE
  }

  const vistos = new Set<string>()
  return filtro
    ?.split(',')
    .map(materialPorToken)
    .filter((material): material is FotoMaterialAprovada => {
      if (!material || vistos.has(material.nome)) return false
      if (material === TAPETES_3D && !pedeBorracha) return false
      if (material === MALAS_3D && !pedeMala) return false
      vistos.add(material.nome)
      return true
    }) ?? []
}
