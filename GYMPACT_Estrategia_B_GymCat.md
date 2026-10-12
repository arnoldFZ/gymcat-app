# GYMPACT --- Estrategia B: usar GymCat como base

## Instrucción para OpenCode

Trabaja en el repositorio GymCat (fork de openGym) donde se encuentre
este archivo. Primero inspecciona el código real y entrega una auditoría
antes de modificarlo. No asumas que la documentación está totalmente
actualizada. Conserva datos existentes y no hagas cambios destructivos
sin aprobación.

## Objetivo del producto

GYMPACT es una app personal para mantener la constancia en el gimnasio.
Meta inicial: **3 sesiones válidas por semana durante 4 semanas**.
Mobile-first, cómoda en iPhone, PWA si la base lo permite. Diseño
minimalista blanco/gris, jerarquía clara y acento moderado, inspirado en
la claridad de Apple Fitness sin copiar su identidad visual.

Flujo: **planificar → entrenar → finalizar sesión válida → ganar puntos
→ cumplir metas → canjear recompensas**.

## Estrategia

Usa GymCat/openGym como base. Conserva el motor de entrenamiento,
catálogo, rutinas, series, pesos, descansos e historial que ya existan.
La arquitectura documentada es React 19 + Vite + React Router + Zustand,
API Node y almacenamiento JSON; verifica todo en el repo real. **No
migres a Next.js, TypeScript o Supabase en esta estrategia.**

## Fase 0 --- Auditoría obligatoria

-   Lee `README`, `CLAUDE.md`, `NOTICE`, `LICENSE`, `package.json`,
    `docker-compose.yml` y documentación de desarrollo.
-   Revisa `git status`, rama y commits recientes.
-   Ejecuta pruebas y build antes de modificar.
-   Traza el ciclo de vida de una sesión y dónde se persiste.
-   Localiza el helper de finalización (por ejemplo, `finish-workout.js`
    si existe). Úsalo como frontera de integración; no metas reglas de
    puntos dentro de él.
-   No borres ni reinicialices datos.
-   Crea `docs/GYMPACT_AUDIT.md` con arquitectura real, comandos,
    resultados iniciales, riesgos y plan.

## Funciones del MVP

### Dashboard

Mostrar sesiones de esta semana respecto a la meta (`2/3`), puntos
disponibles y ganados esta semana, racha de semanas cumplidas,
recompensa próxima y botón para iniciar/continuar entrenamiento. Los
estados vacíos deben ser claros; no inventar datos.

### Sesión válida

Una sesión solo cuenta si está finalizada y tiene al menos un ejercicio
y una serie completada. Ajusta el criterio únicamente si el modelo
existente lo requiere y documenta la decisión. Reprocesar, editar o
reintentar una sesión no debe duplicar puntos.

### Reglas iniciales configurables

-   **100 puntos** por sesión válida finalizada.
-   **+150 puntos** al alcanzar 3 sesiones válidas en una semana.
-   **+300 puntos** al completar 4 semanas consecutivas cumpliendo la
    meta.

Son valores iniciales de gamificación, no una recomendación médica. No
premies más peso, calorías estimadas o duración: el objetivo es la
constancia. Define semanas en `America/Lima` y prueba límites
domingo/lunes, mes y año. La racha cuenta semanas cumplidas
consecutivas, no días consecutivos.

### Ledger e idempotencia

Implementa un registro auditable de movimientos con ID, tipo de evento,
delta de puntos, referencia a sesión/semana/recompensa, fecha, clave
idempotente y metadatos mínimos. El mismo evento procesado dos veces no
puede duplicar puntos. No dependas solo de un saldo editable. Si una
sesión se corrige o elimina, registra movimientos compensatorios; no
borres silenciosamente el historial. Si el almacenamiento JSON no
permite transacciones, minimiza estados parciales, documenta límites y
prueba recuperación.

### Recompensas

Catálogo personal editable con nombre, descripción, coste y estado
activo. Mostrar asequibilidad, pedir confirmación, guardar historial y
bloquear canjes sin saldo suficiente. El descuento y el registro de
canje deben ser coherentes; evita doble descuento por reintentos. No
impongas premios personales rígidos.

### Analítica

Sesiones por semana, cumplimiento de meta, puntos, racha e historial de
canjes. Distingue ausencia de datos de cero.

## Organización sugerida

Adapta la estructura a las convenciones existentes; no la fuerces si no
encaja:

``` text
frontend/src/lib/gamification/
  rules.js
  events.js
  ledger.js
  weekly-goals.js
  streaks.js
  rewards.js
  __tests__/
```

Mantén la lógica de dominio pura y separada de React/UI. Las reglas
deben ser deterministas y testeables. No añadas dependencias, TypeScript
ni infraestructura externa sin justificarlo.

## Diseño

-   Mobile-first, probado en anchos de iPhone.
-   Blanco/grises, tarjetas sobrias, acento limitado y alto contraste.
-   Meta semanal como elemento principal.
-   Controles táctiles cómodos, estados de carga/error/vacío/éxito, foco
    visible y etiquetas accesibles.
-   Evita animaciones que ralenticen registrar una sesión. No rediseñes
    toda la app si bastan cambios localizados.

## Pruebas de aceptación

Añade pruebas que demuestren: 1. Una sesión incompleta no da puntos. 2.
Una sesión válida da 100 puntos una sola vez. 3. Reprocesar el evento no
duplica puntos. 4. La tercera sesión concede el bonus semanal una vez.
5. La cuarta semana consecutiva concede el bonus de ciclo una vez. 6.
Una semana incumplida rompe la racha. 7. `America/Lima` determina
correctamente los límites semanales. 8. No se puede canjear con saldo
insuficiente. 9. Reintentar un canje no duplica descuentos. 10.
Corregir/eliminar una sesión mantiene el ledger coherente. 11. El
historial de entrenamiento existente sigue accesible. 12. El dashboard
funciona sin historial.

Ejecuta pruebas existentes, nuevas pruebas y build. Nunca declares un
test aprobado si no lo ejecutaste; documenta lo bloqueado.

## Licencia y seguridad

Verifica `LICENSE` y `NOTICE`. El repositorio está identificado como
**AGPL-3.0-or-later**; si distribuyes una versión modificada o la
ofreces como servicio de red, revisa obligaciones con asesoría
competente. Esto no es asesoría legal. Los medios del catálogo pueden
tener licencias distintas: no redistribuyas imágenes/GIF/vídeos sin
verificar sus términos. No subas secretos, no debilites autenticación y
no añadas telemetría de datos personales sin consentimiento.

## Fuera de alcance

No hacer todavía: red social, leaderboards, IA coach, Apple Health,
pagos, publicación comercial, migración a Supabase/Next.js, migración
general a TypeScript, reescritura del motor ni importación
indiscriminada de medios.

## Fases

1.  Auditoría y línea base.
2.  Dominio de gamificación, ledger e idempotencia con pruebas.
3.  Integración con finalización de sesiones y persistencia existente.
4.  Dashboard.
5.  Recompensas e historial.
6.  Pulido mobile, accesibilidad, backups, documentación y verificación.

Después de cada fase, resume archivos modificados, decisiones, pruebas
ejecutadas, defectos y próximos pasos. No continúes si hay un fallo
crítico de integridad.

## Comparación con estrategia C

Crea `docs/GYMPACT_EVALUATION.md` con tiempo real invertido,
funcionalidades completas/pendientes, tests/build, UX en iPhone,
fiabilidad de puntos/canjes, backup/recuperación, complejidad, deuda
técnica y mantenimiento. No declares B ganadora solo por reutilizar
código.

## Instrucción final

Primero audita; después presenta un plan basado en archivos reales.
Implementa incrementalmente y mantén el proyecto ejecutable en cada
hito. Pide aprobación antes de cambios destructivos, alteraciones de
autenticación o migraciones irreversibles.
