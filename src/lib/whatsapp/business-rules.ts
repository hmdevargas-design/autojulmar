const FECHO_EXTRAORDINARIO = '2026-07-27'

function dataEmLisboa(data: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data)
}

export function instrucoesHorarioAutojulmar(agora = new Date()): string {
  const regras = [
    '- A loja nao abre aos sabados. Nao existem excepcoes de abertura ao sabado.',
  ]

  if (dataEmLisboa(agora) <= FECHO_EXTRAORDINARIO) {
    regras.push(
      '- Fecho extraordinario: a loja estara fechada na segunda-feira, 27/07/2026.',
    )
  }

  regras.push(
    '- Para outros dias, usa apenas o horario configurado e nao inventes feriados ou excepcoes.',
  )

  return regras.join('\n')
}
