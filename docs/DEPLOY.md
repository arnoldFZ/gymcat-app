# Desplegar GymCat como web (GitHub Pages o Cloudflare)

Servir la app como **sitio estático HTTPS** te da la **PWA real** (offline, instalable,
almacenamiento persistente) **sin depender de ningún Mac encendido**.

Funciona en **modo local** (invitado, `VITE_STATIC=1`): sin backend, así que **no hay sync
entre dispositivos** — los datos viven en el navegador de cada uno. Para sync/passkeys
haría falta el backend (`docs/SELF_HOSTING.md`).

El repo trae **dos workflows**:
- `.github/workflows/pages.yml` → **GitHub Pages** automático (sin secretos). **Recomendado.**
- `.github/workflows/deploy.yml` → **Cloudflare** manual (necesita secretos).

---

## Subir el código a GitHub

```bash
cd /Users/arnold/Desktop/opencode/gym
gh repo create gymcat-app --public --source=. --remote=origin --push
```
(Manual: crea el repo vacío y `git remote add origin … && git push -u origin main`.)
> Necesita repo **público** para Pages gratis. AGPL-3.0-or-later: publicar mantiene la
> fuente disponible; `NOTICE.md` conserva la atribución original.

---

## Opción A — GitHub Pages (automático, sin secretos)

Activa Pages una vez y cada push construye, testea y publica:

```bash
gh api -X POST repos/<owner>/gymcat-app/pages -f build_type=workflow
```

URL: **https://<owner>.github.io/gymcat-app/**

## Opción B — Cloudflare (Workers static assets)

La app se publica como **Worker con assets estáticos** (`frontend/wrangler.jsonc`).

**Local (con tu sesión de Wrangler):**
```bash
cd frontend
npm run build:web
npm run deploy            # = CI=true npx wrangler@4 deploy
```
`wrangler login` una vez si no tienes sesión. URL: **https://gymcat.<tu-subdominio>.workers.dev**.

**Desde GitHub Actions (manual):** *Actions → "Deploy to Cloudflare (manual)" → Run workflow*.
Necesita los secrets `CLOUDFLARE_API_TOKEN` (permiso *Workers/Pages: Edit*) y
`CLOUDFLARE_ACCOUNT_ID`.

> ¿Dominio propio? En Cloudflare → el Worker → **Settings → Domains & Routes → Add custom domain**.

> Alternativa clásica (Cloudflare **Pages** por Git): *Workers & Pages → Create → Pages →
> Connect to Git*, Root directory `frontend`, build `npm ci && npm run build:web`, output `dist`.

---

## Instalarla en el iPhone

1. Abre la URL **https://…** en **Safari**.
2. **Compartir → Añadir a pantalla de inicio** (o Ajustes → App → *Instalar como app*).
3. Ya es una **PWA instalada**: pantalla completa, **offline** y con almacenamiento
   **persistente** (iOS no la borra a los 7 días como a una pestaña normal).

---

## Notas

- **Datos por dispositivo.** Sin backend, lo del iPhone no aparece en el portátil; muévelo
  con **Ajustes → Backup** (exportar/importar). La app recuerda **cuándo fue la última
  copia** (Ajustes → *Data* → *Last backup*) y el dashboard avisa si hace mucho.
- **¿Se borran solos?** En **Safari sin instalar**, iOS puede purgar el almacenamiento tras
  **7 días sin abrir la web** (ITP). Una **app añadida a la pantalla de inicio queda exenta**
  de ese tope y conserva los datos; aun así haz copias: sin servidor, los datos viven solo
  en ese dispositivo. La app pide además *almacenamiento persistente* donde el navegador lo
  soporte (`navigator.storage.persist`).
- **Actualizaciones:** al hacer push se reconstruye; el service worker trae lo nuevo en la
  siguiente apertura.
- **Rutas:** la app usa `HashRouter` y `base: './'`, así que funciona igual en la raíz o en
  un subpath (`/gymcat-app/`) **sin** rewrites de SPA.
- **Git:** si `git` falla por la licencia de Xcode, usa
  `DEVELOPER_DIR=/Library/Developer/CommandLineTools git …` o acepta la licencia
  (`sudo xcodebuild -license accept`).
