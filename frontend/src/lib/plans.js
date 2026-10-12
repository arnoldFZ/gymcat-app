// Ready-made training templates ("suggestions"). Each is a small, opinionated week
// the user can load in one tap from Home, Plan or Settings, then edit freely.
//
// Design choices:
//  · The 3-day plans map onto GYMPACT's weekly goal (3 valid sessions), so the first
//    week is already a winnable target.
//  · Names/notes are English source strings run through `t()` at LOAD time, so the
//    routines a Spanish user gets are named in Spanish.
//  · Exercise ids are verified against the real catalogue by a test — a template can
//    never reference an exercise that doesn't exist.
import { uid } from './format.js'
import { t } from './i18n.js'

// schedule is indexed by Date.getDay(): 0=Sun … 6=Sat → routine index (or null).
// ex entries are [exerciseId, sets, reps].
const T = {
  fullBody: {
    key: 'full-body',
    name: 'Full body · 3 days',
    note: 'Three full-body sessions a week — lines up with the 3-session weekly goal.',
    glyph: 'barbell',
    schedule: [null, 0, null, 1, null, 2, null],   // Mon / Wed / Fri
    routines: [
      { name: 'Full body A', emoji: 'barbell', ex: [['0043', 3, 8], ['0025', 3, 8], ['0027', 3, 10], ['0464', 3, 12]] },
      { name: 'Full body B', emoji: 'dumbbell', ex: [['0085', 3, 8], ['0289', 3, 10], ['2330', 3, 10], ['0334', 3, 15]] },
      { name: 'Full body C', emoji: 'machine', ex: [['1760', 3, 12], ['0091', 3, 10], ['0180', 3, 12], ['0031', 3, 12], ['0201', 3, 12]] }
    ]
  },
  ppl: {
    key: 'ppl',
    name: 'Push / Pull / Legs · 3 days',
    note: 'The classic split, three days: chest & shoulders, back & arms, legs.',
    glyph: 'dumbbell',
    schedule: [null, 0, null, 1, null, 2, null],
    routines: [
      { name: 'Push', emoji: 'dumbbell', ex: [['0025', 4, 8], ['0047', 3, 10], ['0426', 3, 10], ['0334', 3, 12], ['0241', 3, 12], ['0251', 3, 10]] },
      { name: 'Pull', emoji: 'pullup', ex: [['2330', 4, 10], ['0027', 4, 8], ['1323', 3, 10], ['0031', 3, 10], ['0313', 3, 12]] },
      { name: 'Legs', emoji: 'legs', ex: [['0043', 4, 8], ['0085', 3, 10], ['0739', 3, 12], ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 15]] }
    ]
  },
  upperLower: {
    key: 'upper-lower',
    name: 'Upper / Lower · 4 days',
    note: 'Four sessions: two upper, two lower — for when three days feel short.',
    glyph: 'figureStrength',
    schedule: [null, 0, 1, null, 2, 3, null],     // Mon / Tue / Thu / Fri
    routines: [
      { name: 'Upper A', emoji: 'figureStrength', ex: [['0025', 4, 8], ['0027', 4, 10], ['0091', 3, 10], ['2330', 3, 10], ['0031', 3, 12], ['0201', 3, 12]] },
      { name: 'Lower A', emoji: 'legs', ex: [['0043', 4, 8], ['0085', 3, 10], ['1372', 4, 15], ['0585', 3, 12], ['0472', 3, 12]] },
      { name: 'Upper B', emoji: 'figureStrength', ex: [['0047', 4, 8], ['0289', 3, 10], ['0180', 4, 10], ['0178', 3, 15], ['0313', 3, 12], ['0129', 3, 12]] },
      { name: 'Lower B', emoji: 'legs', ex: [['0032', 3, 5], ['0054', 3, 10], ['0496', 3, 12], ['1372', 3, 15], ['0464', 3, 12]] }
    ]
  },
  beginner: {
    key: 'beginner',
    name: 'Beginner · 3 days',
    note: 'A gentle first month: machines and bodyweight, three days a week.',
    glyph: 'machine',
    schedule: [null, 0, null, 1, null, 2, null],
    routines: [
      { name: 'Beginner A', emoji: 'machine', ex: [['1760', 3, 10], ['0289', 3, 10], ['2330', 3, 12], ['0464', 3, 12]] },
      { name: 'Beginner B', emoji: 'machine', ex: [['1459', 3, 10], ['0289', 3, 10], ['0180', 3, 12], ['0334', 3, 15]] },
      { name: 'Beginner C', emoji: 'machine', ex: [['1760', 3, 10], ['0091', 3, 10], ['2330', 3, 12], ['0201', 3, 12]] }
    ]
  },
  fullBody2: {
    key: 'full-body-2',
    name: 'Full body · 2 days',
    note: 'Two sessions a week — the minimum that still moves the needle.',
    glyph: 'barbell',
    schedule: [null, 0, null, null, 1, null, null],   // Mon / Thu
    routines: [
      { name: 'Full body A', emoji: 'barbell', ex: [['0043', 3, 8], ['0025', 3, 8], ['0027', 3, 10], ['0091', 3, 10], ['0464', 3, 12]] },
      { name: 'Full body B', emoji: 'dumbbell', ex: [['0085', 3, 8], ['0289', 3, 10], ['2330', 3, 10], ['0334', 3, 15], ['0031', 3, 12]] }
    ]
  },
  bro5: {
    key: 'bro-5',
    name: 'Classic split · 5 days',
    note: 'One muscle group a day, Monday to Friday.',
    glyph: 'figureStrength',
    schedule: [null, 0, 1, 2, 3, 4, null],           // Mon–Fri
    routines: [
      { name: 'Chest', emoji: 'figureStrength', ex: [['0025', 4, 8], ['0047', 3, 10], ['0289', 3, 10], ['0308', 3, 12], ['0577', 3, 12]] },
      { name: 'Back', emoji: 'pullup', ex: [['0032', 3, 5], ['2330', 4, 10], ['0027', 4, 10], ['0180', 3, 12], ['0238', 3, 12]] },
      { name: 'Shoulders', emoji: 'barbell', ex: [['0091', 4, 8], ['0334', 4, 15], ['0203', 3, 15], ['0310', 3, 12]] },
      { name: 'Legs', emoji: 'legs', ex: [['0043', 4, 8], ['0085', 3, 10], ['0599', 3, 12], ['0585', 3, 12], ['1372', 4, 15]] },
      { name: 'Arms', emoji: 'arm', ex: [['0031', 4, 10], ['0313', 3, 12], ['0060', 4, 10], ['0201', 3, 12]] }
    ]
  },
  ppl6: {
    key: 'ppl-6',
    name: 'Push / Pull / Legs · 6 days',
    note: 'The split twice a week, Monday to Saturday — only if you recover well.',
    glyph: 'dumbbell',
    schedule: [null, 0, 1, 2, 0, 1, 2],              // Mon–Sat: P P L P P L
    routines: [
      { name: 'Push', emoji: 'dumbbell', ex: [['0025', 4, 8], ['0047', 3, 10], ['0426', 3, 10], ['0334', 3, 12], ['0241', 3, 12], ['0251', 3, 10]] },
      { name: 'Pull', emoji: 'pullup', ex: [['2330', 4, 10], ['0027', 4, 8], ['1323', 3, 10], ['0031', 3, 10], ['0313', 3, 12]] },
      { name: 'Legs', emoji: 'legs', ex: [['0043', 4, 8], ['0085', 3, 10], ['0739', 3, 12], ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 15]] }
    ]
  }
}

// Order shown to the user; the beginner plan first so a new profile starts gently,
// then increasing number of days (2 → 6) so "more days" is easy to pick.
export const PLAN_TEMPLATES = [T.beginner, T.fullBody2, T.fullBody, T.ppl, T.upperLower, T.bro5, T.ppl6]

// Build fresh routines (new ids) + the week schedule for a template. Names are
// translated now, so the stored routines read in the user's current language.
export function buildTemplate(tpl) {
  const routines = tpl.routines.map(r => ({
    id: uid(),
    name: t(r.name),
    emoji: r.emoji,
    ex: r.ex.map(([id, sets, reps]) => ({ id, sets, reps, weight: 0 }))
  }))
  const week = {}
  tpl.schedule.forEach((ri, day) => { if (ri != null && routines[ri]) week[day] = routines[ri].id })
  return { routines, week }
}

// Every exercise id a template references, for validation/tests.
export const templateExerciseIds = tpl =>
  tpl.routines.flatMap(r => r.ex.map(([id]) => id))
