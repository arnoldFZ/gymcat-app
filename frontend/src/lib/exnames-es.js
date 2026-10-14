// Rule-based Spanish translation of the exercise catalogue names.
//
// The dataset ships English names only (instructions are localized elsewhere, names are
// not). This turns them into readable Spanish with a curated phrase + word dictionary and
// a small "peel the leading modifiers" pass, so "barbell incline bench press" becomes
// "Press de banca (mancuerna, inclinado)" instead of an unreadable word salad.
//
// It is deliberately conservative: unknown words are left as-is, so a name is never worse
// than the original — at most partly translated. Pure + memoised.

const PHRASES = [
  // longest first so "overhead triceps extension" wins over "triceps extension"
  ['overhead triceps extension', 'extensión de tríceps sobre la cabeza'],
  ['bulgarian split squat', 'sentadilla búlgara'],
  ['romanian deadlift', 'peso muerto rumano'],
  ['stiff leg deadlift', 'peso muerto con piernas rígidas'],
  ['full range of motion', 'rango completo'],
  ['range of motion', 'rango de movimiento'],
  ['leg extension', 'extensión de cuádriceps'],
  ['leg curl', 'curl femoral'],
  ['leg press', 'prensa de piernas'],
  ['lat pulldown', 'jalón al pecho'],
  ['overhead press', 'press militar'],
  ['military press', 'press militar'],
  ['shoulder press', 'press de hombros'],
  ['chest press', 'press de pecho'],
  ['bench press', 'press de banca'],
  ['floor press', 'press en el suelo'],
  ['push press', 'push press'],
  ['calf raise', 'elevación de gemelos'],
  ['calf press', 'prensa de gemelos'],
  ['lateral raise', 'elevaciones laterales'],
  ['front raise', 'elevación frontal'],
  ['rear delt row', 'remo posterior'],
  ['rear delt', 'deltoides posterior'],
  ['upright row', 'remo al mentón'],
  ['bent over row', 'remo inclinado'],
  ['seated row', 'remo sentado'],
  ['triceps extension', 'extensión de tríceps'],
  ['biceps curl', 'curl de bíceps'],
  ['bicep curl', 'curl de bíceps'],
  ['hammer curl', 'curl martillo'],
  ['preacher curl', 'curl en banco Scott'],
  ['concentration curl', 'curl concentrado'],
  ['wrist curl', 'curl de muñeca'],
  ['side bend', 'flexión lateral'],
  ['front plank', 'plancha frontal'],
  ['side plank', 'plancha lateral'],
  ['plank with twist', 'plancha con giro'],
  ['leg raise', 'elevación de pierna'],
  ['knee raise', 'elevación de rodilla'],
  ['arm raise', 'elevación de brazo'],
  ['triceps pushdown', 'extensión de tríceps'],
  ['good morning', 'buenos días'],
  ['hip thrust', 'empuje de cadera'],
  ['glute bridge', 'puente de glúteos'],
  ['hack squat', 'sentadilla hack'],
  ['front squat', 'sentadilla frontal'],
  ['goblet squat', 'sentadilla goblet'],
  ['split squat', 'sentadilla dividida'],
  ['full squat', 'sentadilla completa'],
  ['face pull', 'face pull'],
  ['shrug', 'encogimiento de hombros'],
  ['pull-up', 'dominadas'],
  ['chin-up', 'dominadas supinas'],
  ['push-up', 'flexiones'],
  ['sit-up', 'abdominales'],
  ['step-up', 'subida al cajón'],
  ['pushdown', 'extensión de tríceps'],
  ['pullover', 'pullover'],
  ['kickback', 'patada'],
  ['deadlift', 'peso muerto'],
  ['pulldown', 'jalón'],
  ['squat', 'sentadilla'],
  ['lunge', 'zancada'],
  ['crunch', 'encogimientos'],
  ['plank', 'plancha'],
  ['twist', 'giro'],
  ['rotation', 'rotación'],
  ['bridge', 'puente'],
  ['stretch', 'estiramiento'],
  ['clean', 'cargada'],
  ['snatch', 'arrancada'],
  ['hold', 'sostén'],
  ['jump', 'salto'],
  ['run', 'carrera'],
  ['row', 'remo'],
  ['dip', 'fondos'],
  ['fly', 'aperturas'],
  ['raise', 'elevación'],
  ['press', 'press'],
  ['curl', 'curl'],
  ['extension', 'extensión'],
  ['exercise', 'ejercicio'],
  ['(male)', '(hombre)'],
  ['(female)', '(mujer)'],
  ['male', 'hombre'],
  ['female', 'mujer'],
  ['with towel', 'con toalla'],
  ['with band', 'con banda'],
  ['with weight', 'con peso']
]

const WORDS = {
  chest: 'pecho', back: 'espalda', shoulder: 'hombro',
  biceps: 'bíceps', bicep: 'bíceps', triceps: 'tríceps', tricep: 'tríceps',
  hamstring: 'isquios', hamstrings: 'isquios', glute: 'glúteo', glutes: 'glúteos',
  hip: 'cadera', knee: 'rodilla', knees: 'rodillas', neck: 'cuello', wrist: 'muñeca',
  head: 'cabeza', toe: 'dedos del pie', calf: 'gemelo', delt: 'deltoides', delts: 'deltoides',
  leg: 'pierna', legs: 'piernas', arm: 'brazo', arms: 'brazos', lat: 'dorsal', lats: 'dorsales',
  abdominal: 'abdominal', abs: 'abdominales', core: 'core', spine: 'columna', groin: 'ingle',
  bar: 'barra', ball: 'balón', bench: 'banco', machine: 'máquina', band: 'banda', rope: 'cuerda',
  sled: 'trineo', roller: 'rodillo', wheel: 'rueda', pulley: 'polea', plate: 'disco',
  lateral: 'lateral', rear: 'posterior', front: 'frontal', overhead: 'sobre la cabeza',
  incline: 'inclinado', decline: 'declinado', flat: 'plano', bent: 'inclinado',
  straight: 'recto', single: 'unilateral', alternating: 'alterno', alternate: 'alterno',
  wide: 'ancho', narrow: 'estrecho', high: 'alto', low: 'bajo', parallel: 'paralelo',
  prone: 'boca abajo', supine: 'boca arriba', kneel: 'de rodillas', kneeling: 'de rodillas',
  standing: 'de pie', seated: 'sentado', lying: 'tumbado', hanging: 'colgado',
  floor: 'suelo', wall: 'pared', medicine: 'medicinal', stability: 'estabilidad',
  grip: 'agarre', reverse: 'inverso', close: 'cerrado', hands: 'manos', hand: 'mano',
  with: 'con',
  cross: 'cruzado', forward: 'adelante', backward: 'atrás', together: 'juntos',
  twist: 'giro', side: 'lateral', walk: 'caminata', bike: 'bici', push: 'empuje',
  pull: 'tirón', squat: 'sentadilla', sprint: 'sprint',
  one: 'a una', two: 'a dos', full: 'completo', half: 'media', deep: 'profundo',
  weighted: 'con peso', assisted: 'asistido', bodyweight: 'peso corporal'
}

// Leading modifiers peeled off and re-appended in parentheses (English word order is
// adjective-first; Spanish reads better with the qualifier at the end).
const LEAD = [
  ['smith machine', 'máquina Smith'], ['ez barbell', 'barra EZ'], ['resistance band', 'banda elástica'],
  ['medicine ball', 'balón medicinal'], ['stability ball', 'fitball'], ['exercise ball', 'fitball'],
  ['barbell', 'barra'], ['dumbbell', 'mancuerna'], ['kettlebell', 'pesa rusa'], ['cable', 'polea'],
  ['lever', 'máquina'], ['machine', 'máquina'], ['smith', 'Smith'], ['sled', 'trineo'], ['ez', 'EZ'],
  ['bodyweight', 'peso corporal'], ['assisted', 'asistido'], ['weighted', 'con peso'], ['band', 'banda'],
  ['incline', 'inclinado'], ['decline', 'declinado'], ['flat', 'plano'], ['seated', 'sentado'],
  ['standing', 'de pie'], ['lying', 'tumbado'], ['prone', 'boca abajo'], ['supine', 'boca arriba'],
  ['kneeling', 'de rodillas'], ['hanging', 'colgado'], ['bent over', 'inclinado'],
  ['reverse grip', 'agarre inverso'], ['close grip', 'agarre cerrado'], ['wide grip', 'agarre ancho'],
  ['neutral grip', 'agarre neutro'], ['single arm', 'a un brazo'], ['one arm', 'a un brazo'],
  ['single leg', 'a una pierna'], ['one leg', 'a una pierna'], ['single', 'unilateral']
].sort((a, b) => b[0].length - a[0].length)

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const rx = (en, flags = 'g') => new RegExp('(^|[^a-z])' + esc(en) + '(?![a-z])', flags)

function peel(s) {
  const mods = []
  let changed = true
  while (changed && mods.length < 3) {
    changed = false
    const lower = s.toLowerCase()
    for (const [en, es] of LEAD) {
      if (lower === en || lower.startsWith(en + ' ')) {
        mods.push(es); s = s.slice(en.length).trim(); changed = true; break
      }
    }
  }
  return { core: s, mods }
}

function core(s) {
  let out = s
  for (const [en, es] of PHRASES) out = out.replace(rx(en, 'gi'), (m, p1) => p1 + es)
  for (const en of Object.keys(WORDS).sort((a, b) => b.length - a.length)) out = out.replace(rx(en, 'gi'), (m, p1) => p1 + WORDS[en])
  return out
}

const cache = new Map()
export function translateExName(name) {
  if (!name || typeof name !== 'string') return name
  const hit = cache.get(name)
  if (hit) return hit
  const src = name.replace(/в°/g, '°')     // fix a dataset mojibake (Cyrillic в° → °)
  const { core: c, mods } = peel(src)
  let out = core(c)
  if (mods.length) out += ' (' + mods.join(', ') + ')'
  out = out.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim()
  out = out.charAt(0).toUpperCase() + out.slice(1)
  cache.set(name, out)
  return out
}
