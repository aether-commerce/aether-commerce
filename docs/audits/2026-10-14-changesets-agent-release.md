# Changesets y promoción operable por agentes

Ampliación de la [auditoría CI/CD de Aether y Liminal](2026-10-14-cicd-liminal.md), 14 de octubre de 2026.

**Estado:** diagnóstico y diseño de optimización. Los comandos y automatizaciones propuestos en este documento todavía no están implementados.

El [plan integrado de corrección](2026-10-14-cicd-remediation-plan.md) ordena este trabajo junto con los 12 hallazgos iniciales e incluye su cobertura completa.

## Resultado de la revisión

Changesets genera versiones y changelogs correctamente en el caso revisado. El [PR #302](https://github.com/aether-commerce/aether-commerce/pull/302), desde `changeset-release/develop` a `develop`, tuvo [CI de pull_request correcto](https://github.com/aether-commerce/aether-commerce/actions/runs/38506217640) en el head `5de931011c9930fd177183768c92d6a3c72ad23e`. El flujo no necesita sustituir Changesets: necesita controles más precisos y una coordinación que continúe después de preparar el PR.

Se revisaron el workflow de preparación, publicación, CI, `check-changesets.mjs`, `check-release-policy.mjs`, configuración de Changesets, logs de preparación y código de la acción realmente descargada. Aether sigue en main `8a417cd` y develop `07be83f`. No había PR abiertos en Aether al consultar.

La acción descargada fue `changesets/action@a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d`. Esa revisión **sí acepta** el input `github-token`; no debe diagnosticarse como una opción inválida. Su [contrato](https://github.com/changesets/action/blob/a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d/action.yml) y su [manejo de Git](https://github.com/changesets/action/blob/a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d/src/git.ts) se inspeccionaron directamente.

## Hallazgos adicionales

### H13 — Alta: el preflight de changesets es permisivo y localmente puede no validar nada

**Comprobado por ejecución local:** `node scripts/check-changesets.mjs` sin `GITHUB_BASE_REF` termina correctamente indicando que solo aplica a PR. `check-release-policy.mjs` hace lo mismo. Un agente que ejecute la secuencia documentada fuera de Actions puede creer que verificó los metadatos cuando el script los omitió.

**Comprobado por lectura del código:** el checker solo exige que exista alguna nota añadida, alguna nota eliminada o algún cambio de versión en cualquier paquete público. No analiza el contenido de las notas ni comprueba que incluyan todos los paquetes modificados. Eliminar una nota o cambiar manualmente una versión abre la excepción de release sin demostrar que se trata del PR automatizado de versiones.

Esto permite, por ejemplo, modificar A y B y añadir una nota solo para A, o eliminar una nota pendiente sin generar correctamente las versiones. Son rutas aceptadas por las condiciones del script; no se afirma que un PR concreto haya cometido esos errores.

**Cambio recomendado:**

- Aceptar una base explícita, por ejemplo `--base origin/develop`, y mostrar SHA base/head y número de paquetes cubiertos. Un contexto ausente o inválido debe ser error cuando se solicitó validación.
- Usar el parser/configuración de Changesets para comprobar nombres, niveles semver, notas nuevas y cobertura de todos los paquetes publicables afectados.
- Distinguir PR de funcionalidad, PR de versiones y promoción. La excepción de versiones debe validar un plan reproducible contra la base y los changesets consumidos, además del actor/branch esperado; el nombre de rama solo no basta.
- Mantener `@changesets/cli/changelog`, y verificar changelogs y versiones generados, sin borrar notas para hacer pasar CI.
- No inferir automáticamente que todo cambio es patch: el agente propone semver según compatibilidad y el PR lo hace revisable.

**Aceptación:** fallan base ausente, nota inválida, paquete omitido y consumo indebido; pasan PR de funcionalidad bien cubierto, PR de versiones reproducible y promoción con versiones ya preparadas.

Fuente: [checker auditado](https://github.com/aether-commerce/aether-commerce/blob/8a417cd5d33580a151f78763652ddc07ebee6c8a/scripts/check-changesets.mjs).

### H14 — Alta: el mecanismo de actualización de la rama de release contradice la política sin force-push

El [run que creó #302](https://github.com/aether-commerce/aether-commerce/actions/runs/38506174507) ejecutó `git push origin HEAD:changeset-release/develop --force`. El código de la revisión descargada confirma que ese es el comportamiento de `git-cli`; el modo `github-api` también usa `force: true`. Cambiar de modo no resuelve por sí solo el conflicto con AGENTS.md.

El log observado muestra `dbf8d16..5de9310`, sin indicar un forced update efectivo en esa ocasión. Se demuestra que se utilizó una operación capaz de forzar, **no** que se hayan perdido commits en esa ejecución.

Además, el workflow fija otras acciones por SHA, pero deja Changesets en la etiqueta mutable `@v1`. El checkout persiste `github.token`, mientras la acción recibe `AETHER_RELEASE_TOKEN`: la identidad para Git y para la API no queda alineada explícitamente. El PR tuvo CI válido; no se presenta esto como fallo probado de autenticación.

**Cambio recomendado:** conservar el CLI oficial para versionar y generar changelogs; usar una implementación de actualización de rama que añada commits sin reescribir una rama activa. Comprobar el head remoto esperado, rechazar aportes humanos inesperados y no eliminar el branch mientras tenga PR abierto. Alinear explícitamente la identidad de bot para Git/API y fijar por SHA cualquier acción empleada. No basta cambiar `--force` por `--force-with-lease`: seguiría reescribiendo historia.

**Aceptación:** actualizar un PR de versiones conserva su historia; una carrera o commit ajeno produce un estado recuperable, no un sobrescrito. La política actual se mantiene sin excepción implícita.

### H15 — Media: preparar versiones no está coordinado con el CI de integración

`Prepare Aether package release` arranca con cada push a develop en paralelo a CI, y también tiene `workflow_dispatch` sin una condición que restrinja el job a develop. Instala dependencias y exige token incluso cuando no hay changesets. En la muestra hay ejecuciones correctas que solo informan que no existe trabajo.

Por ejemplo, el run `38520790101` terminó a las 06:12:21 UTC; el primer intento del CI de ese develop falló más tarde, a las 06:17:28. No había changesets en ese run, por lo que no demuestra un PR incorrecto; sí demuestra que el éxito de preparar release no certifica el CI.

**Cambio recomendado:**

1. Restringir la preparación a develop y un SHA de integración identificado.
2. Como opción preferida, iniciarla tras CI exitoso de push; una preparación especulativa podría conservarse para reducir latencia, pero debe quedar inequívocamente no promovible hasta que ese CI pase.
3. Antes de instalar, detectar si hay notas publicables y devolver `no_release_needed` cuando no las haya.
4. Reutilizar un solo PR de versiones y publicar sus outputs: número, head SHA, base SHA, versiones y estado.
5. Verificar vigencia después de adquirir concurrencia: serializar ejecuciones no evita que una antigua opere sobre una base superada.

**Aceptación:** un dispatch en main/rama de trabajo no crea release; un CI fallido no produce una release lista para integrar; dos ejecuciones concurrentes convergen en un único PR vigente.

### H16 — Alta: la condición de promoción incompleta se detecta demasiado tarde

`publish-packages.yml` rechaza changesets pendientes una vez fusionado main. El checker de política del PR a main exige head develop y prohíbe skip-ci, pero no exige que ya se haya cerrado el ciclo de versionado. El CI puede aceptar notas pendientes válidas y el workflow de deploy es independiente de publish.

Por configuración, una promoción sin completar Changesets podría desplegar la demo mientras publicación falla y Liminal no recibe una versión. Es un riesgo deducido del código; no se afirma que haya ocurrido en la release auditada.

**Cambio recomendado:** añadir a la validación del PR develop → main una condición temprana: cero changesets publicables pendientes, ningún PR de versiones necesario sin integrar, versiones/changelog coherentes y CI de integración aprobado. Conservar la comprobación de publicación como segunda defensa. Un cambio solo de documentación o infraestructura puede promoverse sin crear un release de paquetes.

**Aceptación:** CI del PR de promoción falla antes del merge si falta versionado. Si develop recibe cambios nuevos después, recalcular el plan y volver a validar el head; nunca usar el check del commit anterior.

### H17 — Media: publicación y notificación necesitan reanudación por release, no por apariencia del último diff

La detección de publicación usa `git diff HEAD^ HEAD` buscando archivos `packages/*/package.json`. Un cambio de manifest sin cambio de versión activa trabajo innecesario. El flujo no conserva un inventario propio de paquetes publicados/no publicados ni un acuse del cliente. Si falta el token de dispatch, el paso termina con éxito indicando Dependabot como alternativa.

El comando de Changesets puede detectar versiones ya publicadas; eso no sustituye un registro verificable de paquetes, integridad, tags y notificaciones para recuperar un fallo entre pasos. Tampoco debe exigirse que todas las etiquetas existentes de paquetes sin cambio apunten al nuevo commit.

**Cambio recomendado:**

- Generar el manifiesto de la release desde las versiones realmente nuevas respecto a la última release confirmada.
- Verificar presencia e integridad en el registro antes de marcar paquetes completos; relacionar cada versión/tag con su origen.
- Reintentar únicamente lo que falta después de un fallo parcial. No intentar reutilizar una versión publicada con contenido distinto.
- Enviar el dispatch solo cuando el conjunto esté completo. Guardar su resultado por release y esperar evidencia separada de PR/merge/deploy del cliente.
- Mostrar `notification_skipped` o `client_blocked` si no se entrega al cliente; nunca inferir entrega completa por salida 0.
- Si una release fallida queda superada por otra, reconciliar el inventario mediante un procedimiento explícito; no desplegar una revisión antigua para recuperar una publicación.

**Aceptación:** probar corte después de publicar algunos paquetes, después de publicar antes de tags y después de tags antes de dispatch. Todos se reanudan sin duplicar versiones ni anunciar éxito prematuro.

### H18 — Media: no existe un controlador que permita al agente terminar la cadena con estado verificable

El workflow de Changesets prepara un PR y termina. Ningún workflow de Aether auditado enlaza automáticamente su validación, integración, CI de push, creación de promoción, despliegue y resultado Liminal. El agente reconstruye esos pasos manualmente en cada conversación.

El paso 6 de promoción de AGENTS.md ya pide sincronizar main de vuelta a develop. El trabajo pendiente es automatizar y observar esa obligación, no volver a inventarla ni eliminarla.

**Cambio recomendado:** controlador reanudable con las fases y contratos siguientes, conservando PR, CI y revisiones requeridas. Una orden del usuario para llevar una release a producción autoriza continuar dentro de su alcance; el controlador no debe pedir otra confirmación para cada commit/push/check, ni deducir autorización para incluir cambios ajenos o hacer rollback destructivo.

## Diseño propuesto para la operación por agentes

### Interfaz única y legible por máquina

Nombres propuestos, todavía no disponibles:

| Operación | Función |
| --- | --- |
| `release:status --json` | Leer el estado de ambos repositorios sin mutaciones |
| `release:plan --target production --json` | Calcular fases, PR y validaciones que faltan; mostrar el alcance exacto |
| `release:resume --plan <id>` | Ejecutar la siguiente transición autorizada y reanudar tras interrupciones |
| `release:verify --release <id>` | Comprobar versiones vivas, publicación y cliente; emitir resultado completo o parcial |

El plan debe registrar repositorio, ramas canónicas, PR incluidos, SHA esperado, objetivo Aether/Liminal y política vigente. Antes de cada mutación, volver a leer estado remoto y comparar con ese plan. Una nueva release o aportes fuera de alcance obligan a recalcular, no a sobreescribir ni a promover de forma implícita.

Estados distintos para ausencia de trabajo, espera de CI, aprobación requerida, fallo, conflicto, superseded y completo. Cero checks no equivale a fallo técnico ni a aprobación; debe conservarse como estado pendiente limitado.

### Cadena propuesta

```text
Cambio y changeset revisables
  -> PR de trabajo a develop + CI del head
  -> merge + CI de push de develop
  -> detectar si hace falta release de paquetes
       -> sí: generar/actualizar único PR de Changesets
              -> CI del head -> merge -> nuevo CI de push de develop
       -> no: continuar con versiones actuales
  -> comprobar ancestry de main y develop, metadatos y alcance
       -> si falta main: PR de sincronización + CI + merge + CI de develop
  -> único PR develop a main
  -> CI de promoción del head vigente
  -> merge preservando historial
  -> CI de push main
  -> deploy Aether y publicación de paquetes con resultados separados
  -> smoke + manifiesto de release completo
  -> actualización Liminal fijada a ese manifiesto
  -> PR a development + CI + merge + CI de push
  -> PR development a main + CI + merge + CI de push
  -> deploy Liminal + smoke + comprobación de versiones
  -> resumen de release
  -> PR de sincronización main a integración y limpieza verificada
```

Si una release no cambia paquetes ni el contrato operativo del cliente, Liminal puede quedar `not_applicable`, con motivo explícito. Si cambia la plantilla o el workflow del cliente, debe existir un PR operativo específico: publicar paquetes no actualiza esos archivos.

El deploy de Aether y la publicación pueden permanecer en paralelo por rapidez. No se marca la entrega conjunta como completa hasta verificar ambos resultados y el cliente cuando corresponda. Cada parte expone estado aunque otra falle.

### Reglas del controlador

- Una sola coordinación activa por release/repositorio; revalidar SHA tras esperar un lock. Serialización no sustituye las comprobaciones de vigencia.
- Cada PR se identifica por repositorio, base, head y propósito; reutilizar el existente.
- Checks identificados por workflow esperado, evento, head actual, intento y actor confiable; asociar correctamente el check de PR a su head/merge de prueba. Un workflow_dispatch no suplanta CI de PR.
- Justo antes del merge, comprobar de nuevo head y estado; usar comparación de SHA esperado y dejar actuar la protección de GitHub. Sin bypass, commits vacíos ni force-push.
- Los controladores con credenciales de escritura solo ejecutan código confiable y validado. No ejecutar código de un PR arbitrario con secretos por el hecho de recibir workflow_run.
- Separar bot de PR/push, publicación, dispatch y Cloudflare. Comprobar capacidades sin imprimir secretos. Reutilizar credenciales correctas; rotar solo con causa.
- No mantener un runner esperando durante toda la cadena: pasos cortos por eventos, más reconciliación explícita para recuperar eventos perdidos. El agente consulta estado con espera progresiva.
- Escribir evidencia por intento y recuperar automáticamente desde GitHub tras reinicio del agente. Descargar logs del job/attempt fallido, no sustituirlos por el último intento exitoso.
- Limpiar ramas únicamente con PR fusionado, ausencia de commits exclusivos y comprobación de worktrees. La rama de Changesets se conserva mientras haya un PR activo y se recrea si vuelve a necesitarse tras limpieza autorizada.
- Agregar validación de esquema y pruebas de comportamiento al controlador; no depender solo de expresiones regulares sobre YAML.

### Registro por release en GitHub

Usar summary de Actions y artefactos JSON sin secretos; el registro Markdown conserva causas y decisiones. Campos mínimos:

```json
{
  "releaseId": "<repo>:<sha-main>",
  "status": "waiting_client_ci",
  "integrationSha": "<sha>",
  "productionSha": "<sha>",
  "versionPr": { "number": 0, "headSha": "<sha>", "ciRunId": 0 },
  "promotionPr": { "number": 0, "headSha": "<sha>", "ciRunId": 0 },
  "packages": { "status": "verified", "manifestDigest": "<sha256>" },
  "aetherDeploy": { "status": "verified", "runId": 0 },
  "client": { "repository": "aether-commerce/liminal-store", "status": "waiting_ci", "pr": 0 },
  "nextAction": "wait_for_current_client_head_ci",
  "blockingReason": null
}
```

Es un ejemplo de contrato; los valores 0 y SHA entre corchetes son marcadores, no evidencia. El registro es una vista: GitHub/registro/Cloudflare son las fuentes que se vuelven a consultar antes de una acción.

### Reparto de trabajo del agente

El agente principal decide alcance, compatibilidad, semver y revisión técnica. Las tareas mecánicas de Git, consultas de estado y monitorización pueden delegarse a GPT-6 Luna con esfuerzo alto, conforme a la preferencia del usuario. Las credenciales y las protecciones tienen la misma exigencia con cualquier modelo.

Ante espera ordinaria, continuar automáticamente; ante fallo de código, reparar en rama de trabajo; ante conflicto, resolver y repetir validaciones. Pedir al usuario solo una decisión que falte y cambie el alcance o una autorización nueva que realmente sea necesaria.

## Orden de implementación y pruebas de cierre

| Entrega | Cambio concreto | Pruebas exigidas |
| --- | --- | --- |
| A | Checker con base explícita, cobertura por paquete y guardia temprana de promoción | Sin base, notas inválidas/incompletas, consumo ilegítimo, versionado legítimo y promoción incompleta |
| B | Preparación de versiones por SHA vigente, rama de release sin reescritura y token coherente | No-op sin notas, dispatch en rama incorrecta, doble ejecución, commit ajeno y nuevo develop |
| C | Controlador status/plan/resume y evidencia en GitHub | Reinicio después de cada fase, checks tardíos, head modificado, intento fallido y CI de evento incorrecto |
| D | Manifiesto, publicación recuperable y entrega idempotente de Liminal | Publicación parcial, tags existentes correctos/incorrectos, dispatch repetido y cliente pendiente |
| E | Reducción de trabajo repetido y métricas | Misma cobertura del check requerido, bundles por ambiente y comparación de tiempos/costo |

Las entregas A–D corrigen fiabilidad; E reduce demoras sin retirar la evidencia necesaria. Aplicar también H01–H12 del informe principal, especialmente CI antes de deploy Liminal, aislamiento de ambientes y smoke semántico.

**Criterio de éxito global:** un agente recibe el alcance de una release y puede terminarla o explicar exactamente el bloqueo, con enlaces y SHA verificables, sin reconstruir manualmente la cadena ni pedir aprobaciones repetidas para acciones ya autorizadas. No se considera completo hasta verificar todos los destinos aplicables.

## Límites de la evidencia

Se reprodujo el no-op local de los checkers y se verificó el comando force en un log real. Las rutas permisivas de metadatos, el posible despacho desde otra rama, la promoción prematura y la recuperación parcial se determinaron por inspección; sus casos automatizados forman parte de la implementación propuesta. No se generaron versiones, no se publicaron paquetes y no se modificaron workflows ni secretos durante esta ampliación.
