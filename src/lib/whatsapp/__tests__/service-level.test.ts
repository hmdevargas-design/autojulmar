import { describe, expect, it } from 'vitest'
import {
  aplicarPoliticaRespostaPrimaria,
  instrucaoNivelPrimario,
  obterNivelServicoAgenteJulmar,
} from '../service-level'

describe('Agente Julmar service level', () => {
  it('defaults to the conservative primary level', () => {
    expect(obterNivelServicoAgenteJulmar(undefined)).toBe('primary')
    expect(obterNivelServicoAgenteJulmar('PRIMARY')).toBe('primary')
    expect(obterNivelServicoAgenteJulmar('full')).toBe('full')
  })

  it('adds primary constraints only for customers', () => {
    expect(instrucaoNivelPrimario('primary', 'cliente')).toContain('ATENDIMENTO PRIMARIO CONTROLADO')
    expect(instrucaoNivelPrimario('primary', 'owner')).toBe('')
    expect(instrucaoNivelPrimario('full', 'cliente')).toBe('')
  })

  it('allows safe qualification and approved material photos', () => {
    const resposta = 'Qual e a marca, o modelo e o ano da viatura?\n[ENVIAR_FOTOS_MATERIAL:TAPETES 3D,BORRACHA]'
    expect(aplicarPoliticaRespostaPrimaria('primary', resposta)).toBe(resposta)
  })

  it.each([
    'O jogo fica por 72 EUR.',
    'O prazo normal e de 5 dias.',
    'Consigo ter os tapetes prontos hoje.',
    'O seu pedido esta disponivel para levantamento.',
    'Tem 10% de desconto.',
  ])('escalates sensitive generated claims: %s', resposta => {
    expect(aplicarPoliticaRespostaPrimaria('primary', resposta)).toMatch(/^\[ESCALAR\]/)
  })

  it('prevents automatic order creation in primary mode', () => {
    expect(aplicarPoliticaRespostaPrimaria('primary', '[PEDIDO_PENDENTE]\n{}'))
      .toContain('confirmar dados')
  })

  it('keeps full mode unchanged', () => {
    const resposta = 'O jogo fica por 72 EUR.'
    expect(aplicarPoliticaRespostaPrimaria('full', resposta)).toBe(resposta)
  })
})
