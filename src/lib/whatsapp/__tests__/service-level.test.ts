import { describe, expect, it } from 'vitest'
import {
  aplicarPoliticaRespostaPrimaria,
  instrucaoNivelPrimario,
  obterNivelServicoAgenteJulmar,
  validarAmbienteDryRunPrimario,
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

  it('turns an inferred seat count into a confirmation question', () => {
    const resposta = 'A Renault Grand Scenic e uma carrinha de 7 lugares. Pretende o jogo completo?'
    expect(aplicarPoliticaRespostaPrimaria(
      'primary',
      resposta,
      'Quero tapetes para Renault Grand Scenic 2018.',
    )).toBe('A sua viatura tem 7 lugares? Pretende os tapetes para todos os lugares?')
    expect(aplicarPoliticaRespostaPrimaria(
      'primary',
      resposta,
      'Tenho uma Renault Grand Scenic 2018 de 7 lugares.',
    )).toBe(resposta)
  })

  it('removes customer-facing text before an escalation marker', () => {
    const resposta = 'Vou confirmar disponibilidade e valor.\n\n[ESCALAR] Orcamento completo para a equipa.'
    expect(aplicarPoliticaRespostaPrimaria('primary', resposta, 'Qual e o valor?'))
      .toBe('[ESCALAR] Orcamento completo para a equipa.')
  })

  it('removes unsupported availability wording and unsolicited emoji', () => {
    const resposta = 'Ola! \u{1F44B} Temos tapetes para o Peugeot 308. Prefere **borracha** ou **alcatifa**?'
    expect(aplicarPoliticaRespostaPrimaria(
      'primary',
      resposta,
      'Ola, gostaria de tapetes para um Peugeot 308.',
    )).toBe('Ola! Posso ajudar a confirmar tapetes para o Peugeot 308. Prefere *borracha* ou *alcatifa*?')
  })

  it('keeps emoji when the customer used emoji first', () => {
    const resposta = 'Ola! \u{1F44B} Como posso ajudar?'
    expect(aplicarPoliticaRespostaPrimaria('primary', resposta, 'Ola \u{1F44B}'))
      .toBe(resposta)
  })

  it('keeps full mode unchanged', () => {
    const resposta = 'O jogo fica por 72 EUR.'
    expect(aplicarPoliticaRespostaPrimaria('full', resposta)).toBe(resposta)
  })

  it('requires every dry-run safety flag and an authorized number', () => {
    const env = {
      WHATSAPP_AGENT_ENABLED: 'false',
      WHATSAPP_SEND_ENABLED: 'false',
      WHATSAPP_OUTBOX_DRY_RUN: 'true',
      WHATSAPP_OBSERVER_MODE: 'true',
      WHATSAPP_DRY_RUN_NUMEROS: '351916958780',
    }

    expect(validarAmbienteDryRunPrimario(env, '351916958780')).toBeNull()
    expect(validarAmbienteDryRunPrimario(
      { ...env, WHATSAPP_SEND_ENABLED: 'true' },
      '351916958780',
    )).toContain('WHATSAPP_SEND_ENABLED')
    expect(validarAmbienteDryRunPrimario(env, '351999000222'))
      .toContain('fora de WHATSAPP_DRY_RUN_NUMEROS')
  })
})
