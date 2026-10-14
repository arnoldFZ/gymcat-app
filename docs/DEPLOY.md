# Desplegar GymCat como web (GitHub + Cloudflare Pages)

Servir la app como **sitio estático HTTPS** te da la **PWA real** (offline, instalable,
almacenamiento persistente) **sin depender de ningún Mac encendido**.

En este modo la app funciona **solo en local** (modo invitado, `VITE_STATIC=1`): no hay
backend, así que **no hay sync entre dispositivos** — los datos viven en el navegador de
cada dispositivo. Para sync/passkeys necesitarías el backend (ver `docs/SELF_HOSTING.md`).

---

## 1. Subir el código a GitHub

El repo ya está versionado en local. Crea un repositorio **vacío** en GitHub (privado o
público) y empuja:

```bash
cd /Users/arnold/Desktop/opencode/gym
git remote add origin https://github.com/<tu-usuario>/gymcat.git
git branch -M main
git push -u origin main
```

> AGPL-3.0-or-later: si publicas la app, la **fuente debe seguir disponible**; tenerla en
> GitHub lo cumple. El `NOTICE.md` conserva la atribución original.

---

## 2. Publicar en Cloudflare Pages

### Opción A — Conectar el repo (recomendada, sin secretos)

Cloudflare Pages construye y despliega solo con cada push.

1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
2. Elige el repositorio.
3. Configuración de build:
   - **Framework preset:** None (o Vite)
   - **Root directory:** `frontend`
   - **Build command:** `npm ci && npm run build:web`
   - **Build output directory:** `dist`
4. **Save and Deploy**. En ~1 min tendrás `https://<proyecto>.pages.dev`.

### Opción B — GitHub Actions (incluido en el repo)

El repo trae `.github/workflows/deploy.yml`, que compila y publica con Wrangler.

1. Crea el proyecto en Cloudflare Pages una vez (o deja que lo cree el primer deploy).
2. En GitHub → **Settings → Secrets and variables → Actions**, añade:
   - `CLOUDFLARE_API_TOKEN` — token con permiso **Cloudflare Pages: Edit**.
   - `CLOUDFLARE_ACCOUNT_ID` — el ID de tu cuenta (panel de Cloudflare).
3. Un `push` a `main` (o *Run workflow*) construye, testea y despliega.

> Si prefieres no usar secretos, borra el workflow y usa la Opción A.

---

## 3. Instalarla en el iPhone

1. Abre la URL **https://…pages.dev** en **Safari**.
2. **Compartir → Añadir a pantalla de inicio** (o Ajustes → App → *Instalar como app*).
3. Ya es una **PWA instalada**: pantalla completa, **offline** y con almacenamiento
   **persistente** (iOS no la borra a los 7 días como a una pestaña normal).

---

## Notas

- **Datos por dispositivo.** Al no haber backend, lo que registres en el iPhone no
  aparece en el portátil. Muévelo con **Ajustes → Backup** (exportar/importar).
- **Dominio propio:** en Cloudflare Pages → *Custom domains* puedes añadir el tuyo.
- **Actualizaciones:** al hacer push, Cloudflare reconstruye; el service worker trae la
  versión nueva en la siguiente apertura.
- **Rutas:** la app usa `HashRouter`, así que **no necesita** rewrites/fallback de SPA.
