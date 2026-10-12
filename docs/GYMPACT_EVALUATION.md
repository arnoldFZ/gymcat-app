# GYMPACT — Evaluación (Estrategia B, base GymCat/openGym)

Documento pedido por el spec de la Estrategia B ("Comparación con estrategia C").
La Estrategia C (app independiente Next.js + Supabase) **no se ha implementado**
en esta sesión; se compara contra su spec, no contra un artefacto ejecutado. No se
declara B ganadora por reutilizar código: se exponen costes y límites reales.

> Tiempos de la columna "B" medidos en la sesión de trabajo real (wall-clock del
> agente), redondeados. Las estimaciones de C son analíticas, sin implementar.

## 1. Tiempo real invertido (Estrategia B)

| Fase | Trabajo | Tiempo aprox. |
|---|---|---|
| 0 | Extraer base, auditoría, baseline tests+build, `GYMPACT_AUDIT.md` | ~6 min |
| 1 | Renombrado a GymCat (data-compat + atribución preservadas) | ~3 min |
| 2 | Dominio puro + 27 tests | ~3 min |
| 3 | Integración fin de sesión + borrado + estado `gam` | ~2 min |
| 4 | Dashboard en Home | ~2 min |
| 5 | Recompensas (catálogo/canje/edición) + analítica en Stats | ~3 min |
| 6 | Docs, evaluación y verificación | ~4 min |
| **Total** | | **~23 min** |

Contexto: el motor de entrenamiento, catálogo de 1.324 ejercicios, rutinas, series,
pesos, descansos, historial, PWA y passkeys ya existían y no se reescribieron.

## 2. Funcionalidades

### Completas (B)
- Sesión válida (finalizada + ≥1 ejercicio y ≥1 serie) y **100 pts** por sesión.
- **+150** al alcanzar 3 en la semana; **+300** por 4 semanas consecutivas.
- Semanas en **`America/Lima`** vía `Intl` (no hora del dispositivo); límites
  domingo/lunes, mes y año probados.
- **Ledger append-only** con idempotencia por clave; saldo derivado (no editable).
- **Compensación** al borrar sesión; nunca se borra historial.
- **Recompensas** personales: alta/edición/desactivación, asequibilidad,
  confirmación de canje, bloqueo sin saldo, historial, canje idempotente.
- **Dashboard** (Home): meta `X/3` como elemento principal, barra, puntos
  disponibles/semana, racha, recompensa próxima, iniciar/continuar; estados
  vacíos honestos.
- **Analítica** (Stats): puntos, racha, % de semanas cumplidas, sesiones/semana.
- **Corrección de sesión**: desde el detalle del entrenamiento se marca/desmarca
  una serie; el ledger reconcilia el neto de la sesión (invalidar quita puntos,
  volver a validar los restaura) sin borrar historial, y se **recalculan el volumen
  y los PRs** de esa sesión contra el resto del historial.
- **`ruleVersion`** en cada movimiento de puntuación.
- **Idiomas principales: inglés y español**, ambos **100% completos** (claves nuevas
  y cadenas preexistentes de demo/self-host). El resto de idiomas siguen
  disponibles y caen a inglés en lo no traducido.
- Renombrado a **GymCat** conservando compatibilidad de datos y atribución.

### Pendientes / no hechas
- **No hay puntos retroactivos** por historial previo/importado (decisión
  documentada, no un descuido).
- **No hay autoridad de servidor** sobre los puntos (ver §5).

## 3. Tests y build

| | B (real, ejecutado) |
|---|---|
| `npm test` | ✅ **8 ficheros, 221 tests** (192 base + 29 nuevos) |
| `npm run build` | ✅ Vite, ~0,4 s (aviso de chunk > 1,5 MB, preexistente) |
| Cobertura de aceptación | 12/12 del spec B en dominio + corrección de sesión |

Criterios 1–12 del spec B: 1,2,3 (sesión/duplicados), 4 (bonus semanal),
5,6 (ciclo y racha), 7 (Lima), 8,9 (canjes), 10 (coherencia al borrar/corregir),
11 (historial intacto/no mutado), 12 (dashboard sin historial) — todos automatizados.

## 4. UX en iPhone

- Reutiliza el design system existente (tokens claro/oscuro, 8 acentos, tarjetas
  sobrias, `Button`/`Switch`/`NumberField` propios), así que el lenguaje visual es
  idéntico al resto de la app y ya está probado en anchos de iPhone.
- Tarjeta de meta con barra de progreso, `role="progressbar"` y `aria-*`.
- Acciones con botón nativo y foco visible; las filas de recompensa siguen el
  patrón de lista existente (no son `<button>`, igual que el resto de la app:
  deuda de accesibilidad heredada, no introducida aquí).

## 5. Fiabilidad de puntos y canjes

- **Idempotencia real**: reprocesar el mismo evento o reintentar un canje no
  duplica (probado).
- **Sin transacciones**: el estado es *last-write-wins* sobre `PUT /api/data`.
  La idempotencia hace que reconciliar converja, pero **no hay atomicidad**
  multi-dispositivo ni defensa contra edición manual del `localStorage`. Para una
  app **personal** (el objetivo declarado) es aceptable; para multiusuario serio es
  un límite real. C lo resuelve con RPC SQL + constraint única + RLS.
- El saldo nunca se lee de un contador editable: siempre se deriva del ledger.

## 6. Backup y recuperación

- Export/import de Settings ya serializa todo `S`, ahora incluido `gam`.
- Backup antiguo (sin `gam`) importa sin error; ledger arranca vacío.
- Límite: si dos dispositivos editan offline y ambos suben, gana el `_ts` más
  reciente (pérdida posible de movimientos ajenos). Documentado.

## 7. Comparación con la Estrategia C (spec, no implementada)

| Dimensión | B (GymCat) | C (Next.js + Supabase) |
|---|---|---|
| Puesta en marcha | 0 infra; ya está el motor | Proyecto Supabase, migraciones, Auth, RLS, deploy |
| Motor de entrenamiento | Reutilizado (probado, 1.324 ejercicios) | Reimplementar modelos/sesiones desde cero |
| Integridad de puntos | Idempotencia en cliente, sin transacción | RPC transaccional + unique + RLS (más fuerte) |
| Autoridad del cliente | El cliente calcula y escribe puntos | El servidor concede; el cliente no puede |
| Riesgo multi-dispositivo | *Last-write-wins* | Consistente en servidor |
| Esfuerzo total | Bajo (~23 min sobre base existente) | Alto (stack nuevo + migraciones + pruebas integración) |
| Deuda técnica | Sync sin transacciones; reglas sin `rule_version` | Esquema/migraciones que mantener; ecosistema mayor |
| Coste operativo | Docker local / PWA; sin servicios | Hosting + Supabase (free tier, con límites) |
| Timezone/rachas | Ya probado | Reimplementar |
| Licencia | Base **AGPL-3.0-or-later**; media no redistribuible | Solo referencia; sin copiar AGPL sin revisar |

## 8. Deuda técnica y mantenimiento (B)

1. Depender de idempotencia en cliente, no de transacción. Aceptable para uso
   personal; revisar si se vuelve multi-usuario.
2. Semana/racha calculada a partir de `S.workouts` en cada lectura (no
   materializada). Rápido para volúmenes personales; vigilar con historial enorme.
3. Idiomas: **inglés y español son los mantenidos y están completos**; los otros 10
   siguen disponibles pero caen a inglés en las cadenas nuevas.
4. 19 vulnerabilidades en el árbol de dependencias (preexistentes, no atribuibles
   a esta feature) y chunks grandes (preexistente).

## 9. Coste operativo estimado

- **B**: 0 € además de lo que ya hubiera (Docker en tu máquina/PWA). Sin cuentas ni
  servicios externos. Backups = exportar JSON.
- **C**: 0 € en free tier de Supabase para uso personal, pero con límites
  (pausas por inactividad, cuotas) y una cuenta/tercero de por medio; el frontend
  necesita hosting.

## 10. Conclusión

Para **uso personal** —el objetivo del producto— la Estrategia B entrega el MVP
completo y probado en una fracción del esfuerzo, porque **el motor ya existía**. Su
debilidad es de integridad distribuida, no de funcionalidad: puntos y canjes son
idempotentes pero no transaccionales, y confían en el cliente.

La Estrategia C solo compensa ese costo si aparecen requisitos que B no puede dar
sin trabajo extra: **autoridad de servidor sobre los puntos, RLS y consistencia
entre dispositivos**. Como no se implementó, no hay evidencia de su tiempo real ni
de su UX; su ventaja es arquitectónica y su precio es reimplementar lo que B
reutiliza.

Recomendación pragmática: mantener B; si el uso se vuelve multiusuario o se
necesita integridad fuerte, mover **solo el ledger/canjes** a una función
transaccional (aunque sea la API Node existente con `saveDb` atómico y una clave
única), sin tirar el motor.
