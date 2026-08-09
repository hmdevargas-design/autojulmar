import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('operational scheduler configuration', () => {
  it('keeps only the daily report in Vercel cron', () => {
    const config = JSON.parse(read('vercel.json')) as {
      crons: Array<{ path: string; schedule: string }>
    }

    expect(config.crons).toEqual([
      { path: '/api/relatorio-diario', schedule: '5 0 * * *' },
    ])
  })

  it('keeps the WhatsApp workflow manual without a scheduled trigger', () => {
    const workflow = read('.github/workflows/whatsapp-outbox-worker.yml')

    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toMatch(/^\s*schedule:/m)
    expect(workflow).toContain('/api/whatsapp/outbox/process')
  })

  it('uses a configurable 30-second local print poller with single-instance protection', () => {
    const script = read('scripts/imprimir-auto.ps1')

    expect(script).toContain('$defaultPollSeconds = 30')
    expect(script).toContain('AUTOJULMAR_PRINT_POLL_SECONDS')
    expect(script).toContain("'Local\\AutojulmarImpressao'")
    expect(script).toContain('$overlapMinutes = 2')
    expect(script).toContain('$state.pendentes')
    expect(script).toContain('$state.concluidos')
    expect(script).toContain('$knownIds.ContainsKey')
  })

  it('polls only during configurable shop hours and keeps off-hours orders queued by the cursor', () => {
    const script = read('scripts/imprimir-auto.ps1')
    const installer = read('scripts/instalar-impressao-auto.ps1')
    const businessHoursCheck = script.indexOf('if (-not (Test-BusinessHours -Now $now))')
    const apiCall = script.indexOf('Invoke-RestMethod -Uri $recentUrl')

    expect(script).toContain('function Get-NextBusinessOpening')
    expect(script).toContain("$openingValue")
    expect(script).toContain("$state.cursor")
    expect(businessHoursCheck).toBeGreaterThan(-1)
    expect(apiCall).toBeGreaterThan(businessHoursCheck)
    expect(installer).toContain("hora_abertura = $defaultOpeningTime")
    expect(installer).toContain("hora_fecho = $defaultClosingTime")
    expect(installer).toContain('horario_comercial_ativo = $defaultBusinessHoursEnabled')
  })

  it('keeps the database claim protected by row locks', () => {
    const migration = read('supabase/migrations/015_whatsapp_outbox.sql')

    expect(migration).toContain('FOR UPDATE SKIP LOCKED')
    expect(migration).toContain("SET status       = 'locked'")
    expect(migration).toContain('locked_until = NOW()')
  })
})
