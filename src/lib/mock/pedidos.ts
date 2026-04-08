// Dados mock para desenvolvimento — substitui por Supabase na integração real

export interface PedidoListagem {
  id: string
  numeroPedido: number
  nomeCliente: string
  matricula: string
  material: string
  tipoTapete: string
  estado: string
  corEstado: string
  valorFinal: number
  data: string
}

export const pedidosMock: PedidoListagem[] = [
  {
    id: '1',
    numeroPedido: 2001,
    nomeCliente: 'Jorge Silva',
    matricula: 'AG-14-GH',
    material: 'ECO PRETO',
    tipoTapete: 'JOGO',
    estado: 'Pronto',
    corEstado: '#10b981',
    valorFinal: 24.65,
    data: '27/03/2026',
  },
  {
    id: '2',
    numeroPedido: 2002,
    nomeCliente: 'Maria Costa',
    matricula: 'XX-00-XX',
    material: 'GTI PRETO',
    tipoTapete: 'JOGO EM 4',
    estado: 'Em produção',
    corEstado: '#f59e0b',
    valorFinal: 55.25,
    data: '27/03/2026',
  },
  {
    id: '3',
    numeroPedido: 2000,
    nomeCliente: 'António Ferreira',
    matricula: 'AB-12-CD',
    material: 'ECO PRETO',
    tipoTapete: 'FRENTES',
    estado: 'Entregue',
    corEstado: '#6366f1',
    valorFinal: 11.90,
    data: '26/03/2026',
  },
]
