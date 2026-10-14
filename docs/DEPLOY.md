# Desplegar GymCat como web (GitHub Pages o Cloudflare Pages)

Servir la app como **sitio estático HTTPS** te da la **PWA real** (offline, instalable,
almacenamiento persistente) **sin depender de ningún Mac encendido**.

En este modo la app funciona **solo en local** (invitado, `VITE_STATIC=1`): sin backend, así
que **no hay sync entre dispositivos** — los datos viven en el navegador de cada uno. Para
sync/passkeys haría falta el backend (`docs/SELF_HOSTING.md`).

El repo ya trae **dos workflows**:
- `.github/workflows/pages.yml` → **GitHub Pages** automático (sin secretos). **Recomendado.**
- `.github/workflows/deploy.yml` → **Cloudflare Pages** manual (necesita secretos).

---

## Subir el código a GitHub

```bash
cd /Users/arnold/Desktop/opencode/gym
gh repo create gymcat --public --source=. --remote=origin --push
```

(O manualmente: crea el repo vacío y `git remote add origin … && git push -u origin main`.)
> Necesita repo **público** para Pages gratis. AGPL-3.0-or-later: publicar mantiene la
> fuente disponible; `NOTICE.md` conserva la atribución original.

---

## Opción A — GitHub Pages (automático, sin secretos)

1. Activa Pages una vez (build type = *workflow*):
   ```bash
   gh api -X POST repos/<owner>/gymcat/pages -f build_type=workflow
   ```
2. Cada `push` a `main` compila, testea y publica. La URL queda:
   **https://<owner>.github.io/gymcat/**
3. Estado del despliegue: `gh run list` o la pestaña **Actions**.

## Opción B — Cloudflare Pages (dashboard, sin secretos)

1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → eliges el repo.
2. Build:
   - **Root directory:** `frontend`
   - **Build command:** `npm ci && npm run build:web`
   - **Build output directory:** `dist`
3. Deploy → `https://<proyecto>.pages.dev`. Añade un **dominio propio** en *Custom domains*.

## Opción C — Cloudflare Pages (GitHub Actions, manual)

1. Crea el proyecto en Cloudflare Pages una vez.
2. GitHub → **Settings → Secrets and variables → Actions**:
   - `CLOUDFLARE_API_TOKEN` (permiso **Cloudflare Pages: Edit**)
   - `CLOUDFLARE_ACCOUNT_ID`
3. **Actions → "Deploy to Cloudflare Pages (manual)" → Run workflow**.

---

## Instalarla en el iPhone

1. Abre la URL **https://…** en **Safari**.
2. **Compartir → Añadir a pantalla de inicio** (o Ajustes → App → *Instalar como app*).
3. Ya es una **PWA instalada**: pantalla completa, **offline** y con almacenamiento
   **persistente** (iOS no la borra a los 7 días como a una pestaña normal).

---

## Notas

- **Datos por dispositivo.** Sin backend, lo del iPhone no aparece en el portátil; muévelo
  con **Ajustes → Backup** (exportar/importar).
- **Actualizaciones:** al hacer push se reconstruye; el service worker trae lo nuevo en la
  siguiente apertura.
- **Rutas:** la app usa `HashRouter` y `base: './'`, así que funciona igual en la raíz o en
  un subpath (`/gymcat/`) **sin** rewrites de SPA.
