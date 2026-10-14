# GymCat — Revisión de ciberseguridad y QA

Fecha: 2026-10-14 · Alcance: código del repo (`frontend/`, `api/`), despliegue estático
(GitHub Pages / Cloudflare) y modo self-host. No es asesoría legal ni un pentest formal.

---

## 0. Resumen ejecutivo

- **Bug reportado (HTTP 405 al crear/iniciar con passkey): reproducido y corregido.** Causa:
  la **build estática** (sin backend) seguía ofreciendo botones de passkey en Ajustes; al
  pulsarlos hacía `POST /api/register/options` contra un host **estático**, que no acepta
  POST en esa ruta → **405**. Los passkeys **requieren el backend** (Node + WebAuthn).
- **Postura de seguridad:** sólida para su diseño (app personal). WebAuthn correcto,
  cookies `HttpOnly/SameSite=Lax/Secure`, aislamiento por usuario, sin secretos en el repo,
  sin telemetría, sin sinks XSS (`dangerouslySetInnerHTML`/`eval` ausentes).
- **Riesgos relevantes y aceptados/documentados:** (1) en static/guest los **puntos y el
  ledger son autoritativos del cliente** (editables desde DevTools) — no hay fraude posible
  contra terceros porque no hay servidor; (2) **sin rate limiting** en la API (delegado al
  proxy inverso); (3) **19 avisos de dependencias**, **todos en tooling/desarrollo** (no en
  el bundle que se sirve); (4) `requireUserVerification:false` en el registro/login con passkey.
- **QA:** 252 tests unitarios en verde; añadida la verificación del 405 y una **matriz de
  pruebas** de passkeys, PWA y seguridad.

---

## 1. El bug 405 — causa raíz, impacto y arreglo

### Reproducción
1. Abrir la **PWA estática** (GitHub Pages o Cloudflare) — modo `VITE_STATIC=1`, sin backend.
2. Ajustes → sección **Account** (título "Account") mostraba:
   *"Create passkey profile"* y *"Sign in with passkey"*.
3. Al pulsar → `POST /api/register/options` → el host estático responde **405 Method Not
   Allowed** (o similar según host) → error mostrado.

### Causa raíz (código)
`frontend/src/views/Settings.jsx` decidía qué mostrar con:
```
MOBILE ? … : DEMO ? … : user ? … : webauthnOK() ? <botones passkey> : <no soportado>
```
No contemplaba `STATIC`. En la build estática `user` es `null` (modo invitado) y
`webauthnOK()` es `true` en el navegador → se renderizaban los botones de passkey, que
llaman a `frontend/src/lib/api.js::passkeyRegister/passkeyLogin` → `fetch('/api/...')`
contra el host estático.

> Nota: el `boot()` en modo estático entra directo en **invitado** y **no** llama a
> `/api/me`, y el store **no** hace `pushState` (solo si hay `user`). Es decir, el **único**
> tráfico `/api` en modo estático venía de esos botones.

### Arreglo
- `Settings.jsx`: nueva rama **`STATIC`** (título *"Local data"*, fila *"Local profile"* +
  *"Self-host GymCat"*), **sin** botones de passkey. El pie de "guest mode" excluye `STATIC`.
- Consecuencia: en static/guest **desaparece** la superficie de passkeys; el 405 no puede
  ocurrir. Los passkeys siguen disponibles **solo** con backend (self-host).

### Impacto
- **Funcional:** alto (bloqueaba crear/iniciar sesión). **Seguridad:** ninguno (el 405 es un
  "fail-closed"; no exponía datos).

---

## 2. Arquitectura y límites de confianza

Dos modos, con superficies muy distintas:

| | **Static / Guest** (GitHub Pages, Cloudflare, demo, móvil) | **Self-host** (Docker: web + api + data) |
|---|---|---|
| Backend | **No existe** | Node sin framework (`api/server.js`) |
| Datos | `localStorage` del navegador (por origen) | `./data/state-<uid>.json` en el servidor |
| Auth | Ninguna (invitado) | **Passkeys/WebAuthn** + cookie firmada |
| Autoridad | El **cliente** | El **servidor** |
| Sincronización | No | Sí (por perfil) |

Fronteras de confianza: (a) navegador ↔ servidor (solo self-host); (b) servidor ↔
sistema de ficheros (`./data`); (c) la app ↔ CDN de medios (self-host trae medios locales;
la build móvil usa el CDN).

---

## 3. Análisis de ciberseguridad

### 3.1 Autenticación (WebAuthn / passkeys) — `api/server.js`
- **Correcto:** `generateRegistrationOptions`/`verifyRegistrationResponse` y
  `generateAuthenticationOptions`/`verifyAuthenticationResponse` de `@simplewebauthn/server`
  v13; `residentKey: 'required'`; reto (challenge) guardado **en memoria** con **TTL 5 min**
  y consumido una sola vez (`takeChallenge`); comprobación de `expectedOrigin` y
  `expectedRPID`; unicidad de `credential.id`; **contador** de la credencial actualizado;
  cuentas `disabled` rechazadas en cada request.
- **A vigilar:** `requireUserVerification:false` (se pide `userVerification:'preferred'`).
  En un dispositivo **compartido**, no exigir UV permite autenticar solo con presencia. Para
  uso personal es aceptable; para mayor rigor: `required` + `userVerification:'required'`.
- **Sesión:** cookie `gymsid` = `uid:exp:version` firmada con **HMAC-SHA256**;
  `HttpOnly; SameSite=Lax; Max-Age 90d`; `Secure` **solo si ORIGIN es https** (en LAN http
  baja a sin-Secure — documentado). **Revocación**: `POST /api/logout/all` incrementa `sv` e
  invalida todas las cookies del perfil. Comparación de firma con `timingSafeEqual`.
- **Invitaciones** (si `INVITE_ONLY`): código **16 hex = 64 bits**; se revalida en el último
  momento y se "quema" al usarse.
- **Admin**: `ADMIN_UIDS` o `user.admin`; `requireAdmin` protege `/api/admin/*`.

### 3.2 Autorización y aislamiento de datos
- `GET/PUT /api/data` resuelven el usuario **desde la cookie** y operan sobre
  `state-<uid>.json`; no hay parámetro de usuario que un cliente pueda falsear.
- **Path traversal:** el nombre del fichero de estado sanitiza el uid
  (`uid.replace(/[^a-zA-Z0-9_-]/g,'')`).
- Endpoints admin exigen `user.admin === true` o estar en `ADMIN_UIDS`.

### 3.3 Transporte
- WebAuthn y Service Worker **exigen contexto seguro (HTTPS)**. Por eso en static **http**
  (LAN) no hay passkeys ni SW; en GitHub Pages/Cloudflare (HTTPS) el SW sí registra.
- La API no añade cabeceras **CORS** → en self-host se sirve en **mismo origen** (nginx
  proxy), evitando CORS abierto. Correcto para passkeys.

### 3.4 CSRF
- Cookie `SameSite=Lax` + cuerpo JSON. Las peticiones de cambio de estado (`POST/PUT`) desde
  otro sitio no llevarán la cookie (Lax no la adjunta en cross-site POST). **No** hay token
  CSRF: riesgo residual **bajo** (subdominios same-site, navegadores antiguos). Para subir el
  listón: token CSRF o `SameSite=Strict` + `Origin` check.

### 3.5 XSS / inyección
- **No hay** `dangerouslySetInnerHTML`, `innerHTML`, `eval` ni `new Function` en `src/`
  (verificado por grep). React escapa por defecto; las instrucciones de ejercicios,
  descripciones y nombres se renderizan como **texto**.
- Importaciones (backup JSON, CSV FitNotes/Strong/Hevy, Apple Health XML) se **parsean y
  validan**; campos se truncan; nada se `eval`úa.

### 3.6 Secretos y datos
- **No hay secretos versionados** (`git ls-files` no muestra `secret`/`vapid`/`.env`); `data/`
  está en `.gitignore`. En el servidor, `data/secret` se crea con **modo 0600** y las claves
  VAPID se generan al primer arranque.
- **Privacidad:** sin telemetría. La suscripción push se guarda por usuario en el servidor.
  Guest/static: todo en el navegador (exportable).

### 3.7 DoS / abuso
- **Sin rate limiting** (por diseño; se delega en el proxy inverso). `readBody` limita a
  **5 MB**. Retos con TTL. Entropía de invitación 64 bits. En exposición pública se
  recomienda rate limit en el proxy.

### 3.8 Dependencias (supply chain)
`npm audit`: **19 avisos** — **ninguno en el bundle servido** al navegador (React/ReactDOM/
React Router/Zustand no figuran). Están en **tooling**: `@capacitor/{android,ios}` (críticos,
solo afectan a builds **nativos**), `@capacitor/cli`, `@trapezedev`, `vitest`, `sharp`, `tar`,
`handlebars`, `postcss`, `minimatch`, `nanoid`, `uuid`, `source-map-js`, `brace-expansion`,
`xmldom`. Triaje: aplicar `npm audit fix` para los arreglables; los nativos, actualizar
Capacitor antes de compilar.
- **Medios:** la build móvil usa el CDN de un tercero (`jsdelivr`) **sin SRI**; la build web
  estática **no incluye** `media/`, por lo que las animaciones dan **404** en el sitio
  desplegado (hallazgo QA, ver §4.6).

### 3.9 Modelo de amenazas del modo estático (importante)
- Al no haber servidor, **el usuario es dueño de sus datos** y puede editarlos (DevTools).
  Los **puntos/ledger son autoritativos del cliente**: no hay integridad frente a uno mismo.
  Es coherente con "app personal"; **no** usar para competición/leaderboards.
- No hay superficie de autenticación que romper, ni datos de terceros que filtrar.

---

## 4. QA — matriz de pruebas

### 4.1 El 405 (verificación del arreglo)
| Caso | Antes | Esperado ahora |
|---|---|---|
| Static: Ajustes (guest) | Botones passkey → 405 | **Sin** botones; filas "Local profile"/"Self-host" |
| Static: `boot()` | — | Entra invitado, **0** peticiones `/api` |
| Self-host: Ajustes (sin sesión) | Botones passkey | Botones passkey (funcionan) |

### 4.2 Passkeys (solo self-host, HTTPS + `docker compose`)
- [ ] Crear perfil (Face ID/Touch ID) → cookie de sesión emitida.
- [ ] Iniciar sesión con la misma passkey.
- [ ] Reto expirado (>5 min) → error claro.
- [ ] Credencial duplicada → 409.
- [ ] `INVITE_ONLY` → exige código válido; código usado/revocado → 403.
- [ ] "Sign out everywhere" (`sv`) invalida sesiones en todos los dispositivos.
- [ ] Cuenta `disabled` → 403 en login y en cada request.
- [ ] Admin: `/api/admin/*` sin admin → 403.
- [ ] Cookie en DevTools: `HttpOnly`, `SameSite=Lax`, `Secure` (con https).

### 4.3 Autorización/aislamiento
- [ ] `GET /api/data` sin cookie → 401.
- [ ] `GET /api/data` de A no devuelve datos de B (mismo servidor, dos perfiles).
- [ ] `uid` con caracteres raros no escribe fuera de `./data`.

### 4.4 PWA / static (GitHub Pages, Cloudflare)
- [ ] Arranca en invitado; crear/gestionar sesiones; puntos y ledger funcionan.
- [ ] Service worker registra en HTTPS; offline tras primera carga.
- [ ] "Instalar como app" (Android: prompt; iPhone: guía Safari).
- [ ] Exportar/Importar backup restaura todo (incluido `gam`).
- [ ] Actualización: tras un deploy, la versión nueva entra en 1–2 aperturas.

### 4.5 Regresión automatizada
- [x] `npm test` → **252 ✅** · `npm run test` en CI (workflow Pages).
- [x] `npm run build` / `npm run build:web` → OK.
- [ ] `node --check api/server.js` → OK.

### 4.6 Hallazgos QA adicionales (no bloqueantes)
- **Imágenes/GIF de ejercicios en la build web estática**: dan 404 (no se despliega `media/`).
  Opciones: (a) usar el **CDN** en `build:web` (como `build:mobile`), (b) desplegar `media/`
  (≈140 MB) o (c) dejarlo sin animaciones en el sitio público. **Decisión pendiente.**
- **TTS en iOS**: silencio con el **interruptor de silencio** por el altavoz (limitación de
  iOS; mitigado con desbloqueo de sesión + aviso en Ajustes).
- **Voz/almacenamiento**: `navigator.storage.persist()` es best-effort (Safari puede no
  implementarlo); el recordatorio de backup cubre el caso.
- **Herramientas**: `wrangler deploy` requiere `CI=true` en consola no interactiva; `git`
  necesita `DEVELOPER_DIR` por licencia de Xcode sin aceptar.

### 4.7 Dispositivos/navegadores sugeridos
iPhone Safari (PWA instalada), Android Chrome (instalada), Chrome/Firefox/Safari de
escritorio, y una instancia self-host para passkeys.

---

## 5. Recomendaciones priorizadas

**P0 (hecho)**
- Corregir el 405: no ofrecer passkeys sin backend (rama `STATIC` en Ajustes).

**P1 (recomendado)**
- Decidir los **medios** en la web estática (CDN con SRI o desplegar `media/`).
- `npm audit fix` para avisos arreglables; actualizar **Capacitor** antes de builds nativos.
- Añadir **rate limiting** en el proxy (self-host expuesto a Internet) y `Origin` check.
- Endurecer WebAuthn: `userVerification:'required'` (si el uso lo permite).

**P2 (nice to have)**
- **Token CSRF** o `SameSite=Strict` en la API.
- **CSP** (Content-Security-Policy) en nginx/Cloudflare y **SRI** en recursos de CDN.
- Cabeceras de seguridad (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- Firma/checksum en el backup exportado (detección de manipulación).
- Test E2E de passkeys (Playwright + autenticador virtual) en CI.

---

## 6. Referencias

- WebAuthn: `api/server.js` (challenge store, verify, sesión, admin).
- Cliente: `frontend/src/lib/api.js`, `frontend/src/views/Login.jsx`,
  `frontend/src/views/Settings.jsx`, `frontend/src/store/useStore.js` (`boot`).
- Despliegue: `docs/DEPLOY.md`. Datos/privacidad: `frontend/src/lib/*`, `NOTICE.md` (AGPL).
