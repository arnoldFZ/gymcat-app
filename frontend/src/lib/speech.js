// Spoken exercise instructions via the browser's Web Speech API.
//
// No audio files and no dependency: the device synthesizes the voice. The text a
// listener hears is built by a pure function (`speechText`) and the language is
// decided by another (`speechLangs`), so both are unit-testable; only `speak`/
// `stopSpeaking` touch the browser.
//
// iOS Safari only allows speechSynthesis from a user gesture (a tap), which is how
// it is used here. Two iOS-specific rules keep it audible:
//   · set only `utterance.lang` — forcing a `voice` that isn't actually installed
//     (Apple lists many that must be downloaded) produces SILENCE;
//   · call `resume()` after `speak()`, because iOS often starts paused.

// Voice language for each supported UI language. Spanish defaults to es-ES; the
// system falls back to any es-* voice if es-ES isn't present.
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

// Cache the voice list for diagnostics (the Settings "test" shows the count). We do
// NOT pick a specific voice to speak with — see `speak`.
let voices = []
function refreshVoices() {
  if (!isSpeechSupported()) return
  try { voices = window.speechSynthesis.getVoices() || [] } catch { voices = [] }
}
if (isSpeechSupported()) {
  refreshVoices()
  try { window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices) } catch { /* */ }
}
export const voiceCount = () => voices.length

let current = null
export function stopSpeaking() {
  if (isSpeechSupported()) { try { window.speechSynthesis.cancel() } catch { /* */ } }
  current = null
}

// Speak `text` with the voice for `tag`. Returns false when unsupported/empty.
// Must be invoked from a user gesture on iOS.
export function speak(text, tag) {
  if (!isSpeechSupported() || !text) return false
  const synth = window.speechSynthesis
  try {
    if (synth.speaking || synth.pending) synth.cancel()
    const u = new window.SpeechSynthesisUtterance(text)
    u.lang = tag || 'en-US'
    u.rate = 1
    u.pitch = 1
    u.volume = 1
    u.onend = () => { if (current === u) current = null }
    u.onerror = () => { if (current === u) current = null }
    // Hold a reference: iOS Safari can garbage-collect a detached utterance and then
    // simply never plays it. This is the classic "nothing happens" speech bug.
    current = u
    synth.speak(u)
    if (synth.paused) synth.resume()
    return true
  } catch { return false }
}

// A short sample in the chosen language, for the Settings "Test" button.
export function speakTest(S) {
  const { code, tag } = speechLangs(S)
  const sample = code === 'es'
    ? 'Así suena la voz de tus ejercicios.'
    : 'This is your exercise voice.'
  return speak(sample, tag)
}
