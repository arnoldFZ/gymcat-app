# GYMPACT — cómo funciona la gamificación

GYMPACT premia la **constancia**, no el volumen. No se premia más peso,
calorías estimadas ni duración: solo **sesiones válidas**, semanas cumplidas y
rachas de semanas. Este documento describe el comportamiento implementado y
dónde vive cada pieza.

## Reglas (configurables)

Valores iniciales en `frontend/src/lib/gamification/rules.js` (`DEFAULT_RULES`):

| Evento | Puntos | Clave idempotente |
|---|---|---|
| Sesión válida finalizada | **+100** | `session:<workoutId>` |
| 3 sesiones válidas en la semana | **+150** | `week:<YYYY-Www>:bonus` |
| 4 semanas consecutivas cumpliendo la meta | **+300** | `cycle:<YYYY-Www>` |

Se pueden sobreescribir por perfil en `S.gam.rules` (p. ej. `{ weeklyTarget: 4 }`).
`rulesOf(S)` mezcla los overrides sobre los defaults, así que un perfil antiguo o
parcial sigue funcionando.

## Qué es una "sesión válida"

Finalizada y con **al menos un ejercicio y una serie completada**
(`isValidSession`). En el modelo existente, un entrenamiento solo llega a
`S.workouts` al finalizarlo y sus `entries` se filtran a las que tienen ≥1 serie
`done`; una sesión finalizada sin ninguna serie marcada no da puntos.

## Semanas en `America/Lima`

Todas las cuentas usan la zona `rules.tz` (**`America/Lima`** por defecto), no la
hora del dispositivo. La conversión pasa por `Intl.DateTimeFormat` con
`timeZone`, así que viajar no mueve la semana. La racha cuenta **semanas
cumplidas consecutivas**, no días. Límites probados: domingo/lunes, cambio de mes
y cambio de año (`2025-12-29` → `2026-W01`, etc.).

## Ledger e idempotencia

`S.gam.ledger` es una lista **append-only** de movimientos:
`{ id, type, delta, key, ref, meta, date }`.

- `applyEvents(ledger, events)` añade cada evento **solo si su `key` no existe**.
  Reprocesar el mismo evento no duplica puntos (probado).
- **Saldo** = suma de `delta`. No es un contador editable aparte; no puede
  desincronizarse.
- Cada movimiento de puntuación guarda `meta.ruleVersion` (por defecto `1`), de modo
  que cambiar las reglas en el futuro no reinterpreta el pasado.
- **Corregir una sesión** (en el detalle del entrenamiento, toca una serie para
  marcarla hecha/no hecha): `reconcileSessionEvents` lleva el **neto** de esa sesión a
  `+100` (válida) o `0` (ya no válida) con un movimiento `…:adj:<n>` idempotente. La
  sesión sigue en el historial; solo se añade un ajuste.
- **Borrar una sesión** (`WorkoutDetail` → Delete) añade un movimiento compensatorio
  `comp:session:<id>` que anula el **neto de toda la familia** (concesión + ajustes);
  **no borra** el historial. Los bonus semanales/de ciclo ya ganados se mantienen (se
  ganaron cuando la semana llegó a la meta).
- Los bonus semanales y de ciclo se evalúan contra **todo** el historial válido
  de la semana/ciclo, no solo contra las sesiones posteriores a la feature.

### Límite conocido

El estado se sincroniza con `PUT /api/data` (objeto completo, *last-write-wins*).
No hay transacciones. Se mitiga haciendo cada escritura idempotente, de modo que
reconciliar o reenviar estado **converge** en vez de duplicar. No se pretende
atomicidad multi-dispositivo.

## Recompensas

Catálogo personal en `S.gam.rewards`: `{ id, name, desc, cost, active }`.

- Se muestra asequibilidad; un canje **pide confirmación**.
- Sin saldo suficiente **se bloquea**.
- Un canje es un movimiento negativo con clave `redeem:<redemptionId>`. El id se
  genera **una vez por confirmación**, así que reintentar **no vuelve a
  descontar**.
- El historial de canjes vive en el propio ledger (el nombre se guarda en `meta`
  para que siga leyéndose si la recompensa se renombra o se borra).

## Dashboard y analítica

- **Home** (`views/Home.jsx`): meta semanal `X / 3` como elemento principal con
  barra de progreso, puntos disponibles, puntos ganados esta semana, racha de
  semanas cumplidas, recompensa próxima y botón iniciar/continuar. Los estados
  vacíos distinguen "sin datos" de "cero".
- **Stats** (`views/Stats.jsx`): tarjeta *Constancy* con puntos, racha,
  % de semanas cumplidas, sesiones por semana (últimas 8) y acceso a
  *Rewards & history*.

## Backups y compatibilidad

- Export/import de Settings incluye `gam` (el ledger y las recompensas viajan con
  el resto).
- Un backup **antiguo** (sin `gam`) se importa sin problema: los defaults
  aplican y el ledger arranca vacío.
- **No se otorgan puntos retroactivos** por historial importado o preexistente:
  los puntos de sesión se conceden al finalizar desde esta versión. Los bonus
  semanales/de ciclo sí consideran el historial válido existente al evaluarse.

## Código

```
frontend/src/lib/gamification/
  rules.js          # defaults + isValidSession
  weekly-goals.js   # semana ISO en tz, conteos por semana
  streaks.js        # semanas cumplidas consecutivas
  events.js         # eventos + claves idempotentes + orchestration del fin
  ledger.js         # append, idempotencia, saldo, compensación
  rewards.js        # catálogo, asequibilidad, canje idempotente
  selectors.js      # dashboardStats, recentWeeks, complianceRate
  index.js          # superficie pública
  __tests__/gamification.test.js
frontend/src/gamification.jsx   # hojas de UI: catálogo, canje, alta/edición
```

La lógica de dominio es **pura y sin React**. La frontera de finalización
(`doFinishWorkout` en `sheets.jsx`) solo *llama* al dominio; no contiene reglas.

## Pruebas

`cd frontend && npm test` — incluye los 12 criterios de aceptación y los límites
de zona (`America/Lima`), mes y año. `npm run build` para el bundle.

## Verificación manual en iPhone (checklist)

Lo automatizable está cubierto por tests; esto requiere un dispositivo y no se ha
ejecutado aquí. Al abrir en Safari (o como PWA añadida a inicio):

- [ ] Sin scroll horizontal en anchos de iPhone (375 / 390 / 430 px) y en el
  mínimo soportado (320 px).
- [ ] La tarjeta *Meta semanal* (barra, `X/3`, estadísticas) se lee bien y el botón
  iniciar/continuar es cómodo de pulsar.
- [ ] La hoja *Recompensas* funciona en pantalla pequeña; añadir/editar y canjear.
- [ ] En el detalle de un entrenamiento, tocar una serie cambia los puntos y avisa
  ("ya no es válida" / "vuelve a contar").
- [ ] Contraste correcto en tema claro y oscuro y con los 8 acentos; foco visible
  al navegar con teclado.
- [ ] VoiceOver: la barra de meta anuncia valor (`role="progressbar"`) y los
  botones tienen etiqueta.
- [ ] Áreas táctiles ≥ 44 px en los controles nuevos.

