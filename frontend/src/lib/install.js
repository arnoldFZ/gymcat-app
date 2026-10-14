// PWA install, from inside the app.
//
// Android / desktop Chrome fire `beforeinstallprompt`; capturing it lets a normal
// button call `prompt()` for a one-tap install with no browser menu. iOS Safari
// deliberately exposes NO install API — a web page cannot add itself to the home
// screen — so there the UI falls back to a short Share-menu guide. This module owns
// the event bookkeeping so the UI just asks `canPrompt()` / `isStandalone()`.
import { useSyncExternalStore } from 'react'

let deferred = null
let version = 0
const subs = new Set()
const notify = () => { version++; subs.forEach(f => f()) }

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()          // we drive the prompt ourselves
    deferred = e
    notify()
  })
  window.addEventListener('appinstalled', () => { deferred = null; notify() })
}

// Running as an installed app (standalone display-mode) rather than a browser tab.
export function isStandalone() {
  if (typeof window === 'undefined') return false
  try {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true
  } catch { return false }
}

export const canPrompt = () => !!deferred

// Trigger the native install prompt. Returns true if the user accepted.
export async function promptInstall() {
  if (!deferred) return false
  const ev = deferred
  deferred = null
  try {
    ev.prompt()
    const { outcome } = await ev.userChoice
    notify()
    return outcome === 'accepted'
  } catch { notify(); return false }
}

// Subscribe a component to install-availability changes.
export function useInstall() {
  return useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn) }, () => version)
}
