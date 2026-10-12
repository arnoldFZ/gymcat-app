// GYMPACT — the points ledger: an append-only, auditable list of movements.
//
// Design constraints from the brief:
//  - Every movement has id, event type, delta, a reference, a date, an idempotency
//    key and minimal metadata.
//  - Processing the same event twice must never double the points. That is enforced
//    by the key, not by a mutable balance: `applyEvents` refuses a key it has seen.
//  - Corrections are compensated, never erased. Deleting a workout appends a
//    balancing movement (`comp:<key>`) instead of removing the original.
//
// The storage is a JSON array inside the profile state (`S.gam.ledger`), which is
// synced last-write-wins. We do not pretend that is transactional: instead we make
// every write idempotent, so re-sending a whole state (or reconciling two devices)
// converges instead of double-counting. See docs/GYMPACT_AUDIT.md §6.

import { weekKeyOf } from './weekly-goals.js'
import { compensationKey } from './events.js'

let seq = 0
function newId() {
  seq = (seq + 1) % 100000
  return 'led_' + Date.now().toString(36) + '_' + seq.toString(36) + Math.random().toString(36).slice(2, 6)
}

export const entries = ledger => (Array.isArray(ledger) ? ledger : [])

export function hasKey(ledger, key) {
  return entries(ledger).some(e => e.key === key)
}
export function entriesForKey(ledger, key) {
  return entries(ledger).filter(e => e.key === key)
}
export function balance(ledger) {
  return entries(ledger).reduce((n, e) => n + (+e.delta || 0), 0)
}

// Append every event whose key is not already present. Pure: returns a new array.
export function applyEvents(ledger, events, now) {
  const out = entries(ledger).slice()
  const ts = new Date(now == null ? Date.now() : now).toISOString()
  for (const ev of events || []) {
    if (!ev || !ev.key) continue
    if (out.some(e => e.key === ev.key)) continue
    out.push({
      id: ev.id || newId(),
      type: ev.type,
      delta: +ev.delta || 0,
      key: ev.key,
      ref: ev.ref || {},
      meta: ev.meta || {},
      date: ev.date || ts
    })
  }
  return out
}

// Build the compensating movements for everything logged under `key` (e.g. a
// deleted workout's session points). Returns events for `applyEvents`, or [] when
// there is nothing to undo or it was already compensated — so calling it twice is
// safe. Weekly/cycle bonuses are intentionally NOT reversed: they were legitimately
// earned when the week reached its target, and the brief forbids rewriting history.
export function compensateEvents(ledger, key, now) {
  const original = entriesForKey(ledger, key)
  if (!original.length) return []
  const compKey = compensationKey(key)
  if (hasKey(ledger, compKey)) return []
  const total = original.reduce((n, e) => n + (+e.delta || 0), 0)
  if (total === 0) return []
  return [{
    type: 'compensation',
    delta: -total,
    key: compKey,
    ref: { compensates: key },
    meta: {},
    date: new Date(now == null ? Date.now() : now).toISOString()
  }]
}

// Positive points earned within a given week (in `tz`), by the movement's own date.
export function pointsEarnedInWeek(ledger, weekKey, tz) {
  return entries(ledger)
    .filter(e => (+e.delta || 0) > 0 && weekKeyOf(Date.parse(e.date) || 0, tz) === weekKey)
    .reduce((n, e) => n + (+e.delta || 0), 0)
}

// All redemption movements, newest last (the ledger's natural order).
export function redemptionEntries(ledger) {
  return entries(ledger).filter(e => e.type === 'redeem')
}
