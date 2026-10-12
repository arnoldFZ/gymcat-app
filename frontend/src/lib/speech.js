// Spoken exercise instructions via the browser's Web Speech API.
//
// No audio files and no dependency: the device synthesizes the voice. The text a
// listener hears is built by a pure function (`speechText`) and the language is
// decided by another (`speechLangs`), so both are unit-testable; only `speak`/
// `stopSpeaking` touch the browser.
//
// iOS Safari only allows speechSynthesis from a user gesture, which is exactly how
// it is used here (a button tap), and it needs the language tag set on the utterance
// to pick a matching system voice.

// Voice language for each supported UI language. Spanish defaults to es-ES; any
// es-* voice will do when es-ES isn't installed.
const SPEECH_TAGS = { en: 'en-US', es: 'es-ES' }

export function isSpeechSupported() {
  return typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function'
}

// Which voice to use: an explicit profile choice ('en'/'es') wins, otherwise the app
// language (es → Spanish, anything else → English).
export function speechLangs(S) {
  const pref = S && S.speakLang
  const app = S && S.lang
  const code = SPEECH_TAGS[pref] ? pref : (SPEECH_TAGS[app] ? app : 'en')
  return { code, tag: SPEECH_TAGS[code] }
}

// The text read aloud: the exercise name, then its instruction steps. Whitespace is
// collapsed; the steps already carry their own sentence punctuation, so the name is
// only given a full stop when it needs one (avoiding "bench.. press").
export function speechText(name, steps) {
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim()
  const head = clean(name)
  const body = (steps || []).map(clean).filter(Boolean).join(' ')
  if (!head) return body
  const sep = /[.!?:;]$/.test(head) ? ' ' : '. '
  return head + sep + body
}

let voices = []
function refreshVoices() {
  if (!isSpeechSupported()) return
  try { voices = window.speechSynthesis.getVoices() || [] } catch { voices = [] }
}
if (isSpeechSupported()) {
  refreshVoices()
  // Voices arrive asynchronously on most browsers; cache them when they do.
  try { window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices) } catch { /* */ }
}

function pickVoice(tag) {
  if (!voices.length) refreshVoices()
  const t = String(tag).toLowerCase()
  const base = t.split('-')[0]
  return voices.find(v => (v.lang || '').toLowerCase() === t)
    || voices.find(v => (v.lang || '').toLowerCase().startsWith(base))
    || null
}

export function stopSpeaking() {
  if (isSpeechSupported()) { try { window.speechSynthesis.cancel() } catch { /* */ } }
}

// Speak `text` with the voice for `tag`. Returns false when unsupported/empty so the
// caller can fall back to a toast or nothing.
export function speak(text, tag) {
  if (!isSpeechSupported() || !text) return false
  const synth = window.speechSynthesis
  try {
    synth.cancel()                     // one voice at a time
    const u = new window.SpeechSynthesisUtterance(text)
    u.lang = tag || 'en-US'
    const v = pickVoice(u.lang)
    if (v) u.voice = v
    u.rate = 0.95
    u.pitch = 1
    synth.speak(u)
    return true
  } catch { return false }
}
