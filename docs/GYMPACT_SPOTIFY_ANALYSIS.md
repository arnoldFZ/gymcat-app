# GYMPACT × Spotify — análisis de viabilidad

> Documento de **solo análisis**. No hay nada de esto implementado. Objetivo: decidir
> con criterio si merece la pena integrar Spotify y por qué camino, dado que GymCat es
> una app personal, AGPL, mobile-first y **offline por defecto**.
>
> Datos verificados contra la documentación oficial de Spotify (octubre 2026).

---

## 1. Para qué serviría (casos de uso)

Por orden de valor real para "mantener la constancia":

1. **Música durante el entrenamiento** — lo más pedido: un botón en la sesión activa que
   ponga tu lista de entreno, sin salir de la app.
2. **Playlist por día/rutina** — Push → una lista; Pierna → otra. Se lanza al empezar.
3. **Integración con el descanso** — bajar/atenuar al empezar el descanso y reanudar al
   terminar; o un "beep" sobre la música.
4. **Tempo/BPM para series por tiempo** (planchas, carries) — elegir canciones por cadencia.
5. **Podcast/audio en cardio** — continuación de donde ibas.

Ninguno es imprescindible para GYMPACT (que es constancia/puntos). Es un extra de UX.

---

## 2. Opciones de integración (de menos a más invasiva)

### A. Enlace saliente ("abrir en Spotify") — recomendado como primer paso
Guardar una **URL de música por rutina** (o una global) en el perfil y abrirla con un
toque: `https://open.spotify.com/...` o el URI `spotify:playlist:ID`.
- **Sin OAuth, sin Premium extra, sin backend, sin SDK.** Funciona en web y en la app
  instalada (iOS/Android abren la app de Spotify por deep link).
- Límite: **sale de GymCat**; no controlas reproducción.
- **Ventaja extra: es agnóstico de plataforma** — el mismo campo sirve para Apple Music,
  YouTube Music, etc. Spotify no queda "privilegiado" ni atado.
- Esfuerzo: **S (½–1 día)**.

### B. OAuth PKCE + Web API (control de Spotify Connect)
Conectar la cuenta (Authorization Code **with PKCE**, sin client secret) y controlar la
reproducción **en el dispositivo Spotify del usuario** (móvil/escritorio): play/pausa,
siguiente, volumen, y "reproducir esta playlist".
- Scopes: `user-read-playback-state`, `user-modify-playback-state`, opcional
  `playlist-read-private`, `user-read-email`.
- El usuario **necesita Premium** para controlar la reproducción (es requisito de Spotify).
- Requiere **redirect URI en allowlist** (HTTPS, o `http://127.0.0.1` en desarrollo).
  Ojo: una IP de LAN (`http://192.168.x.x`) probablemente **no** se puede registrar →
  habría que servir la app desde un dominio/localhost.
- Puede ejecutarse **solo en el cliente** (PKCE no usa secreto); el `refresh_token` se
  guarda cifrado/servidor o en el perfil. Es lo más seguro para un cliente público.
- Esfuerzo: **M (2–4 días)** + mantenimiento de tokens.

### C. Web Playback SDK (reproducir DENTRO de la app)
Crear un reproductor Spotify **dentro de la web** (audio en la propia página).
- **Requiere Spotify Premium** (las suscripciones "solo móvil" quedan excluidas).
- Necesita **DRM/EME** (`encrypted-media`); en iframes hay que permitirlo. Safari/iOS lo
  soportan **con matices**: en iOS la reproducción **no arranca sola tras transferir**,
  exige interacción; y el SDK es **solo web** (no funciona en la app nativa WKWebView ni
  como PWA instalada de forma fiable).
- No permite reproducir audio en la app nativa sin el SDK nativo.
- Esfuerzo: **M–L (3–6 días)** + seguimiento de incidencias iOS.

### D. SDK nativo "App Remote" (iOS/Android)
Control/reproducción vía la app de Spotify instalada, con el scope `app-remote-control`.
Mejor UX móvil, pero requiere **plugin nativo de Capacitor** (iOS Swift / Android Kotlin),
`SpotifyiOS`/`SpotifyAndroidAppRemote`, y recompilar las apps nativas.
- Esfuerzo: **L (1–2 semanas)** y doble mantenimiento (dos plataformas).

---

## 3. Restricciones y riesgos (lo que decide de verdad)

### Legales (Developer Terms/Policy)
- El **Web Playback SDK no puede usarse en proyectos comerciales sin aprobación escrita**
  de Spotify. Para uso personal OK, pero condiciona cualquier publicación.
- Hay **guías de marca** (no usar el logo de manera que parezca oficial, no afirmar
  partnership) y **no se puede cachear/almacenar audio**.
- No guardar nunca contraseñas de Spotify; tokens como datos sensibles.

### Plataforma (2026, relevante)
- **Modo Development (app personal): desde feb/mar 2026 el dueño del app necesita
  Premium activo**, límite de **1 Client ID** por desarrollador (ampliado a 25 en jul-2026)
  y **5 usuarios por app**. Para uso personal encaja; si algún día es multiusuario, choca.
- Cambios de API de feb-2026: **se eliminaron endpoints batch/browse/artist top-tracks y
  `GET /users/{id}`/`/markets`**, `GET /search` bajó el límite a **10**, y **se quitó el
  campo `product` de `GET /me`** → **detectar Premium por API es más difícil** (habría que
  inferirlo por errores 403/`PREMIUM_REQUIRED`).
- La API **cambia a menudo**: cada integración es mantenimiento continuo.

### Técnicos
- **Red obligatoria**: GymCat funciona offline (PWA); la música sería la **única** parte
  que exige conexión. Hay que degradar con elegancia.
- **Tokens**: PKCE sin secreto está bien; el `refresh_token` hay que guardarlo con cuidado
  (no en un sitio público) y refrescar el access token.
- **iOS/autoplay**: reglas de gesto/autoplay complican C dentro de la PWA.
- **Batería/datos**: reproducir en la web consume más que la app nativa de Spotify.

### Privacidad y AGPL
- Conectar una cuenta añade datos de un tercero al perfil; debe ser **opcional y sin
  telemetría** (coherente con GymCat).
- La AGPL de GymCat no impide llamar a una API externa, pero **no** se puede copiar código
  propietario del SDK; usar el JS oficial servido por Spotify (Web Playback SDK) o solo
  HTTP a su API.

---

## 4. Encaje con la arquitectura actual de GymCat

- No hay backend obligatorio; **A y B pueden vivir solo en el cliente** (clave para el modo
  invitado/PWA). C también es cliente. D exige rebuild nativo.
- El estado ya centraliza preferencias por perfil (`S`), así que un campo
  `S.musicLinks = { [routineId]: url }` o `S.music` encaja sin migraciones.
- La app ya tiene hoja de ajustes, toasts, `wakelock`, y **voz por Web Speech** — no hay
  que inventar infraestructura.
- La reproducción durante el entrenamiento debe **no bloquear** el registro de series ni
  el temporizador de descanso (rendimiento y permisos).

---

## 5. Estimación y mantenimiento

| Opción | Esfuerzo | Requiere Premium | Backend | Riesgo | Mantenimiento |
|---|---|---|---|---|---|
| **A. Enlace por rutina** | S | No (para enlazar) | No | Muy bajo | Casi nulo |
| B. PKCE control (Connect) | M | Sí | No | Medio | Alto (tokens, API) |
| C. Web Playback SDK | M–L | **Sí** | No | Alto (iOS, DRM) | Alto |
| D. App Remote nativo | L | Sí | No | Alto | Muy alto (2 plataformas) |

---

## 6. Recomendación (provisional)

1. **Empezar por A**: un campo "música" por rutina (y/o global) que **abre** la lista en
   Spotify/Apple/YouTube. ½ día, cero riesgo legal/técnico, y ya cubre "quiero mi música al
   entrenar". Se guarda como URL/preset en el perfil.
2. **Si se quiere control real sin salir de la app**, valorar **B (PKCE)** — pero asumiendo
   el requisito de **Premium** y el mantenimiento de tokens, y resolviendo el **redirect
   URI** (dominio/localhost, no IP de LAN).
3. **C (Web Playback SDK) solo** si (a) hay Premium, (b) el foco es web, y (c) se acepta
   el trasteo con iOS/DRM. No lo recomiendo como primer paso.
4. **D** únicamente si Spotify se vuelve central y solo para las apps nativas.

Alternativa "agnóstica" preferible a todo lo anterior: un **campo de URL de música** por
rutina que abra la app que el usuario tenga (Spotify, Apple Music, YouTube Music). Máximo
beneficio / mínimo acoplamiento.

---

## 7. Preguntas antes de decidir

1. ¿De verdad quieres **control dentro** de GymCat, o basta con **abrir** tu lista?
2. ¿Tienes **Spotify Premium**? (sin él, B/C no reproducen).
3. ¿Dónde se usará: **iPhone como PWA**, **app nativa** o **web de escritorio**? (define
   A/B vs C/D).
4. ¿Música **global** o **por rutina/día**?
5. ¿Spotify **exclusivo** o un campo de URL que sirva para cualquier app de música?
6. ¿Se acepta que la música introduzca una parte **online** en una app offline-first?

---

## 8. Fuentes (verificadas)

- Spotify — Web Playback SDK (requiere Premium; soporte de navegadores; limitaciones iOS;
  nota legal de uso comercial): https://developer.spotify.com/documentation/web-playback-sdk
- Spotify — Authorization Code with PKCE (cliente público, sin secreto):
  https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
- Spotify — Scopes (`streaming`, `user-modify-playback-state`, `app-remote-control`):
  https://developer.spotify.com/documentation/web-api/concepts/scopes
- Spotify — Guía de migración feb-2026 (Premium en Development Mode, límites, endpoints y
  campos eliminados):
  https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
