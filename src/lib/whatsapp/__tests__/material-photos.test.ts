import { describe, expect, it } from 'vitest'
import { selecionarFotosMaterial } from '../material-photos'

function nomes(filtro?: string, mensagem?: string): string[] {
  return selecionarFotosMaterial(filtro, mensagem).map(material => material.nome)
}

describe('fotos aprovadas do Agente Julmar', () => {
  it('envia apenas o catalogo base aprovado quando o pedido e generico', () => {
    expect(nomes('TODOS', 'Quais materiais tem?')).toEqual([
      'ECO PRETO',
      'GTI PRETO',
      'CANELADO',
      'VELUDO PRETO',
      'BORRACHA PIT',
    ])
  })

  it('envia Borracha Pit e Tapetes 3D num pedido de borracha', () => {
    expect(nomes(
      'BORRACHA,TAPETES 3D,MALAS 3D',
      'Quero tapetes em borracha.',
    )).toEqual(['BORRACHA PIT', 'TAPETES 3D'])
  })

  it('considera o pedido de borracha feito no turno anterior', () => {
    expect(nomes(
      'TAPETES 3D',
      'Quero em borracha.\nSim, envie as fotografias.',
    )).toEqual(['TAPETES 3D'])
  })

  it('envia Malas 3D apenas quando o cliente pede mala', () => {
    expect(nomes('MALAS 3D', 'Preciso de tapete para a mala.'))
      .toEqual(['MALAS 3D'])
    expect(nomes('MALAS 3D', 'Quero ver materiais para o habitaculo.'))
      .toEqual([])
  })

  it('nao substitui materiais antigos ou desconhecidos pelo catalogo completo', () => {
    expect(nomes('GTI CINZA,VELUDO CINZA,CINZA CABRIO', 'Mostre as fotos.'))
      .toEqual([])
    expect(nomes('MATERIAL DESCONHECIDO', 'Mostre as fotos.')).toEqual([])
  })
})
