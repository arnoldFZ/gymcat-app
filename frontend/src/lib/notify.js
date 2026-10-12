// Best-effort LOCAL notification — no server, no dependency, never throws.
//
// Used for the GYMPACT weekly nudge ("one session left"). Push subscriptions need a
// signed-in profile and the backend; this only works when the user has already
// granted the Notification permission, and quietly does nothing otherwise. The
// service worker shows the notification so it also appears when the tab is hidden.

export function notificationsSupported() {
  return typeof window !== 'undefined' && typeof Notification !== 'undefined' && 'serviceWorker' in navigator
}

export function notifyNow(title, body, tag) {
  try {
    if (!notificationsSupported() || Notification.permission !== 'granted') return false
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(title, { body, tag, icon: 'icon-180.png', badge: 'icon-180.png' }))
      .catch(() => {})
    return true
  } catch { return false }
}
