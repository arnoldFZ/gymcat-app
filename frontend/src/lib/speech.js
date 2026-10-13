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

// True on iPhone/iPad (incl. iPadOS reporting as Mac). Used only to show the
// silent-switch hint: on iOS the voice is muted by the hardware switch through the
// built-in speaker, which is a very common "it doesn't work" report.
export function isIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)
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

// All available voices, ordered so those matching `tag` come first (exact language,
// then same base language, then the rest). The Settings picker shows the whole list
// so nothing is hidden — the count difference between EN and ES is just how many
// voices the operating system has installed for each language.
export function listVoices(tag) {
  if (!voices.length) refreshVoices()
  const t = String(tag || '').toLowerCase()
  const base = t.split('-')[0]
  const rank = v => {
    const l = (v.lang || '').toLowerCase()
    if (l === t) return 0
    if (l.startsWith(base)) return 1
    return 2
  }
  return voices.slice().sort((a, b) => rank(a) - rank(b) || String(a.name || '').localeCompare(String(b.name || '')))
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

/* ---------- iOS audio-session unlock (best effort) ---------- */
// On iOS Safari the Web Audio / speech session is muted by the hardware SILENT switch
// when the phone plays through its built-in speaker — but an HTML5 <audio> element is
// NOT. So, on the same user gesture, we (a) resume an AudioContext and (b) play a tiny
// looping silent clip through an <audio> element, which pulls the session into a state
// where the voice is audible without headphones. It cannot override the switch itself;
// it is a nudge, not a guarantee. The clip is paused again when speech ends so no
// media indicator lingers.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
let audioCtx = null
let silentEl = null

export function wakeAudioSession() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC) {
      if (!audioCtx) audioCtx = new AC()
      if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') audioCtx.resume()
      const b = audioCtx.createBuffer(1, 1, 22050)
      const s = audioCtx.createBufferSource()
      s.buffer = b; s.connect(audioCtx.destination); s.start(0)
    }
  } catch { /* not fatal */ }
  try {
    if (!silentEl) {
      silentEl = document.createElement('audio')
      silentEl.setAttribute('playsinline', '')
      silentEl.setAttribute('aria-hidden', 'true')
      silentEl.loop = true
      silentEl.volume = 0.001          // effectively silent, still opens the session
      silentEl.src = SILENT_WAV
    }
    const p = silentEl.play()
    if (p && p.catch) p.catch(() => {})
  } catch { /* not fatal */ }
}
function pauseSilent() {
  try { if (silentEl && !silentEl.paused) silentEl.pause() } catch { /* */ }
}

export function stopSpeaking() {
  if (isSpeechSupported()) { try { window.speechSynthesis.cancel() } catch { /* */ } }
  current = null
  pauseSilent()
}

// Speak `text` with the voice for `tag`. Returns true when the call was issued.
// Must be invoked from a user gesture on iOS.
export function speak(text, tag, voiceName) {
  if (!isSpeechSupported() || !text) return false
  wakeAudioSession()            // must run inside the user gesture (iOS)
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
    u.onend = () => { if (current === u) current = null; pauseSilent() }
    u.onerror = e => { reportError(u, e); pauseSilent() }
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
