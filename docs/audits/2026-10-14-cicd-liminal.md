# Auditoría de CI/CD: Aether y Liminal

Fecha: 14 de octubre de 2026. Estado: auditoría terminada; correcciones propuestas, todavía no implementadas.

Ejecución propuesta: [plan de corrección de los 18 hallazgos](2026-10-14-cicd-remediation-plan.md), con etapas, dependencias, criterios de cierre y pruebas de aceptación.

## Conclusión

Aether logra desplegar, pero su promoción exige demasiada coordinación manual y repite validaciones costosas. La entrega automática a Liminal está interrumpida: el aviso de publicación llega, pero la actualización no completa integración y producción. Primero debe repararse la fiabilidad de esa cadena; después reducir sus tiempos sin eliminar controles.

No hay evidencia de que comprar Cloudflare Paid resuelva estos problemas. Los hallazgos principales están en la automatización de GitHub, la selección de revisiones, la duplicación de tareas y las verificaciones posteriores.

## Alcance y evidencia

Se contrastó [el registro de incidentes](../ci-cd-observations.md) con workflows, scripts, protecciones y ejecuciones reales de ambos repositorios. Las lecturas remotas fueron de consulta; no se modificaron permisos, secretos, PR ni producción.

Revisiones auditadas:

- Aether `main`: `8a417cd5d33580a151f78763652ddc07ebee6c8a`.
- Aether `develop`: `07be83f3c87a724d290d61d72bacb9ee8a7e03ad`.
- Liminal `main`: `adf0bfffd809fa615979d1415ab5faf8f2595b56`.
- Liminal `development`: `85c41fcf2f55b4c005770cc94fcd8c8f1e119211`.
- Liminal también conserva `develop`, divergente de `development`: esta última tiene 30 commits por delante y 1 por detrás respecto a aquella, según Compare API.

El checkout principal de Aether está en una rama antigua con cambios sin confirmar. Se consultó el código de las revisiones remotas, y el informe se preparó en una rama limpia desde `origin/develop`. Los borradores locales de optimización no se consideran desplegados.

Los tiempos crudos de seis ejecuciones están en [2026-10-14-cicd-timings.json](2026-10-14-cicd-timings.json). Son mediciones de esta muestra, no percentiles históricos.

La ampliación [Changesets y promoción operable por agentes](2026-10-14-changesets-agent-release.md) añade los hallazgos H13–H18 y un contrato propuesto de coordinación reanudable hasta producción. La auditoría comprende ahora **18 hallazgos**. El diseño conserva los checks y la promoción por PR; las automatizaciones propuestas todavía no están implementadas.

## Estado verificado

| Tramo | Resultado |
| --- | --- |
| Aether CI de push a main | Correcto, SHA 8a417cd |
| Producción Aether | Workflow correcto, mismo SHA de checkout |
| Publicación Aether y dispatch | Correctos; el dispatch no certifica el resultado del cliente |
| Última actualización Liminal | Falló, ejecución 38523074834 |
| PR Liminal #121 | Abierto; CI 38523178942 en `action_required`, sin jobs |
| Cola de actualizaciones Liminal | 17 PR abiertos, #105 a #121 |
| Último deploy Liminal registrado | 8 de octubre, main adf0bff; ejecución 37770025016 correcta |
| Últimas 20 ejecuciones por repository_dispatch de Liminal | Fallidas, desde 8 de octubre 09:04 UTC; no se atribuye a todas la misma causa sin revisar cada log |

Fuentes: [actualización fallida](https://github.com/aether-commerce/liminal-store/actions/runs/38523074834), [CI bloqueado](https://github.com/aether-commerce/liminal-store/actions/runs/38523178942), [PR #121](https://github.com/aether-commerce/liminal-store/pull/121), [último despliegue](https://github.com/aether-commerce/liminal-store/actions/runs/37770025016).

El último deploy es evidencia de Actions; no se inspeccionó en esta auditoría la revisión viva de Cloudflare de Liminal. Tampoco se le atribuye una actualización posterior por el solo hecho de recibir un dispatch.

## Hallazgos priorizados

### H01 — Alta: Liminal se bloquea por el actor de automatización y una carrera al esperar CI

**Evidencia.** `aether-update.yml` crea y opera el PR con `secrets.GITHUB_TOKEN`. A las 06:36:13 UTC del 14 de octubre, `gh pr checks --watch --fail-fast` terminó con `no checks reported`, código 1. El CI apareció a las 06:36:15 y quedó en `action_required`. El PR #120 obtuvo CI verde después de aprobación, pero la ejecución original de actualización ya había terminado: no existe una continuación por ese resultado.

**Causa.** Se confunden tres estados: checks todavía no creados, aprobación requerida y validación fallida. El workflow espera todo dentro del mismo job y no reanuda después. Además, el actor elegido requiere aprobación para los eventos de PR.

La documentación vigente de [GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token) explica esa aprobación y recomienda una GitHub App o PAT para automatización sin ese paso. También indica que los pushes hechos con GITHUB_TOKEN no disparan normalmente otros workflows: conservarlo para fusionar puede cortar el siguiente CI aunque se arregle la espera inicial.

**Corrección.** Usar una identidad de automatización acotada a los repositorios necesarios, para checkout/push, creación/actualización y merge. Evaluar primero las credenciales existentes; el dispatch actual funciona y no justifica rotarlo. Separar preparación del PR de continuación tras CI. Esta última debe verificar repositorio, rama, SHA actual, evento y resultado antes de fusionar. Una espera limitada puede aceptar temporalmente cero checks, pero debe terminar en un estado explícito, nunca en éxito ficticio.

**Aceptación.** Un dispatch abre/actualiza un PR, su CI arranca sin intervención ordinaria, y el flujo continúa en el mismo SHA. Simular checks tardíos, fallidos, aprobación pendiente y un nuevo commit durante la espera.

Código: [Liminal aether-update.yml](https://github.com/aether-commerce/liminal-store/blob/adf0bfffd809fa615979d1415ab5faf8f2595b56/.github/workflows/aether-update.yml).

### H02 — Alta: cada intento crea otro PR y no hay recuperación idempotente

**Evidencia.** La rama se llama `automation/aether-update-${GITHUB_RUN_ID}`; existen 17 PR abiertos de esa automatización. Volver a ejecutar no retoma el trabajo pendiente. Se incluye `git add ... apps ...`, y el PR #121 modifica dos `tsconfig.tsbuildinfo`.

**Impacto.** Cola redundante, más aprobaciones y checks, revisiones obsoletas y ruido generado durante las pruebas.

**Corrección.** Un único PR activo sobre una rama estable mientras haya actualización pendiente; actualizarla sin sobrescribir aportes ajenos ni forzar ramas activas. Registrar la release objetivo y reanudar desde el estado remoto. Cerrar los PR anteriores solo después de comprobar que no contienen cambios exclusivos que deban conservarse. Ignorar y retirar del versionado los `*.tsbuildinfo`; preparar únicamente archivos esperados.

**Aceptación.** Dos dispatch iguales producen un solo PR; un reintento tras fallo lo retoma; una release posterior actualiza el PR pendiente con su nuevo manifiesto; un commit humano inesperado detiene la automatización con diagnóstico.

### H03 — Alta: Liminal despliega sin esperar su CI y acepta dos ramas distintas de desarrollo

**Evidencia.** `deploy.yml` arranca con `push` a `main`, `develop` y `development`. No depende de `Validate Liminal client`. Hace typecheck/build, pero no ejecuta la validación completa que incluye tests y `check:aether-mobile-zoom`. El bootstrap de recursos ocurre antes de los typechecks. `AGENTS.md` del cliente declara `development` como rama canónica; el workflow acepta además la rama `develop`, que está divergente. Ambos ambientes comparten el grupo de concurrencia.

**Impacto.** Un test fallido puede coexistir con un despliegue; una rama antigua puede cambiar desarrollo; un deploy de desarrollo puede retrasar producción. Son riesgos por configuración, no un incidente de producción probado en esta lectura.

**Corrección.** Disparar por CI exitoso de push y hacer checkout del SHA validado, o usar un workflow reutilizable con dependencias explícitas. Reconocer solo `main` y la rama canónica configurada, y separar concurrencia por ambiente. Validar antes de crear/modificar infraestructura. Conservar una vía de reintento que compruebe la validación exacta.

**Limitación comprobada.** La consulta a branch protection de Liminal devolvió HTTP 403 indicando restricción del plan para ese repositorio privado. No se pudo acreditar una protección equivalente a Aether. Los controles dentro de Actions mejoran el flujo, pero no sustituyen una protección de ramas aplicada por GitHub. No se recomienda cambiar visibilidad ni plan automáticamente.

Código: [deploy Liminal](https://github.com/aether-commerce/liminal-store/blob/adf0bfffd809fa615979d1415ab5faf8f2595b56/.github/workflows/deploy.yml), [CI Liminal](https://github.com/aether-commerce/liminal-store/blob/adf0bfffd809fa615979d1415ab5faf8f2595b56/.github/workflows/ci.yml), [reglas Liminal](https://github.com/aether-commerce/liminal-store/blob/adf0bfffd809fa615979d1415ab5faf8f2595b56/AGENTS.md).

### H04 — Alta: la release notificada no determina exactamente lo que instala el cliente

**Evidencia.** Aether envía `release_sha` y `source_repository`, pero el consumidor ejecuta `pnpm update --recursive --latest "@aether-commerce/*"` y no usa esos campos para seleccionar/verificar versiones. Las migraciones se vuelven a sincronizar durante el deploy. El cliente no dispone del comando `aether:migrations:check` que sí incorpora la plantilla actual.

**Impacto.** Un evento atrasado puede instalar paquetes publicados después, incluso cambios mayores; la relación entre SHA de Aether, paquetes, migraciones y SHA cliente queda incompleta. El deploy puede incorporar archivos de migración que no aparecen en el diff revisado si la sincronización cambia el árbol.

**Corrección.** Publicar un manifiesto de release con SHA, versiones exactas, integridad de paquetes y hashes de migraciones. Validar su origen y consumirlo de forma determinista. Resolver e integrar migraciones durante el PR; en despliegue, comprobar manifiesto y ausencia de diferencias antes de aplicar. Registrar ambos SHA y versiones en el resultado.

**Aceptación.** Repetir una release instala el mismo conjunto aun cuando `latest` avance. Un hash de migración distinto o un archivo generado ausente en Git bloquea antes de D1. No trasladar al cliente las migraciones de datos exclusivas de la demo, como la corrección del catálogo semilla, sin revisar su distribución prevista.

### H05 — Alta: la plantilla que se vende no tiene las mismas garantías que Aether

**Evidencia.** La plantilla de cliente incluye update/deploy, pero no `.github/workflows/ci.yml`. Su updater crea un PR y lo fusiona inmediatamente con GITHUB_TOKEN; no espera un check del PR. Liminal tiene adaptaciones locales que no están en esa plantilla. Actualizar los paquetes, rutas y migraciones no actualiza workflows.

**Impacto.** Arreglar solo Liminal deja el defecto en futuros clientes. Arreglar solo la plantilla no corrige clientes existentes.

**Corrección.** Versionar también el contrato operativo del cliente: CI, reglas de promoción, actualización y despliegue. Distribuirlo mediante un PR de infraestructura separado y revisable que preserve las personalizaciones. Añadir a la prueba del cliente generado la existencia y el comportamiento de estos controles.

Código: [updater de plantilla](https://github.com/aether-commerce/aether-commerce/blob/8a417cd5d33580a151f78763652ddc07ebee6c8a/templates/client/.github/workflows/aether-update.yml), [validador de plantilla](https://github.com/aether-commerce/aether-commerce/blob/8a417cd5d33580a151f78763652ddc07ebee6c8a/scripts/validate-client-template.mjs).

### H06 — Media: la sincronización de main ocurre tarde y añade un ciclo completo de promoción

**Evidencia.** PR #305 abrió antes del back-merge necesario. El PR #306 sincronizó el historial con **cero archivos cambiados**, y consumió 7 minutos de CI; después hubo nuevos CI de develop y promoción. Ya había ocurrido con #298/#299. Actualmente `origin/develop..origin/main` vuelve a contener el merge de promoción #305.

**Causa.** Un merge de develop a main crea un commit nuevo en main que develop no contiene. Con PR obligatorio y rama actualizada en ambos lados, ese historial debe volver a develop. Adelantar el chequeo evita sorpresas, pero no elimina ese requisito estructural.

**Corrección.** Automatizar un PR de sincronización después de cada promoción, con detección de ancestry antes de abrir la siguiente. Fusionarlo solo con el check vigente y conservar la regla de un único PR develop → main. Reportar el estado como `sync_required` y no intentar `gh pr update-branch` sobre develop protegido.

**Aceptación.** El próximo cambio parte de develop sincronizado; abrir promoción no descubre a mitad del proceso que falta main. El check obligatorio se mantiene. Una eventual simplificación de la política de ramas sería otra decisión, no un bypass dentro de esta optimización.

Fuentes: [#306](https://github.com/aether-commerce/aether-commerce/pull/306), [CI de sincronización](https://github.com/aether-commerce/aether-commerce/actions/runs/38520086582), [#305](https://github.com/aether-commerce/aether-commerce/pull/305).

### H07 — Media: se repiten validaciones y compilaciones de alto costo

**Medición.**

| Ejecución | Duración del job | Partes relevantes |
| --- | ---: | --- |
| CI main 38522037071 | 7 min 09 s | validate 258 s; build 44 s; OpenNext 21 s; E2E 40 s |
| Deploy 38522754669 | 4 min 24 s | validate repetido 160 s; build 28 s; OpenNext 16 s |
| Publish 38522754527 | 3 min 13 s | build 60 s; client-template 93 s |
| CI PR promoción 38520795247 | 6 min 35 s | validate 245 s |
| CI PR sincronización 38520086582 | 7 min | cero archivos cambiados |

El flujo main CI → despliegue tardó **11 min 42 s** entre creación del CI y finalización del workflow de deploy. Desde apertura de #305 hasta ese final: **34 min 10 s**, incluyendo coordinación, sincronización y reintento. Son duraciones de este caso, no un SLA.

`pnpm validate` ya incluye `test:client-template`, que construye y empaqueta los paquetes y genera/instala/compila un cliente completo. La secuencia local obligatoria vuelve a ejecutar ese test aparte; deploy repite validate; publish vuelve a construir y probar el cliente. `opennextjs-cloudflare build` también invoca el build de Next, después de `pnpm build`.

**Corrección en orden.**

1. Mantener el check agregado `Aether CI / validate`, repartiendo calidad, pruebas, cliente generado y build/E2E en trabajos con dependencias correctas. Medir el costo de instalaciones extra: paralelizar reduce tiempo de pared, pero puede aumentar minutos de runner.
2. Retirar la validación completa del deploy solo cuando todos sus caminos exijan CI exitoso del SHA exacto. Conservar preflight de configuración, build específico del ambiente y smoke.
3. Compilar Next una vez por ambiente; usar la opción documentada `--skipNextBuild` de OpenNext solo cuando exista una compilación compatible y verificada del mismo SHA/configuración.
4. Detectar si hay paquetes que publicar antes de instalar/compilar. Generar una vez los artefactos publicables y probar/publicar esos mismos archivos, con digest y procedencia del CI de push confiable.
5. Revisar la duplicación del preflight en AGENTS.md junto con el contrato de CI; mientras no cambie esa regla, cumplirla.

Los 160 s repetidos son el ahorro directo identificado en ese deploy (aproximadamente 61% de su job), no una promesa de duración futura. El CI usa configuración pública ficticia y producción usa sus propias variables: no se deben reutilizar bundles de frontend entre ambos sin comprobar su configuración. Antes de compartir cachés, validar las entradas de entorno y separar confianza de PR y de push. Turbo ya infiere `NEXT_PUBLIC_*` para Next; no se atribuye un fallo de caché solo a que falte un `env` explícito.

Fuentes técnicas: [CLI OpenNext](https://opennext.js.org/cloudflare/cli), [variables y caché Turbo](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables).

### H08 — Media: el build intermitente sí tiene una firma recuperable; reintentar no corrige la causa

**Evidencia.** Primer intento de 38520790124: build del admin fallido, Turbopack informa 28 errores en Inter, incluyendo `Can't resolve '@vercel/turbopack-next/internal/font/google/font'` y `next/font/google queries have exactly one entry`. Segundo intento del mismo SHA: correcto, job de 5 min 26 s.

**Conclusión limitada.** La firma señala la resolución de `next/font/google`/Turbopack. No demuestra por sí sola una caída de Google Fonts, de Cloudflare ni falta de credenciales.

**Corrección.** Crear reproducción limpia con el lockfile y Next fijados; valorar servir los archivos de Inter localmente conservando su licencia y apariencia, o una corrección verificada de Next. Preservar automáticamente intento/job/log antes del reintento. No convertir reintentos ilimitados en política.

Fuente: [job fallido del intento 1](https://github.com/aether-commerce/aether-commerce/actions/runs/38520790124/job/115709760003). La descarga directa del log del job permitió recuperar la firma cuando `gh run view --log-failed` no la mostraba.

### H09 — Alta: el camino manual y las ejecuciones antiguas no tienen la misma garantía del camino normal

**Evidencia.** Deploy y publish Aether aceptan `workflow_dispatch` en main sin consultar el CI de push de ese SHA. El camino normal sí exige éxito y usa `workflow_run.head_sha`. No existe comparación con la última revisión desplegada ni un control explícito de antigüedad antes de mutar producción.

**Impacto.** Un despacho manual puede omitir la evidencia de CI requerida; un reintento antiguo podría volver a desplegar una revisión anterior después de otra más nueva. Son posibilidades por código; no se afirma que hayan ocurrido en esta muestra.

**Corrección.** Una única función de autorización técnica para todos los caminos: repositorio/branch esperados, SHA, CI de push exitoso y revisión vigente. Rechazar ejecuciones obsoletas antes de migraciones/publicación. Para rollback, usar un flujo explícito con evidencia de compatibilidad de esquema. La concurrencia serializa, pero no garantiza por sí sola orden semántico de releases.

Fuente: [deploy Aether](https://github.com/aether-commerce/aether-commerce/blob/8a417cd5d33580a151f78763652ddc07ebee6c8a/.github/workflows/deploy-production.yml), [concurrencia GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

### H10 — Media: un workflow verde no verifica todavía toda la versión visible

**Evidencia.** Aether comprueba HTTP y un producto visible con timestamp ISO. Eso no confirma que una migración de contenido ya sea observable. El catálogo mantiene caché persistente en D1 durante 15 minutos y memoria durante 5; la migración 0036 no invalida esa caché. El API recibe `DEPLOYED_COMMIT_SHA`, pero el smoke no lo compara. Liminal termina tras deploy de Pages, sin smoke público en ese workflow.

**Corrección.** Invalidación o versionado de caché ligado a migraciones que alteren datos visibles, incluyendo la estrategia para memoria/HTTP; no modificar migraciones ya aplicadas. Verificar producto esperado y coherencia de datos además del conteo. Emitir/comprobar SHA y versión desplegada de cada servicio, readiness del asistente y manifiesto de migraciones. En Liminal verificar storefront, API y admin después del deploy.

La [metadata de versiones de Workers](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/) puede complementar la marca de commit. Un 200 solo acredita que hubo respuesta satisfactoria.

**Comprobación adicional reproducida.** El evaluador de IA, con categoría inexistente y URL local no utilizada, devuelve `evaluated:0, passed:0, ratio:null` y salida 0. Debe fallar si selecciona cero casos. No se hicieron llamadas al modelo ni a producción para esta reproducción.

Código: [smoke catálogo](https://github.com/aether-commerce/aether-commerce/blob/8a417cd5d33580a151f78763652ddc07ebee6c8a/scripts/check-public-catalog.mjs), [caché](https://github.com/aether-commerce/aether-commerce/blob/8a417cd5d33580a151f78763652ddc07ebee6c8a/packages/api-worker/src/services/catalog.ts), [evaluador](https://github.com/aether-commerce/aether-commerce/blob/8a417cd5d33580a151f78763652ddc07ebee6c8a/apps/ai-assistant/evaluation/run.mjs).

### H11 — Media: recuperación de despliegues parciales e aislamiento del cliente necesitan controles explícitos

**Evidencia.** Migraciones, API, secretos, asistente, storefront y admin se ejecutan en secuencia. Si una etapa posterior falla, las anteriores ya pueden estar activas. El retry acotado de Aether cubre deploy/secret de Workers, pero Pages no lo utiliza. En Liminal, expresiones como `main && PRODUCTION_SECRET || SECRET` permiten recurrir al secreto genérico si falta el de producción.

**Impacto.** Un deploy fallido puede dejar componentes de distintas versiones. La selección con fallback puede ocultar una configuración incompleta; no se inspeccionaron valores secretos, por lo que no se afirma que hoy ambos ambientes compartan credenciales.

**Corrección.** Preflight completo antes de modificar recursos, resolución estricta por ambiente y reporte de la etapa alcanzada. Manifiesto de versiones previas/nuevas; migraciones compatibles con código viejo durante la transición; smoke tras cada componente crítico y runbook de recuperación. Aplicar retry limitado solo a operaciones y errores transitorios seguros; no reejecutar migraciones destructivas a ciegas.

Cloudflare advierte que [volver a una versión del Worker](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) puede ser incompatible con cambios en datos. Un rollback de código no debe anunciarse como rollback de D1.

### H12 — Media: el agente opera con estado disperso y no existe una conclusión de release que abarque ambos repositorios

**Evidencia.** El registro distingue correctamente el token local y los secretos de Actions, pero el flujo sigue exigiendo descubrir manualmente ancestry, intentos de CI, SHA, versión publicada y resultado cliente. El checkout principal permanece en `codex/fix-critical-storefront` con cambios sin confirmar; incluye borradores de paralelización de CI y eliminación de validación duplicada que no están en main. Hay dos fuentes distintas de verdad si se ejecutan comandos desde esa copia.

**Corrección.** Un `release doctor` de solo lectura debe mostrar: repo/cwd/branch/limpieza, SHA remotos, ancestry, PR de versión pendiente, CI exacto por evento e intento, capacidad de cada credencial sin exponerla, y fase alcanzada. El coordinador debe reanudar desde GitHub y no depender de la memoria del chat. Consultas con espera progresiva y salida compacta; conservar el ID del proceso y descargar logs solo cuando aportan información.

**Registro en GitHub.** Cada release debe producir un resumen de Actions y un artefacto JSON por SHA, con enlaces a CI, deploy, publicación y actualización/deploy Liminal. El Markdown conserva decisiones e incidentes; no hace falta otro commit para escribir cada línea de log. Un resultado parcial debe mostrar `Aether desplegado / Liminal bloqueado`, no `release completa`.

Los borradores locales pueden servir de referencia, pero deben portarse por partes sobre develop actual y probarse; no fusionar el checkout antiguo completo.

## Ampliación: Changesets y automatización para agentes

| Hallazgo | Prioridad | Optimización o corrección |
| --- | --- | --- |
| H13: preflight local omitido y cobertura de changesets incompleta | Alta | Base explícita, cobertura por paquete y validación reproducible del PR de versiones |
| H14: acción de release usa force y credenciales Git/API configuradas por separado | Alta | Actualizar la rama sin reescritura; identidad explícita; acción fijada por SHA |
| H15: preparación de versiones no coordinada con CI | Media | SHA vigente de develop, condición de rama y detección temprana de ausencia de trabajo |
| H16: changesets pendientes se rechazan después de llegar a main | Alta | Validar que el versionado esté completo en el PR de promoción |
| H17: publicación sin registro propio de recuperación por release | Media | Manifiesto, reconciliación de paquetes/tags y estado explícito de entrega al cliente |
| H18: coordinación manual entre todos los workflows | Media | Operaciones propuestas status/plan/resume/verify, con estado reconstruido desde GitHub |

El [anexo](2026-10-14-changesets-agent-release.md) documenta la evidencia, separa incidencias observadas de riesgos por inspección y define pruebas de cierre. El PR de versiones #302 sí tuvo CI válido; no hay base para reemplazar Changesets ni para declarar inválido su token. El objetivo es que el agente complete las transiciones ya autorizadas, reanude tras interrupciones y solo consulte al usuario cuando falte una decisión real.

## Aspectos que ya funcionan y deben preservarse

- Aether protege main/develop con PR obligatorio, check requerido, rama actualizada y administradores incluidos; force-push y borrado deshabilitados. Main deja la fuente del check sin App específica y develop la vincula a GitHub Actions: conviene alinear esa configuración al formalizar el control.
- En el camino normal, producción y publicación parten del CI exitoso de push y hacen checkout de su SHA.
- Changesets prepara versiones en develop y publicación rechaza changesets pendientes en main.
- Hay pruebas reales del cliente generado contra paquetes empaquetados. Que el paso separado `Verify package archives` esté omitido fuera de dry-run no significa que no exista ninguna prueba de los tarballs.
- Hay validaciones de distribución de migraciones, aislamiento de Wompi y reintentos acotados de errores 502/503/504 de Workers.
- No hay evidencia de invalidez del token que envía el dispatch. El problema observado está después, en el consumidor.

## Plan recomendado por entregas

| Orden | Cambio | Repositorios | Criterio para cerrar |
| --- | --- | --- | --- |
| 0 | Fortalecer metadatos Changesets, guardia de promoción y preparación de release por SHA | Aether | El preflight local valida realmente; una promoción incompleta se bloquea antes de main |
| 1 | Reparar actor, estados y reanudación de Liminal; PR único; versiones de release deterministas | Aether + Liminal | Una release llega a PR validado y promoción, sin aprobaciones rutinarias ni duplicados |
| 2 | Gate de deploy por SHA/CI, rama canónica, aislamiento y smoke; corregir plantilla y distribuir actualización operativa | Liminal + plantilla Aether | CI fallido/antiguo no despliega; entorno y versión observada coinciden |
| 3 | Controlador reanudable para agentes, PR de Changesets, sincronización de main y resumen por release | Aether + Liminal | Un agente completa versiones, promoción y verificación de destinos aplicables sin reconstruir manualmente el flujo |
| 4 | Eliminar validate duplicado, build doble y trabajo de publish innecesario; paralelizar y medir | Aether | Misma cobertura/check obligatorio; reducción medida de pared y minutos de runner |
| 5 | Estabilizar fuentes, invalidación del catálogo, evaluador vacío y recuperación parcial | Aether + pruebas cliente aplicables | Reproducciones corregidas y ejercicio de recuperación documentado |

Cada entrega debe seguir rama → PR develop → CI → promoción main. Liminal mantiene su rama canónica `development` conforme a sus instrucciones; no se renombra ni elimina `develop` sin revisar sus commits exclusivos. Toda modificación publicable de paquetes lleva changeset. Si se presenta estado nuevo en el panel, actualizar también prompt/herramientas/evaluaciones del agente administrativo.

## Pruebas de regresión necesarias

| Escenario | Resultado esperado |
| --- | --- |
| Dispatch repetido | Mismo PR/objetivo; sin duplicados |
| Checks aún no creados o en espera | Estado pendiente explícito y reanudación, sin falso fallo inmediato ni falso éxito |
| Check verde de un SHA anterior | No fusionar ni desplegar |
| CI de PR verde pero CI de push ausente/fallido | No desplegar |
| Reintento antiguo después de nueva release | Bloqueo por obsolescencia |
| Se publica otra versión mientras llega el dispatch | Instalar el manifiesto solicitado |
| Falta secreto/configuración de producción | Fallar antes de mutaciones, sin fallback a desarrollo |
| Sincronización de migraciones cambia archivos | Fallar antes de aplicar D1 |
| Migración de catálogo con caché caliente | Datos nuevos visibles y smoke semántico correcto |
| Falla Pages después de API | Reporte parcial y recuperación reproducible |
| Evaluación sin casos | Salida no cero |
| Cliente nuevo generado | Workflows con CI, gate, update y smoke incluidos |
| Changeset cubre A pero omite B modificado | Preflight falla y enumera el paquete omitido |
| Checker ejecutado localmente sin base | Error accionable o base explícita verificada; no validación omitida silenciosamente |
| PR normal elimina una nota o cambia una versión manualmente | No obtiene automáticamente la excepción del PR de versiones |
| Cambia develop mientras el PR de Changesets se valida | Recalcular sobre el nuevo SHA y exigir su CI |
| Promoción con versionado pendiente | Fallar en CI del PR antes de fusionar main |
| Agente se interrumpe después de un merge | Reanudar desde evidencia remota sin crear otro PR ni repetir la publicación |
| Actualización de rama de release con commit ajeno | Detenerse sin sobrescribirlo ni forzar la rama |

Las pruebas deben ejercitar decisiones y estados, no limitarse a buscar cadenas dentro del YAML. El test actual de CI contiene muchas aserciones de texto; sirve como guardia básica, pero no prueba una carrera, un reintento o un SHA obsoleto.

## Metas y límites de esta auditoría

Medir en las próximas diez releases: tiempo desde PR listo a producción Aether, tiempo hasta Liminal, minutos totales de runner, reintentos, PR duplicados e intervenciones humanas. Meta inmediata: cero PR duplicados, cero checks de SHA incorrecto y cero entregas consideradas completas con Liminal bloqueado. La meta de ahorro temporal debe fijarse contra esa muestra; los 160 s de validación duplicada son una oportunidad medida.

No se desplegó ni se cambió la configuración durante esta auditoría. Se verificaron workflows, estados y logs, y se reprodujo localmente el falso éxito de cero evaluaciones. La causa interna exacta del fallo de Turbopack, la revisión viva del cliente en Cloudflare, sus protecciones no accesibles y las credenciales efectivas por ambiente requieren comprobación en la implementación. La reproducción Windows del binding de Tailwind sigue pendiente; no debe institucionalizarse el enlace manual como solución.
