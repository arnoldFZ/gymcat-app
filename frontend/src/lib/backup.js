// Full-profile backup, shared by Settings and the dashboard reminder.
import { MOBILE, shareExport } from './mobile.js'
import { todayISO } from './format.js'

// Write the whole profile (S) to a JSON file the user keeps. On the native build the
// file goes out through the OS share sheet (WKWebView can't download blob URLs); on the
// web it downloads. Returns true when handed off, false when the user dismissed it.
export async function downloadBackup(state) {
  const json = JSON.stringify(state, null, 2)
  const name = 'gymcat-backup-' + todayISO() + '.json'
  if (MOBILE) {
    try { await shareExport(json, name); return true } catch { return false }
  }
  const blob = new Blob([json], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
  return true
}
