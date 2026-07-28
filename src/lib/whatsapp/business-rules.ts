const TIME_ZONE = 'Europe/Lisbon'
const MORNING_OPEN = 9 * 60 + 30
const MORNING_CLOSE = 13 * 60
const AFTERNOON_OPEN = 15 * 60
const AFTERNOON_CLOSE = 18 * 60

interface LisbonClock {
  date: string
  weekday: string
  minutes: number
}

export interface EstadoHorarioAutojulmar {
  date: string
  minutes: number
  open: boolean
  extraordinaryClosure: boolean
  period: 'before-opening' | 'morning' | 'lunch' | 'afternoon' | 'after-closing' | 'weekend'
}

function clockEmLisboa(data: Date): LisbonClock {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data)
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    weekday: 'short',
  }).format(data)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(data)
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0)

  return { date, weekday, minutes: hour * 60 + minute }
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function fechaExtraordinariamente(date: string, minutes: number): boolean {
  return date === '2026-07-29' && minutes < AFTERNOON_OPEN
}

function mencionaAmanhaOu29Julho(texto: string, agora: Date): boolean {
  const normalizado = normalizar(texto)
  if (/\b29[\/.-]0?7(?:[\/.-](?:20)?26)?\b/.test(normalizado)) return true
  if (!/\b(amanha|tomorrow)\b/.test(normalizado)) return false

  const amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000)
  return clockEmLisboa(amanha).date === '2026-07-29'
}

function pedeHorario(texto: string): boolean {
  const normalizado = normalizar(texto)
  return /\b(horario|horarios|aberto|aberta|abertos|abertas|abrem|abre|fechado|fechada|fechados|fechadas|fecha|open|opened|closed|opening|closing|hours)\b/
    .test(normalizado)
}

function indicaVisita(texto: string): boolean {
  const normalizado = normalizar(texto)
  return /\b(estou a caminho|vamos a caminho|vou ai|vou a loja|vou para a loja|irei ai|irei a loja|chego ai|chegar ai|passar na loja|visitar a loja|esperar por mim|esperem por mim|coming|on my way|come in|visit the (?:shop|store|office)|wait for me|waiting for me|see you soon|in \d+\s*min|em \d+\s*min)\b/
    .test(normalizado)
}

function respostaPrometeAtendimentoForaDeHoras(texto: string): boolean {
  const normalizado = normalizar(texto)
  return /\b(estamos abertos|estaremos abertos|ficamos a espera|vamos esperar|esperamos por si|pode vir|venha quando quiser|ate ja|we are open|we're open|we will wait|we'll wait|we will be here|we'll be here|waiting for you|come in|come whenever|see you soon)\b/
    .test(normalizado)
}

function mensagemEmIngles(texto: string): boolean {
  return /\b(open|closed|coming|wait|tomorrow|hours|visit|shop|store|office|see you)\b/i
    .test(texto)
}

function respostaHorario(
  tipo: 'tomorrow-closure' | 'today-closure' | 'closed' | 'open-morning' | 'open-afternoon',
  english: boolean,
): string {
  if (english) {
    switch (tipo) {
      case 'tomorrow-closure':
        return 'Tomorrow, 29/07, we will be exceptionally closed in the morning. We reopen at 3:00 pm and close as usual at 6:00 pm.'
      case 'today-closure':
        return 'We are exceptionally closed this morning. We reopen at 3:00 pm and close at 6:00 pm.'
      case 'closed':
        return 'The shop is closed now. Our hours are Monday to Friday, 9:30 am-1:00 pm and 3:00 pm-6:00 pm; we cannot serve customers after 6:00 pm.'
      case 'open-afternoon':
        return 'We are open now, but we close strictly at 6:00 pm and cannot wait or serve customers after that time.'
      default:
        return 'We are open now. Our hours are Monday to Friday, 9:30 am-1:00 pm and 3:00 pm-6:00 pm.'
    }
  }

  switch (tipo) {
    case 'tomorrow-closure':
      return 'Amanhã, 29/07, estaremos excecionalmente fechados de manhã. Reabrimos às 15h e fechamos normalmente às 18h.'
    case 'today-closure':
      return 'Estamos excecionalmente fechados durante a manhã de hoje. Reabrimos às 15h e fechamos às 18h.'
    case 'closed':
      return 'A loja está fechada neste momento. O horário é de segunda a sexta-feira, das 9h30 às 13h e das 15h às 18h; não atendemos depois das 18h.'
    case 'open-afternoon':
      return 'Estamos abertos neste momento, mas fechamos impreterivelmente às 18h e não conseguimos esperar depois desse horário.'
    default:
      return 'Estamos abertos neste momento. O horário é de segunda a sexta-feira, das 9h30 às 13h e das 15h às 18h.'
  }
}

export function estadoHorarioAutojulmar(agora = new Date()): EstadoHorarioAutojulmar {
  const clock = clockEmLisboa(agora)
  const weekday = clock.weekday.toLowerCase()
  const workingDay = !weekday.startsWith('sat') && !weekday.startsWith('sun')
  const extraordinaryClosure = fechaExtraordinariamente(clock.date, clock.minutes)

  if (!workingDay) {
    return {
      date: clock.date,
      minutes: clock.minutes,
      open: false,
      extraordinaryClosure: false,
      period: 'weekend',
    }
  }

  if (clock.minutes < MORNING_OPEN) {
    return {
      date: clock.date,
      minutes: clock.minutes,
      open: false,
      extraordinaryClosure,
      period: 'before-opening',
    }
  }
  if (clock.minutes < MORNING_CLOSE) {
    return {
      date: clock.date,
      minutes: clock.minutes,
      open: !extraordinaryClosure,
      extraordinaryClosure,
      period: 'morning',
    }
  }
  if (clock.minutes < AFTERNOON_OPEN) {
    return {
      date: clock.date,
      minutes: clock.minutes,
      open: false,
      extraordinaryClosure,
      period: 'lunch',
    }
  }
  if (clock.minutes < AFTERNOON_CLOSE) {
    return {
      date: clock.date,
      minutes: clock.minutes,
      open: true,
      extraordinaryClosure: false,
      period: 'afternoon',
    }
  }

  return {
    date: clock.date,
    minutes: clock.minutes,
    open: false,
    extraordinaryClosure: false,
    period: 'after-closing',
  }
}

export function instrucoesHorarioAutojulmar(agora = new Date()): string {
  const regras = [
    '- Horario fixo: segunda a sexta-feira, das 9h30 as 13h e das 15h as 18h.',
    '- A loja fecha sempre as 18h. Nunca prometas esperar, receber ou atender clientes depois das 18h.',
    '- A loja nao abre aos sabados nem aos domingos.',
  ]

  if (clockEmLisboa(agora).date <= '2026-07-29') {
    regras.push(
      '- Fecho extraordinario: quarta-feira, 29/07/2026, a loja estara fechada de manha e reabrira as 15h. O fecho mantem-se as 18h.',
    )
  }

  regras.push(
    '- Fora destas excecoes, nao inventes feriados, prolongamentos ou alteracoes de horario.',
  )

  return regras.join('\n')
}

export function respostaDeterministicaHorarioAutojulmar(
  mensagemCliente: string,
  agora = new Date(),
): string | null {
  if (!pedeHorario(mensagemCliente) && !indicaVisita(mensagemCliente)) return null

  const english = mensagemEmIngles(mensagemCliente)
  if (mencionaAmanhaOu29Julho(mensagemCliente, agora)) {
    return respostaHorario('tomorrow-closure', english)
  }

  const estado = estadoHorarioAutojulmar(agora)
  if (estado.extraordinaryClosure) {
    return respostaHorario('today-closure', english)
  }
  if (!estado.open) {
    return respostaHorario('closed', english)
  }
  if (estado.period === 'afternoon') {
    return respostaHorario('open-afternoon', english)
  }

  return respostaHorario('open-morning', english)
}

export function aplicarGuardrailHorarioAutojulmar(
  resposta: string,
  mensagemCliente: string,
  agora = new Date(),
): string {
  const respostaDeterministica = respostaDeterministicaHorarioAutojulmar(
    mensagemCliente,
    agora,
  )
  if (respostaDeterministica) return respostaDeterministica

  if (respostaPrometeAtendimentoForaDeHoras(resposta)) {
    const estado = estadoHorarioAutojulmar(agora)
    const english = mensagemEmIngles(mensagemCliente) || mensagemEmIngles(resposta)
    if (estado.open && estado.period === 'afternoon') {
      return respostaHorario('open-afternoon', english)
    }
    if (estado.open) {
      return respostaHorario('open-morning', english)
    }
    if (estado.extraordinaryClosure) {
      return respostaHorario('today-closure', english)
    }
    return respostaHorario('closed', english)
  }

  return resposta
}
