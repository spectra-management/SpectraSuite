# AGENTS.md — Standing Operating Instructions for Spectra Suite

> Pegá este archivo en la raíz del repo como `AGENTS.md` (o `CLAUDE.md`). Claude Code lo lee al
> arrancar en este proyecto y debe seguir estas reglas en CADA tarea, sin que el usuario tenga que
> repetirlas. El usuario (Mario) te hablará en español describiendo lo que quiere; vos planificás,
> construís, probás y dejás todo listo según estas reglas.

---

## 0. Idioma y trato
- El usuario habla español. Respondele en español, claro y sin tecnicismos innecesarios.
- No le pidas que copie/pegue prompts ni que haga pasos manuales que vos podés hacer. El objetivo
  de este documento es que vos hagas el máximo posible y a él le quede el mínimo.

---

## 1. Flujo de trabajo por defecto (hacé esto SIEMPRE, sin que te lo pidan)

Para cualquier tarea de cambio de código:

1. **Rama nueva siempre.** Creá una rama descriptiva desde `main` (ej. `feature/...`, `fix/...`).
   Nunca trabajes directo en `main`.
2. **Construí el cambio** siguiendo la arquitectura y reglas de abajo.
3. **PROBÁ TU PROPIO TRABAJO A FONDO antes de mostrar nada** (sección 2). Esta es la parte más
   importante. No le pases trabajo sin verificar al usuario.
4. **Arreglá tus propios errores.** Si los tests fallan, si el build rompe, si la UI queda mal —
   arreglalo vos antes de continuar. No le pases errores conocidos al usuario para que los pruebe él.
5. **Commit** con mensaje claro.
6. **Push de la rama** (esto está permitido — solo sube una rama, no toca producción).
7. **Decidí el merge según el nivel de riesgo** (sección 4).
8. **Dejá un resumen de 2 minutos** para el usuario (sección 5).

---

## 1b. Git: manejalo vos, en silencio. El usuario NO toca git.

El usuario no quiere tipear comandos de git nunca más. Vos manejás TODO el git por él, de forma
automática, sin pedirle que corra comandos y sin hacerlo un tema de conversación.

Reglas concretas:
- **Vos corrés todos los comandos de git** que la tarea necesite: `git checkout -b`, `git add`,
  `git commit`, `git push` de la rama, cambiar de rama, traer cambios. El usuario no debe correr
  ninguno a mano.
- **Antes de crear una rama, sincronizá main:** hacé `git checkout main` y `git pull` para partir
  de la última versión, así evitás que el local quede atrasado y se generen rechazos de push o
  divergencias. (Esto previene exactamente el enredo de ramas/cherry-pick que hay que evitar.)
- **Creá la rama desde un main actualizado.** Nunca dejes commits sueltos en la rama equivocada.
- **Hacé push de la rama vos mismo** apenas el trabajo esté probado y commiteado. El push de una
  rama de trabajo está siempre permitido (no toca producción).
- **No narres cada comando de git ni muestres su salida cruda.** Resumí en una línea: "Creé la rama
  `feature/x`, commiteé y la subí." El usuario quiere el resultado, no el detalle.
- **Si algo de git se enreda** (divergencia, rechazo de push, conflicto), resolvelo vos de la forma
  más segura y conservadora posible y explicá en una frase qué pasó — pero NUNCA uses `--force`,
  `reset --hard`, ni nada destructivo sin avisar y pedir confirmación primero.
- **El ÚNICO git que el usuario decide** es el merge final a `main` de cambios de ALTO RIESGO
  (ver sección 4). Todo lo demás —ramas, commits, push— es tuyo y automático.

En resumen: el usuario te habla en español, vos hacés que el git suceda solo. Él no debería ver ni
pensar en comandos de git, salvo para aprobar el merge de lo sensible.

---

## 2. Pruebas: hacelas vos, no el usuario

El usuario está cansado de probar todo a mano. Antes de declarar una tarea lista, vos debés:

- Correr `npm run build` — debe pasar sin errores.
- Correr `npm run check:imports` (o `lint:imports`) — sin imports cruzados ni ciclos.
- Correr `npm test` / `npm run test:run` — todos los tests existentes deben seguir pasando, y debés
  AGREGAR tests nuevos para lo que construiste.
- Si la tarea tiene lógica (cálculos, flujos, condiciones), escribí tests que la verifiquen y corrélos.
- Levantá la app si hace falta para verificar que no rompiste el render.
- Si algo falla en cualquiera de estos pasos: arreglalo y volvé a correr. Iterá hasta que todo pase.

**Lo único que NO podés verificar vos, y debe quedar para el usuario:** que un número de negocio
sea correcto contra la realidad (ej. que el neto de una nómina o el total de una factura dé el valor
correcto según las reglas reales). Vos podés verificar que el código corre y que los tests pasan,
pero no podés saber si la *regla de negocio* estaba bien entendida. Para esos casos, en el resumen
decile exactamente qué número debe verificar él y contra qué (ver sección 5).

---

## 2a. Verificación visual de UI con Playwright (OBLIGATORIA para cambios de UI)

Para CUALQUIER tarea que cambie la interfaz (componentes, páginas, estilos, layout), además de
los tests unitarios, antes de dar la tarea por terminada debés verificar el render real en el
navegador con Playwright:

1. **Levantá la app con Playwright.** `npm run test:e2e` arranca el dev server solo y corre los
   specs de `e2e/`. (La primera vez en una máquina nueva: `npm run e2e:install` para bajar el
   navegador.) Si ya tenés un dev server corriendo, apuntá a él con `PW_BASE_URL`.
2. **Navegá a la pantalla afectada.** Escribí o extendé un spec en `e2e/` que vaya a la ruta que
   tocaste (usá `e2e/smoke.spec.ts` como plantilla). Si la pantalla está detrás del login, corré
   sin variables de Supabase (la app omite auth cuando no hay `VITE_SUPABASE_*`) o iniciá sesión
   dentro del spec.
3. **Sacá un screenshot** con el helper `screenshot(page, 'nombre')` (de `e2e/helpers.ts`). Queda
   en `e2e/screenshots/nombre.png`.
4. **Revisá la imagen vos mismo.** Abrí el PNG y confirmá que renderiza bien: sin pantalla en
   blanco ni error, sin elementos encimados/cortados, contenido correcto, y consistente con el
   resto de Spectra Suite (claro/oscuro, ES/EN).
5. **Recién entonces** considerá la tarea terminada. Si el screenshot muestra algo mal, arreglalo
   y repetí — no le pases una UI rota al usuario.

Los screenshots de revisión viven en `e2e/screenshots/` (ignorados por git; son artefactos). La
config está en `playwright.config.ts`; los specs de Playwright (`e2e/`) están excluidos de Vitest.

---

## 3. Reglas duras de seguridad (NUNCA las violes, aunque el usuario lo pida en el momento)

Estas existen porque el sistema maneja sueldos y facturación de gente real. Si el usuario pide algo
que las cruza, explicale por qué no y ofrecé la alternativa segura.

- **NUNCA correr migraciones de Supabase ni comandos destructivos de base de datos.** Si una tarea
  necesita SQL, generá el archivo de migración y dejá el SQL listo para que el usuario lo corra a
  mano en el panel de Supabase. Explicá qué hace antes de que lo corra.
- **NUNCA configurar buckets de Storage, políticas RLS, ni permisos de acceso vos mismo.** Generá el
  SQL/instrucciones y que el usuario lo aplique.
- **NUNCA exponer credenciales** (API keys, tokens) en URLs del cliente, logs, ni código. Las
  credenciales van del lado del servidor (process.env) o en la tabla `integrations`.
- **NUNCA borrar datos de forma irreversible.** Un "reset a cero" o cualquier borrado masivo requiere
  confirmación explícita del usuario y debe preservar lo que él indique.
- **NUNCA toques el motor de cálculo de nómina (ISR, AFP, SFS, holiday, vacaciones) salvo que la
  tarea sea explícitamente sobre eso.** Si tenés que tocarlo, los tests existentes de nómina deben
  seguir pasando sin cambios, y avisá en el resumen que tocaste cálculo.

---

## 4. Merge: regla por nivel de riesgo

Después del push, decidí el merge así:

### BAJO RIESGO → podés mergear vos a `main` directamente
Solo si el cambio es puramente cosmético/superficial y NO toca datos, cálculos ni permisos:
- Textos, traducciones (ES/EN), etiquetas.
- Colores, espaciados, estilos, ajustes visuales de UI.
- Cambios de copy o de documentación.
Para estos, mergeá a `main` y avisá en el resumen que lo hiciste. Igual deben pasar build + tests primero.

### ALTO RIESGO → NO mergees. Dejá la rama lista y esperá al usuario.
Cualquier cosa que toque:
- Cálculo de nómina, ISR, deducciones, vacaciones.
- Billing / facturación / rates / invoices.
- Persistencia de datos, migraciones SQL, esquema de base de datos.
- Permisos, roles, RBAC, autenticación.
- Credenciales de connectors.
- Borrado o migración de datos.
Para estos: push de la rama, dejá el resumen con qué debe verificar, y **esperá su confirmación
explícita antes de mergear**. El merge a producción de estas cosas lo decide él.

### Ante la duda → tratalo como ALTO RIESGO. Si no estás seguro de en qué categoría cae, no mergees.

---

## 5. El resumen para el usuario (dejáselo siempre, corto)

Cuando termines una tarea, dejá un resumen en español que él pueda leer en 2 minutos:

1. **Qué hiciste** (1-3 líneas).
2. **Qué verificaste vos** (build ✅, tests ✅ X/X, imports ✅) — para que sepa que ya está probado.
3. **Qué necesita verificar ÉL**, si aplica: el número/valor de negocio exacto y contra qué compararlo.
   Ej: "Verificá que el neto de [empleado] en esta nómina dé RD$X según el cálculo manual."
4. **Riesgo y merge:** "Lo mergeé a main (bajo riesgo)" o "Es alto riesgo, la rama está en `feature/...`,
   decime si la mergeo."
5. **SQL pendiente**, si hay: qué archivo correr en Supabase y qué hace.
6. **Decisiones que tomaste** que él debería conocer.

---

## 6. Arquitectura del proyecto (respetala siempre)

- Estructura modular: `src/modules/{nomina,rrhh,facturacion,gastos,it}`, `src/shared`, `src/suite`.
- **Aislamiento de módulos:** un módulo NO importa de otro módulo. Solo de `@/shared`. Para compartir
  datos entre módulos, usá/creá un accesor en `@/shared/lib`. Ver `IMPORT_RULES.md`.
- **Offline-first cloud-authoritative:** localStorage es la capa rápida local, pero Supabase es la
  fuente de verdad durable que se lee de vuelta al iniciar sesión. Los datos nuevos deben persistir a
  Supabase Y leerse de vuelta, no quedar solo en localStorage. Conflicto: gana la nube; los registros
  que solo existen local se suben.
- **Diseño:** dark mode, ES/EN (sin strings hardcodeados), shadcn/ui, componentes de `@/shared`.
  Todo módulo nuevo debe verse idéntico al resto de Spectra Suite.
- **Audit log:** registrá acciones significativas vía el RPC server-side existente.
- **Permisos:** respetá el RBAC existente. Datos sensibles (sueldos, documentos, connectors) detrás
  de los checks fuertes (admin / super_admin según corresponda).

---

## 7. Cómo manejar errores y bloqueos

- Si te trabás, NO pares toda la tarea: documentá el bloqueo y seguí con lo que sí podés.
- Si un cambio no compila, aislalo para que el resto del branch siga compilando, y avisá.
- Mantené un archivo de progreso (`*_PROGRESS.md`) en tareas grandes, escrito a medida que avanzás,
  para que el progreso sobreviva si te quedás sin contexto.

---

## 8. Lo que el usuario te dará y lo que NO

- Te va a describir QUÉ quiere, en español. Vos definís el CÓMO y le mostrás decisiones si son importantes.
- NO esperes que él corra build/tests/pruebas técnicas — eso es tuyo.
- SÍ esperá que él: confirme merges de alto riesgo, verifique números de negocio contra la realidad,
  corra el SQL en Supabase, y tome decisiones de diseño/negocio que vos no podés decidir solo.

---

## Resumen en una línea
Trabajás solo de punta a punta —rama, código, pruebas, arreglos, TODO el git (commits y push
automáticos, sin que el usuario toque la terminal), y resumen— y dejás para el usuario únicamente:
el SQL en Supabase, la verificación de números de negocio, y el merge a producción de lo sensible.
Todo lo demás es tuyo.
