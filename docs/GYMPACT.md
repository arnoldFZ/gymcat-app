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
parcial sigue funcionando. **Se editan desde la app**: Ajustes → *Puntos y
recompensas* → *Reglas de puntuación* (sesiones/semana, puntos por sesión, bonus
semanal, semanas por ciclo, bonus de ciclo y zona horaria de la semana), con opción
de *Restablecer valores por defecto*. Los cambios solo afectan a puntos futuros: cada
movimiento guarda la `ruleVersion` con la que se calculó.
Además, desde el **dashboard** puedes editar la **meta de una semana concreta**
(una semana ligera), que se guarda en `S.gam.weekTargets[weekKey]` y solo afecta a esa
semana (incluido cuándo se concede el bonus semanal).

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
  sesión sigue en el historial; solo se añade un ajuste. Además se recalculan el
  volumen y los PRs de esa sesión contra el resto del historial (nunca contra sí misma).
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
- Si el catálogo está vacío, un botón **opcional** *Añadir recompensas de ejemplo*
  propone tres (café, día de descanso, equipamiento), editables o borrables: no se
  impone ningún premio personal.
- **Exportar / Importar** el catálogo a un archivo (`gymcat-rewards-*.json`); al
  importar se **fusiona** (no sobrescribe) y se omiten las recompensas con el mismo
  nombre. El backup completo (Ajustes) sigue incluyendo el catálogo y el ledger.

## Dashboard y analítica

- **Home** (`views/Home.jsx`): meta semanal `X / 3` como elemento principal con
  barra de progreso, puntos disponibles, puntos ganados esta semana, racha de
  semanas cumplidas, **progreso hacia el bonus de ciclo** (p. ej. `3/4 semanas hacia
  +300`), **resumen de la última sesión**, recompensa próxima y botón
  iniciar/continuar. Los estados vacíos distinguen "sin datos" de "cero".
- **Stats** (`views/Stats.jsx`): tarjeta *Constancy* con puntos, racha,
  % de semanas cumplidas, sesiones por semana (últimas 8), **gráfica de puntos por
  semana** (12 semanas) y acceso a *Rewards & history* y *Points history*.
- **Aviso semanal** (opt-in, Ajustes): al finalizar una sesión, si queda **1** para
  cumplir la meta, avisa con un *toast* y, si hay permiso de notificaciones, con una
  **notificación local** (service worker). No requiere backend.
- **Push con la app cerrada**: con el backend en marcha y notificaciones activadas, el
  servidor envía *"te falta 1 sesión para cumplir la semana"* a la hora del recordatorio
  (una vez al día, solo si queda exactamente 1). Reutiliza la zona y hora del recordatorio.

## Registro auditable (Points history)

Ajustes → *Puntos y recompensas* → *Historial de puntos* (y desde Stats) muestra
cada movimiento del ledger: sesión, bonus semanal/de ciclo, canje y ajustes por
corrección/borrado, con fecha, referencia y delta. Arriba resume el saldo y el
desglose ("X en sesiones · Y en bonus · Z gastados"). Nada se borra: las
correcciones y borrados aparecen como movimientos, no desaparecen. Se puede
**exportar** el historial a un archivo (`gymcat-points-*.json`) e **importarlo**
(fusión por clave idempotente: solo añade movimientos que falten, nunca duplica).

## Planes sugeridos

`frontend/src/lib/plans.js` define plantillas listas para cargar (una pulsación), de
**2 a 6 días** para elegir según el tiempo disponible: **Principiante · 3 días**,
**Cuerpo completo · 2 días**, **Cuerpo completo · 3 días**, **Empuje / Tirón / Pierna ·
3 días**, **Torso / Pierna · 4 días**, **Split clásico · 5 días** (un grupo por día) y
**Empuje / Tirón / Pierna · 6 días**. Las de 3 días encajan con la meta semanal de
GYMPACT. Se abren desde Inicio, Plan y Ajustes (`plansSheet`); al cargar, se añaden
las rutinas y se fija el horario semanal (las rutinas existentes se conservan). Los
nombres se traducen al idioma actual en el momento de cargar. Un test valida que
todos los ids de ejercicio existan en el catálogo y no sean cardio, y que existan
planes de 2 a 6 días.

## Voz hablada (instrucciones)

Cada ejercicio se puede **escuchar**: un botón con altavoz en el detalle del ejercicio
(y en la cabecera del ejercicio durante el entrenamiento) lee el nombre y los pasos
con la **voz del sistema** vía Web Speech API — sin audios que descargar ni
dependencias. El idioma de la voz es **inglés o español**: sigue el idioma de la app,
o se fuerza en Ajustes → *Voz de los ejercicios* (`Auto` / `EN` / `ES` / `Off`). Lee
las instrucciones localizadas cuando están disponibles (español), con el nombre del
ejercicio tal cual (los nombres del catálogo son en inglés). En iOS Safari la voz
requiere el gesto del toque, así que solo habla cuando pulsas el botón.

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

Idiomas: **inglés (origen) y español** son los principales y están **100%
completos** (incluidas demo/self-host); el resto de idiomas siguen disponibles y
caen a inglés en lo que no esté traducido.

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

