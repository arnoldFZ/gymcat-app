import { describe, it, expect } from 'vitest'
import {
  ledgerAfterFinish, ledgerAfterDelete, ledgerAfterCorrect, redeem,
  balance, familyNet, sessionKey, hasKey, weekBonusKey, redemptionHistory
} from '../index.js'

const at = iso => Date.parse(iso)
const DAY = 86400000
const doneSet = () => ({ w: 60, r: 5, done: true })
const wAt = (id, ms, d) => ({ id, d, start: ms, end: ms, entries: [{ id: 'bench', sets: [doneSet()] }] })
const emptyS = () => ({ workouts: [], gam: { ledger: [], rewards: [] } })

// Mirror of what doFinishWorkout does with the store.
function finish(S, w) { S.workouts.push(w); S.gam.ledger = ledgerAfterFinish(S, w) }

describe('flow: finishing sessions', () => {
  it('awards session points, the weekly bonus at 3, and never duplicates on re-finish', () => {
    const S = emptyS()
    const base = at('2026-01-05T15:00:00Z')   // Mon, Lima week 2026-W02
    finish(S, wAt('a', base, '2026-01-05'))
    finish(S, wAt('b', base + DAY, '2026-01-06'))
    expect(balance(S.gam.ledger)).toBe(200)
    finish(S, wAt('c', base + 2 * DAY, '2026-01-07'))
    expect(balance(S.gam.ledger)).toBe(450)
    expect(hasKey(S.gam.ledger, weekBonusKey('2026-W02'))).toBe(true)

    // Re-running the third finish (same id) is a no-op.
    S.gam.ledger = ledgerAfterFinish(S, S.workouts[2])
    expect(balance(S.gam.ledger)).toBe(450)
  })
})

describe('flow: correcting and deleting a session', () => {
  it('moves net points with validity and stays coherent across correct → delete', () => {
    const S = emptyS()
    finish(S, wAt('w1', at('2026-01-05T15:00:00Z'), '2026-01-05'))
    expect(balance(S.gam.ledger)).toBe(100)

    const invalid = { ...S.workouts[0], entries: [{ id: 'bench', sets: [{ w: 60, r: 5, done: false }] }] }
    S.gam.ledger = ledgerAfterCorrect(S, invalid)
    expect(familyNet(S.gam.ledger, sessionKey('w1'))).toBe(0)

    // Restore it, then delete — the whole family nets to zero.
    S.gam.ledger = ledgerAfterCorrect(S, S.workouts[0])
    expect(familyNet(S.gam.ledger, sessionKey('w1'))).toBe(100)
    S.gam.ledger = ledgerAfterDelete(S, S.workouts[0])
    expect(balance(S.gam.ledger)).toBe(0)
    // Deleting twice does not double-compensate.
    S.gam.ledger = ledgerAfterDelete(S, S.workouts[0])
    expect(balance(S.gam.ledger)).toBe(0)
  })

  it('a corrected-out session does not reverse an already-earned weekly bonus', () => {
    const S = emptyS()
    const base = at('2026-01-05T15:00:00Z')
    ;[0, 1, 2].forEach(i => finish(S, wAt('w' + i, base + i * DAY, '2026-01-05')))
    expect(balance(S.gam.ledger)).toBe(450)

    // Invalidate one of the three: it loses its 100, the week bonus stands.
    const invalid = { ...S.workouts[2], entries: [{ id: 'bench', sets: [{ w: 60, r: 5, done: false }] }] }
    S.gam.ledger = ledgerAfterCorrect(S, invalid)
    expect(balance(S.gam.ledger)).toBe(350)
    expect(hasKey(S.gam.ledger, weekBonusKey('2026-W02'))).toBe(true)
  })
})

describe('flow: redeeming', () => {
  // High weekly target so session points don't trigger a bonus we'd have to reason about.
  const withPoints = (n, cost = 100) => {
    const S = { workouts: [], gam: { rules: { weeklyTarget: 99 }, ledger: [], rewards: [{ id: 'r1', name: 'Café', cost, active: true }] } }
    const base = at('2026-01-05T15:00:00Z')
    for (let i = 0; i < n; i++) { const w = wAt('s' + i, base + i * DAY, '2026-01-05'); S.workouts.push(w); S.gam.ledger = ledgerAfterFinish(S, w) }
    return S
  }

  it('a double tap (same redemption id) never charges twice', () => {
    const S = withPoints(3)
    expect(balance(S.gam.ledger)).toBe(300)
    const first = redeem(S, 'r1', 'rd-1')
    expect(first.ok).toBe(true)
    S.gam.ledger = first.ledger
    expect(balance(S.gam.ledger)).toBe(200)

    const second = redeem(S, 'r1', 'rd-1')
    expect(second.ok).toBe(true)
    expect(second.duplicate).toBe(true)
    S.gam.ledger = second.ledger
    expect(balance(S.gam.ledger)).toBe(200)
    expect(redemptionHistory(S)).toHaveLength(1)
  })

  it('a second redemption is blocked once the balance is gone', () => {
    const S = withPoints(1)
    S.gam.ledger = redeem(S, 'r1', 'rd-1').ledger
    expect(balance(S.gam.ledger)).toBe(0)

    const next = redeem(S, 'r1', 'rd-2')
    expect(next.ok).toBe(false)
    expect(next.reason).toBe('insufficient')
    expect(next.ledger).toBeUndefined()
  })
})
