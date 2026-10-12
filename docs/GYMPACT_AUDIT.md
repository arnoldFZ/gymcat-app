# GYMPACT — Auditoría Fase 0

> Documento de línea base. Generado tras inspeccionar el código real y ejecutar
> pruebas y build, **antes** de modificar nada. No se borraron ni reinicializaron
> datos.

Fecha de auditoría: 2026-10-11
Estrategia: **B — usar GymCat/openGym como base**.

---

## 0. Cómo se obtuvo la base (discrepancia a resolver)

El spec dice *"Trabaja en el repositorio GymCat (fork de openGym) donde se
encuentre este archivo"*. En el disco **no existía ningún repo clonado ni carpeta
de código** en `/Users/arnold/Desktop/opencode/gym` (solo el spec `.md`). La única
base disponible era:

```
/Users/arnold/Library/Mobile Documents/com~apple~CloudDocs/openGym-main.zip
```

Es el árbol de **openGym** upstream (`DuarteSantos8/openGym`, `v1.2.4`), no un fork
llamado *GymCat*. Se extrajo y se normalizó como raíz del proyecto en
`/Users/arnold/Desktop/opencode/gym` (junto al spec), que es ahora el repositorio de
trabajo.

Notas relevantes de esa fuente:

- **No hay `.git`**: es un ZIP de GitHub, sin historial, sin rama y sin `git status`.
  No se pueden revisar "commits recientes". Si se quiere historial hay que
  `git init` o clonar upstream.
- **No existe `CLAUDE.md`** ni documentación de desarrollo para agentes. Los docs
  presentes son `docs/MOBILE.md` y `docs/SELF_HOSTING.md`.
- El ZIP incluye `data/secret`, `data/vapid.json` y `data/db.json` con un perfil ya
  registrado (`Arvids`) y su passkey. Son **datos existentes**: se conservan tal cual.

---

## 1. Arquitectura real (verificada en el código)

Coincide con lo documentado en el spec, con matices.

| Capa | Tecnología real | Ficheros clave |
|---|---|---|
| Frontend | React **19.2.7**, Vite **8**, React Router **7.18** (`HashRouter`), Zustand **5** | `frontend/src/*` |
| Estado | Un único objeto `S` serializado; store `useStore` | `frontend/src/store/useStore.js` |
| Persistencia cliente | `localStorage` clave `gym_state_v1` | `useStore.js` |
| Backend | Node sin framework, `node:http` | `api/server.js` |
| Persistencia servidor | JSON por usuario: `data/state-<uid>.json`, escritura atómica (`writeFileSync` + `rename`) | `api/server.js:45-53` |
| Auth | Passkeys/WebAuthn (`@simplewebauthn/server`), cookie firmada HMAC | `api/server.js:147-201` |
| Empuje | Web Push / VAPID, recordatorios por tz del usuario | `api/server.js:55-145` |
| Móvil | Capacitor 7 (Android/iOS), sin backend (estado en fichero) | `frontend/src/lib/mobile.js` |
| Tests | Vitest 4 (`npm test`) | `frontend/src/lib/*.test.js` |
| i18n | Inglés como clave, 12 idiomas lazy-loaded | `frontend/src/lib/i18n.js` |

Observaciones:

- **No hay TypeScript, ni Next.js, ni Supabase, ni base de datos SQL.** El spec pide
  no migrar a eso: se respeta.
- El "almacenamiento JSON" del spec corresponde a **dos** sitios: `localStorage` en el
  cliente y `state-<uid>.json` en el servidor. El servidor guarda **el objeto `S`
  completo** (`PUT /api/data`), y **elimina `active`** (las sesiones en curso son
  locales al dispositivo).
- La sincronización multi-dispositivo es **last-write-wins** sobre el objeto `S`
  completo, con `_ts` y bandera `gym_dirty` offline. **No hay transacciones.**

### Diseño existente (a reutilizar)

- Mobile-first ya resuelto. Tokens CSS en `frontend/src/index.css`:
  `--bg`, `--surface`, `--surface-2/3`, `--label/2/3/4`, `--acc`, `--acc-soft`,
  `--acc-line`, `--on-acc`. Tema claro/oscuro y **8 acentos**.
- Componentes reutilizables: `components/ui.jsx` (`Button`, `Slider`, `Switch`,
  `Segmented`, `SelectRow`, `Row`), `Icon`, `Heatmap`, `LineChart`, `BodyMap`,
  `Modals`, `Toast`, `RestTimer`. Ninguna librería UI externa.
- Patrón de hojas modales: `sheets.jsx` (`openSheet`, `confirmSheet`, `toast`).
- Ya existe `streakWeeks(S)` en `lib/history.js:238` (rachas de semanas con
  entrenamiento) y `weekKey()` en `lib/format.js:35`. **Se reutilizan como base,
  no se reinventan**, pero su noción de "semana"/"racha" no coincide con la del spec
  (ver §5).

---

## 2. Ciclo de vida de una sesión (trazado)

1. **Plan** → `S.week` (día→id de rutina) y `S.dayPlan` (overrides por fecha).
2. **Inicio** → `startFlow(routineId)` en `frontend/src/sheets.jsx:823` crea
   `S.active = { id, d: todayISO(), start, routineId, name, bw, cur, entries }`.
   `entries[]` se rellena con `buildSets(...)` (precarga pesos de la última vez).
3. **Entrenar** → `views/Workout.jsx` marca `set.done`. `S.active` se persiste como
   cualquier cambio, pero el servidor lo descarta: solo vive en el dispositivo.
4. **Finalizar** → **`finishWorkout()`** (confirmaciones) y **`doFinishWorkout()`**
   en `frontend/src/sheets.jsx:926-969` (la frontera real de integración).
   Construye `w = { id, d, start, end, routineId, name, bw, entries, prs, vol }`,
   donde `entries` se **filtra a las que tienen ≥1 serie `done`**, y hace:
   `update(s => { …; s.workouts.push(w); s.active = null })`.
5. **Persistir** → `useStore.update` → `persist()` → `localStorage` + `pushState()`
   debounced 1.5 s → `PUT /api/data` → `state-<uid>.json`.
6. **Reintentar/editar/eliminar** → no hay "reprocesar" ni "editar" sesión. Sí hay
   **eliminar**: `sheets.jsx:762` hace `s.workouts = s.workouts.filter(x => x.id !== w.id)`
   **en silencio, sin compensación**.

### Frontera de integración (decisión clave)

El spec menciona `finish-workout.js` "si existe". **No existe un fichero así.** El
helper real es **`doFinishWorkout()` en `frontend/src/sheets.jsx`**. Se usará **solo
como punto de enganche**: se llamará a un módulo de dominio puro, sin meter reglas de
puntos dentro del helper.

### Datos existentes que NO se tocan

- `data/db.json` (usuario + credencial), `data/secret`, `data/vapid.json`.
- Cualquier `state-*.json` y el `localStorage` del usuario. Los cambios al objeto `S`
  son **aditivos** (nuevas claves opcionales) para no romper estados antiguos.

---

## 3. Comandos del proyecto

```bash
# Frontend (donde está el motor y las pruebas)
cd frontend
npm ci          # instala dependencias (Node 26 / npm 11 disponibles)
npm test        # vitest run
npm run build   # vite build
npm run dev     # servidor de desarrollo (proxy /api -> :3000)

# Backend (opcional, para sync multi-dispositivo)
cd api && node server.js     # requiere env PORT, DATA_DIR, RP_ID, ORIGIN

# Alternativa completa
docker compose up -d         # api + web + descarga de media (~140 MB)
```

---

## 4. Resultados iniciales (ejecutados hoy, línea base)

| Comprobación | Comando | Resultado |
|---|---|---|
| Instalación | `npm ci` | OK. 19 vulnerabilidades reportadas (5 mod, 10 high, 4 crit) en dep tree; ver §6. |
| Tests | `npm test` | ✅ **7 ficheros, 192 tests pasan** (495 ms). |
| Build | `npm run build` | ✅ Build OK (~640 ms). Aviso: chunks > 1500 kB (p. ej. `index` 1.285 MB, `hi` 1.58 MB). |
| Git | `git status` | ❌ No es repo git (ZIP sin `.git`). |
| Datos | — | Intactos (`data/db.json` con perfil `Arvids`). |

Ficheros de test existentes: `demoSeed`, `effort`, `history`, `import-effort`,
`onerm`, `progression`, `wakelock`.

---

## 5. Brechas frente al spec (qué falta)

| Requisito del spec | Estado hoy | Dónde encaja |
|---|---|---|
| Sesión válida (finalizada, ≥1 ejercicio y ≥1 serie) | El modelo ya filtra `entries` a las con ≥1 serie `done`; falta **definir y poder consultar** "sesión válida" de forma explícita y **no premiar duplicados** | `gamification/rules.js` + hooks en `sheets.jsx` |
| **100 pts** por sesión válida | No existe | dominio nuevo |
| **+150** por 3 sesiones/semana | No existe | `gamification/weekly-goals.js` |
| **+300** por 4 semanas consecutivas cumpliendo meta | Existe `streakWeeks` genérico, **no** el concepto de "semanas cumplidas" | `gamification/streaks.js` (nuevo) |
| Ledger auditable + **idempotencia** | No existe | `gamification/ledger.js` |
| Compensación al borrar/corregir sesión | Hoy borrar es silencioso | ganchos en `sheets.jsx:762` |
| Recompensas (catálogo, canje, saldo) | No existe | `gamification/rewards.js` + UI |
| Analítica (sesiones/semana, cumplimiento, puntos, racha, canjes) | Hay `Stats.jsx` con heatmap/volumen/1RM, **sin** nada de gamificación | `views/Stats.jsx` |
| Dashboard con meta `2/3`, puntos, racha, próxima recompensa | `Home.jsx` tiene tarjeta semanal y racha genérica, **sin** meta ni puntos | `views/Home.jsx` |
| Semanas en **`America/Lima`** | Hoy usa **hora local del dispositivo** (`format.js` con `getFullYear/getDay`, `weekKey`), no un tz fijo | nuevo helper puro con `Intl` |
| Tests de aceptación 1–12 | Solo existen los tests actuales; faltan los 12 del spec | `gamification/__tests__/` |

Punto delicado de fechas: **todo el cálculo actual es en hora local del navegador**.
El spec exige que la semana se defina en `America/Lima`. Hay que introducir límites
de semana *explícitos por tz* y no reutilizar `weekKey()` tal cual (mezclaría tz del
dispositivo). El servidor ya tiene un patrón válido: `userNow(tz)` en
`api/server.js:112` con `Intl.DateTimeFormat(..., { timeZone })`.

---

## 6. Riesgos y límites

1. **Sin transacciones / last-write-wins.** El estado entero se sobrescribe. Dos
   dispositivos concurrentes pueden perder movimientos de ledger. Mitigación:
   ledger **append-only dentro de `S`** con **clave idempotente** por evento, de modo
   que reaplicar el mismo evento sea inofensivo; y documentar que la sync multi-equipo
   no es atómica (el spec lo permite explícitamente).
2. **Idempotencia dependiente del modelo.** Claves derivadas de `workout.id`, del
   `weekKey` en Lima y del id de recompensa. Los ids existentes (`uid()`) son únicos;
   los importados podrían repetir `d`. Hay que usar `workout.id` como referencia.
3. **Borrado silencioso actual.** Si no se añade compensación, borrar una sesión
   dejaría puntos "fantasma". Se añade movimiento compensatorio (no se borra historial).
4. **Migración de estado.** `loadState()`/`pullState()` hacen `Object.assign(clone(DEF), raw)`:
   añadir claves nuevas a `DEF` es seguro y retrocompatible; estado antiguo sin `ledger`
   arranca vacío. No se debe reinicializar.
5. **`active` es local.** El bonus semanal solo puede concederse de forma fiable al
   finalizar (evento), no mientras se entrena.
6. **Seguridad/licencia.** El ZIP trae `data/secret` y `data/vapid.json` (secretos de
   plantilla) y `data/db.json` con una credencial real. No se deben subir/registrar.
   Licencia **AGPL-3.0-or-later** (`LICENSE`) + `NOTICE.md`: la media de ejercicios
   **no** es AGPL y no se redistribuye; el cuerpo humano viene de MuscleMap (MIT). No
   debilitar auth, no añadir telemetría.
7. **Chunk grande y 19 vulnerabilidades** en el árbol de dependencias (no se resuelven
   aquí sin justificación; fuera del alcance salvo que rompa algo).

---

## 7. Plan de implementación por fases (basado en los ficheros reales)

Estructura propuesta, adaptada a las convenciones existentes (JS puro, sin TS):

```
frontend/src/lib/gamification/
  rules.js          # constantes y función pura: ¿sesión válida? + puntos base
  events.js         # event → clave idempotente (session/week/cycle/redeem)
  ledger.js         # apply(events) append-only, dedupe por clave, balance, compensación
  weekly-goals.js   # semana ISO en tz (America/Lima), sesiones válidas/semana, meta
  streaks.js        # semanas cumplidas consecutivas (+bonus de ciclo 4 semanas)
  rewards.js        # catálogo, asequibilidad, canje idempotente
  __tests__/*.test.js
```

- **Fase 2 — Dominio + ledger + idempotencia (puro y testeado).** `rules`,
  `events`, `ledger`, `weekly-goals`, `streaks`, `rewards` sin React. Tests de
  aceptación 1–10, 12 (los que no necesitan UI) y límites domingo/lunes, mes y año en
  `America/Lima`. Puntos base 100/+150/+300 configurables.
- **Fase 3 — Integración con la persistencia existente.** Enganchar en
  `doFinishWorkout()` (`sheets.jsx:926`) para emitir eventos al finalizar, y en el
  borrado (`sheets.jsx:762`) para emitir compensación. Añadir claves de gamificación a
  `DEF` en `useStore.js` (retrocompatible). Sin tocar el motor ni el modelo de sesión.
- **Fase 4 — Dashboard (`Home.jsx`).** Meta `X/3`, puntos disponibles y de la semana,
  racha de semanas cumplidas, recompensa próxima, botón iniciar/continuar. Estados
  vacíos claros.
- **Fase 5 — Recompensas e historial.** Catálogo editable (nombre/desc/coste/activo),
  confirmación de canje, bloqueo sin saldo, historial. UI con componentes existentes.
- **Fase 6 — Pulido, accesibilidad, backups, docs.** Mobile-first en anchos iPhone,
  foco visible, etiquetas; export/import coherente con el ledger; `GYMPACT_EVALUATION.md`.

**Frontera respetada:** la lógica de puntos vive en `lib/gamification/*` (pura); el
helper de finalización solo *llama*, no contiene reglas.

### Criterios de aceptación → dónde se prueban

1, 2, 3 → `rules`/`events`/`ledger`. 4 → `weekly-goals`. 5, 6 → `streaks`.
7 → `weekly-goals` (tz). 8, 9 → `rewards`. 10 → `ledger` (compensación).
11 → regresión de `history`/`Stats`. 12 → render de dashboard vacío.

---

## 8. Decisiones que necesitan tu aprobación antes de las fases 3+

- **Nombre del proyecto:** ¿se queda `openGym` o se renombra a `GymCat`/`GYMPACT`?
  (renombrar toca `package.json`, `docker-compose`, GHCR y passkeys/RP_NAME).
- **`git init`:** no hay historial. ¿Creo un repo local (sin remoto) para poder
  revisar diffs por fase, o trabajo sin git?
- **Base real:** ¿te sirve openGym-main como base, o tienes un fork **GymCat**
  concreto que quieras que use en su lugar?
- **Comportamiento de sync:** confirmar que se acepta la idempotencia + last-write-wins
  (sin backend transaccional) como límite documentado, según permite el spec.

---

## 9. Actualización (decisiones y fases completadas)

Decisiones tomadas con el usuario y ejecutadas:

- **Nombre:** renombrado a **GymCat** (marca, `package.json`, `docker-compose`,
  `RP_NAME`, Capacitor `appName`), conservando a propósito identificadores de
  compatibilidad de datos (`gym_state_v1`, `opengym-state.json`, marcador de plan
  `opengym_plan`, `appId` de Capacitor) y las URLs de atribución upstream.
- **Git:** `git init` local (sin remoto); baseline `d276e02`, renombrado,
  dominio+tests, integración y UI en commits separados.
- **Base:** se usó `openGym-main.zip` (upstream `v1.2.4`), al no existir fork
  GymCat previo.
- **Sync:** se acepta idempotencia + last-write-wins como límite documentado
  (ver `docs/GYMPACT.md` §"Límite conocido" y `docs/GYMPACT_EVALUATION.md` §5).
- **Docker:** las imágenes dejan de apuntar a GHCR de upstream
  (`gymcat-api` / `gymcat-web` se construyen localmente con `--build`).

Fases 1–6 completadas; ver `docs/GYMPACT.md` (feature) y
`docs/GYMPACT_EVALUATION.md` (B vs C). Estado: `npm test` 221 ✅,
`npm run build` ✅.

