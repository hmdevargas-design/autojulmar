import { describe, expect, it } from 'vitest'
import { resolverJanelaRelatorio } from './route'

function requestFor(query: string) {
  return { nextUrl: new URL(`https://example.test/api?${query}`) }
}

describe('brain report window', () => {
  const now = new Date('2026-08-13T12:00:00.000Z')

  it('supports a protected historical range', () => {
    const result = resolverJanelaRelatorio(
      requestFor('from=2026-07-29T00:00:00.000Z&to=2026-08-12T00:00:00.000Z'),
      now,
    )
    expect(result.historical).toBe(true)
    expect(result.since.toISOString()).toBe('2026-07-29T00:00:00.000Z')
    expect(result.until.toISOString()).toBe('2026-08-12T00:00:00.000Z')
  })

  it('rejects ranges longer than 31 days', () => {
    expect(() => resolverJanelaRelatorio(
      requestFor('from=2026-06-01T00:00:00.000Z&to=2026-08-01T00:00:00.000Z'),
      now,
    )).toThrow(/31 dias/)
  })

  it('keeps the rolling window capped at seven days', () => {
    const result = resolverJanelaRelatorio(requestFor('hours=999'), now)
    expect(result.historical).toBe(false)
    expect(result.since.toISOString()).toBe('2026-08-06T12:00:00.000Z')
  })
})
