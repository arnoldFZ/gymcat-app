// GYMPACT gamification — domain rules (pure, no React, no store).
//
// The product goal is CONSTANCY, not volume: points reward finishing valid
// sessions and hitting a weekly goal, never weight moved, calories or duration.
// All values below are configurable defaults living inside the profile state
// (`S.gam.rules`), merged over these on read so an old profile without them
// still works and a user can tune them later.

export const DEFAULT_RULES = {
  sessionPoints: 100,   // per valid finished session
  weeklyTarget: 3,      // sessions needed to fulfil a week
  weeklyBonus: 150,     // when the week's target is reached
  cycleWeeks: 4,        // consecutive fulfilled weeks for the cycle bonus
  cycleBonus: 300,      // when a 4-week cycle is completed
  tz: 'America/Lima',   // weeks are defined in this zone, not the device's
  // Bumped whenever the scoring semantics above change, so every ledger movement
  // records which rule set produced it and past points stay explainable.
  ruleVersion: 1
}

// Merge the profile's overrides over the defaults. `S.gam.rules` is optional and
// may be partially set, so this is a shallow overlay, not a replace.
export function rulesOf(S) {
  const over = S && S.gam && S.gam.rules ? S.gam.rules : null
  return over ? { ...DEFAULT_RULES, ...over } : { ...DEFAULT_RULES }
}

// A session only counts when it was finished and actually logged something:
// at least one exercise entry with at least one completed set. This mirrors how
// `doFinishWorkout` builds a workout (entries are filtered to those with a done
// set), but stays explicit so the criterion is testable and can't silently drift.
export function isValidSession(w) {
  if (!w || !Array.isArray(w.entries)) return false
  return w.entries.some(e => Array.isArray(e.sets) && e.sets.some(s => s && s.done))
}
