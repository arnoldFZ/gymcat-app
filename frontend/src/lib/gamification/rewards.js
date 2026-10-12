// GYMPACT — a personal, editable reward catalog.
//
// Rewards are the user's own (a coffee, a rest day, new socks…); the app never
// imposes rígid prizes. A redemption is a normal ledger movement (negative delta),
// so balance, history and idempotency all come from the ledger — there is no
// separate editable "spendable" counter to drift out of sync.

import { balance, hasKey, entries } from './ledger.js'
import { redeemEvent, redeemKey } from './events.js'

export const rewardsCatalog = S => (S && S.gam && Array.isArray(S.gam.rewards) ? S.gam.rewards : [])

export const activeRewards = S => rewardsCatalog(S).filter(r => r && r.active !== false)

export function findReward(S, id) {
  return rewardsCatalog(S).find(r => r && r.id === id) || null
}

export function canRedeem(S, reward) {
  return !!reward && reward.active !== false && balance(S && S.gam && S.gam.ledger) >= (+reward.cost || 0)
}

// The next reward worth showing on the dashboard: the cheapest active one still
// out of reach, or — if everything is affordable — the dearest one you can get
// right now. Null when the catalog has no active entries.
export function nextReward(S) {
  const active = activeRewards(S).slice().sort((a, b) => (+a.cost || 0) - (+b.cost || 0))
  if (!active.length) return null
  const bal = balance(S && S.gam && S.gam.ledger)
  return active.find(r => (+r.cost || 0) > bal) || active[active.length - 1]
}

// Attempt a redemption. `redemptionId` is generated once per confirmation by the
// caller; retrying with the same id is a successful no-op, so a double tap or a
// re-sent state can never charge twice. Returns the events to apply.
export function tryRedeem(S, rewardId, redemptionId) {
  const reward = findReward(S, rewardId)
  if (!reward || reward.active === false) return { ok: false, reason: 'unavailable', events: [] }
  const ledger = S && S.gam && S.gam.ledger
  if (hasKey(ledger, redeemKey(redemptionId))) return { ok: true, duplicate: true, events: [] }
  if (balance(ledger) < (+reward.cost || 0)) return { ok: false, reason: 'insufficient', events: [] }
  return { ok: true, events: [redeemEvent(reward, redemptionId)] }
}

// Redemption history from the ledger, with the reward name kept in `meta` so it
// still reads correctly after the reward is renamed or removed from the catalog.
export function redemptionHistory(S) {
  return entries(S && S.gam && S.gam.ledger)
    .filter(e => e.type === 'redeem')
    .map(e => ({ ...e, rewardId: e.ref && e.ref.rewardId, name: (e.meta && e.meta.name) || (findReward(S, e.ref && e.ref.rewardId) || {}).name || '' }))
}
