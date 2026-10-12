// Spoken exercise instructions via the browser's Web Speech API.
//
// No audio files and no dependency: the device synthesizes the voice. The text a
// listener hears is built by a pure function (`speechText`) and the language is
// decided by another (`speechLangs`), so both are unit-testable; only `speak`/
// `stopSpeaking` touch the browser.
//
// Getting speech to actually PLAY is the hard part, and each engine has its own trap:
//   · Chrome lists voices but, with no voice chosen, may fall back to an ONLINE
//     "Google" voice that fails silently (no error, no sound). Picking an explicit
//     LOCAL voice for the language fixes it — see `chooseVoice`.
//   · Chrome also silently ignores a `speak()` issued in the same tick as `cancel()`,
//     and can drop the very first utterance — hence the cancel-then-defer and the
//     start-detection retry below.
//   · iOS Safari only speaks from a user gesture, starts paused (needs `resume()`),
//     and can garbage-collect a detached utterance (hence the retained reference).

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
  try { window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices) } catch { /* */ }
}
export const voiceCount = () => voices.length

// Best voice for a language tag. An explicit `voiceName` wins; otherwise prefer a
// LOCAL (offline) voice: Chrome's online "Google" voices are a common source of
// "it thinks for a second and says nothing".
export function chooseVoice(tag, voiceName) {
  if (!voices.length) refreshVoices()
  if (voiceName) {
    const want = voices.find(v => v.name === voiceName)
    if (want) return want
  }
  const t = String(tag || '').toLowerCase()
  const base = t.split('-')[0]
  const lang = v => (v.lang || '').toLowerCase()
  const exact = voices.filter(v => lang(v) === t)
  const loose = voices.filter(v => lang(v).startsWith(base))
  const pool = exact.length ? exact : loose
  if (!pool.length) return null
  return pool.find(v => v.localService) || pool[0]
}

// Voices available for a language tag, for the Settings picker.
export function listVoices(tag) {
  if (!voices.length) refreshVoices()
  const base = String(tag || '').toLowerCase().split('-')[0]
  return voices.filter(v => (v.lang || '').toLowerCase().startsWith(base))
}

let current = null
let errorHandler = null
// Let the app surface a speech failure (Chrome may report e.g. 'not-allowed').
export function onSpeechError(fn) { errorHandler = fn }
function reportError(u, e) {
  if (current === u) current = null
  const code = e && e.error
  if (code && code !== 'interrupted' && code !== 'canceled' && errorHandler) errorHandler(code)
}

export function stopSpeaking() {
  if (isSpeechSupported()) { try { window.speechSynthesis.cancel() } catch { /* */ } }
  current = null
}

// Speak `text` with the voice for `tag`. Returns true when the call was issued.
// Must be invoked from a user gesture on iOS.
export function speak(text, tag, voiceName) {
  if (!isSpeechSupported() || !text) return false
  const synth = window.speechSynthesis
  let attempt = 0

  const fire = () => {
    const u = new window.SpeechSynthesisUtterance(text)
    u.lang = tag || 'en-US'
    const v = chooseVoice(u.lang, voiceName)
    if (v) u.voice = v
    u.rate = 1
    u.pitch = 1
    u.volume = 1
    u.onend = () => { if (current === u) current = null }
    u.onerror = e => reportError(u, e)
    // Hold a reference: browsers can garbage-collect a detached utterance and then
    // simply never play it.
    current = u
    try { synth.resume() } catch { /* */ }   // iOS/Chrome sometimes start paused
    synth.speak(u)
    // If nothing started shortly after, the utterance was ignored — retry once, and
    // if it is still silent, say so instead of failing quietly.
    setTimeout(() => {
      if (current !== u) return
      if (synth.speaking || synth.pending) return
      if (attempt < 1) {
        attempt++
        try { synth.cancel() } catch { /* */ }
        setTimeout(fire, 120)
      } else if (errorHandler) {
        errorHandler('silent')
      }
    }, 500)
  }

  try {
    if (synth.speaking || synth.pending) {
      synth.cancel()                 // Chrome drops a speak queued in the same tick
      setTimeout(fire, 80)
    } else {
      fire()
    }
    return true
  } catch { return false }
}

// A short sample in the chosen language, for the Settings "Test" button. Returns
// which voice it used so the UI can report it.
export function speakTest(S) {
  const { code, tag } = speechLangs(S)
  const v = chooseVoice(tag, S && S.speakVoice)
  const sample = code === 'es'
    ? 'Así suena la voz de tus ejercicios.'
    : 'This is your exercise voice.'
  const ok = speak(sample, tag, S && S.speakVoice)
  return { ok, tag, voice: v ? v.name : null }
}
