// Ask the browser to keep this origin's data instead of treating it as evictable.
//
// Best-effort: Safari doesn't implement persist(), and browsers may refuse when the app
// isn't installed/engaged. Where it IS granted it protects against eviction under storage
// pressure — a nice complement to (not a replacement for) user-exported backups.
export async function requestPersistence() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return null
    if (navigator.storage.persisted && await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch { return null }
}
