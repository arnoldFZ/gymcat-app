// Tiny dependency-free i18n. English source strings are the keys; locale files in
// src/locales/ map them to translations and are lazy-loaded (Vite code-splits each
// import.meta.glob entry), so the initial bundle stays English-only.
// Exercise instructions come from separately generated packs in src/instr/ (one per
// language, from the upstream dataset) — also lazy-loaded on language switch.
import { useSyncExternalStore } from 'react'

// UI languages. de/pt have no instruction pack upstream — instructions fall back to English.
export const LANGS = {
  en: 'English', de: 'Deutsch', es: 'Español', fr: 'Français', it: 'Italiano',
  pt: 'Português', pl: 'Polski', tr: 'Türkçe', ru: 'Русский', zh: '中文',
  ko: '한국어', hi: 'हिन्दी'
}
export const INSTR_LANGS = ['en', 'es', 'fr', 'it', 'tr', 'ru', 'zh', 'hi', 'pl', 'ko']
// Languages the product actively offers. Spanish and English are the maintained pair
// (Spanish first — it's the default UI language); the other locale packs stay on disk
// and keep working for a profile that had already selected one, but are not advertised.
export const PRIMARY_LANGS = { es: 'Español', en: 'English' }
const DATE_LOCALES = {
  en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', pt: 'pt-PT',
  pl: 'pl-PL', tr: 'tr-TR', ru: 'ru-RU', zh: 'zh-CN', ko: 'ko-KR', hi: 'hi-IN'
}

const localePacks = import.meta.glob('../locales/*.js')
const instrPacks = import.meta.glob('../instr/*.js')

let lang = 'en'   // pre-load sentinel; the profile's language (default 'es') takes over on boot
let dict = {}
let loaded = false          // dict actually corresponds to `lang` (not just requested)
let instr = null            // { exId: [steps] } for the current language, null = English
let gen = 0                 // guards against an older switch finishing after a newer one
let version = 0
const subs = new Set()
const notify = () => { version++; subs.forEach(f => f()) }

export const getLang = () => lang
export const isLangReady = l => (l || 'es') === lang && loaded
export const dateLocale = () => DATE_LOCALES[lang] || 'en-GB'

// Translate a source string; {0},{1}… are replaced with args (also on the English fallback).
export function t(s, ...args) {
  let v = dict[s] || s
  for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
  return v
}
// Instructions for an exercise in the current language (English steps as fallback).
export const instrFor = ex => (instr && instr[ex.id]) || ex.st || []

let retryTimer = null
// Load and switch the UI language, then (separately) the instruction pack.
//
// Robustness matters here: a profile can have `lang: 'es'` while `S.lang` never
// changes again, so a single failed load must NOT strand the app in English with
// Spanish still selected. Two rules:
//   1. A failed UI dict load keeps `loaded=false` and schedules a bounded retry, so a
//      later call (or `ensureLang` on focus/online) can recover.
//   2. The (large) instruction pack is loaded in its OWN try/catch — its failure can
//      never wipe the UI dict, which used to turn the whole app English.
export async function setLang(l, attempt = 0) {
  if (!LANGS[l]) l = 'es'
  if (l === lang && loaded) return
  const my = ++gen
  lang = l
  loaded = false
  let d = {}
  if (l !== 'en') {
    try { d = (await localePacks['../locales/' + l + '.js']()).default }
    catch (e) { d = null }
  }
  if (my !== gen) return                       // superseded by a newer switch
  if (d === null) {                            // UI pack failed — fall back, retry later
    dict = {}
    notify()
    if (attempt < 4 && !retryTimer) {
      retryTimer = setTimeout(() => { retryTimer = null; setLang(l, attempt + 1) }, 1000 * (attempt + 1))
    }
    return
  }
  dict = d
  loaded = true
  notify()
  instr = null
  if (l !== 'en' && INSTR_LANGS.includes(l)) {
    try {
      const m = await instrPacks['../instr/' + l + '.js']()
      if (my === gen) { instr = m.default; notify() }
    } catch (e) { /* keep English instructions; the UI stays translated */ }
  }
}

// Re-apply the requested language if it isn't actually loaded yet. Callers use this
// on focus / reconnect; a no-op when everything is fine.
export function ensureLang(l) {
  if (!isLangReady(l)) setLang(l)
}

// Re-renders the subscribing component (and its children) whenever the language changes.
export function useLang() {
  return useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn) }, () => version)
}
