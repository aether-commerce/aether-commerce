# Plan de corrección de la auditoría CI/CD de Aether y Liminal

Fecha: 14 de octubre de 2026. Estado: **en ejecución; P1/P2 de Aether y P1 de Liminal integrados en sus ramas canónicas; P3 integrado con aceptación de release operativa pendiente; P4-A/B integrados y P4-C parcialmente verificado; P6 parcialmente integrado y con primer despliegue corregido exitoso; PR #315 pasó CI, push a develop y deploy/smoke exacto; P0 parcial; P5 fase 1 de lectura integrada por PR #317 y CI de push [38574801043](https://github.com/aether-commerce/aether-commerce/actions/runs/38574801043) verde; P5 mutaciones y P7 abiertos**. Este plan aún no se promueve a main ni a producción.

Fuentes: [auditoría H01–H12](2026-10-14-cicd-liminal.md), [ampliación Changesets H13–H18](2026-10-14-changesets-agent-release.md) y [mediciones](2026-10-14-cicd-timings.json).

## Objetivo y alcance

Resolver los 18 hallazgos para que un agente pueda llevar un cambio autorizado desde su rama hasta producción de Aether y los clientes aplicables, con versiones reproducibles, controles de CI verificables, recuperación tras interrupciones y menos trabajo repetido.

Incluye Aether, sus paquetes, la plantilla vendible, la automatización de Changesets, Liminal y la operación del agente. No es una nueva auditoría funcional de toda la tienda. El punto de partida es la evidencia del 14 de octubre; antes de implementar se actualizan SHA, PR, configuraciones y ejecuciones.

El éxito se prueba con releases reales controladas. Los tests fallidos, los despliegues parciales y los bloqueos externos quedan visibles; un resultado verde parcial no cierra la auditoría.

## Condiciones que se conservan

- Aether: rama corta desde develop → PR develop → CI de PR y push → PR único develop a main → CI de PR y push → producción y publicación.
- Liminal: respetar su rama canónica development y sus instrucciones vigentes; cualquier ajuste de esas instrucciones se revisa en su propio PR.
- Sin bypass, push directo a ramas protegidas, force-push, cherry-pick de liberación ni commits vacíos para provocar checks.
- Todo paquete público modificado lleva changeset, semver justificado y changelog oficial. Las migraciones aplicadas se conservan; las correcciones se hacen con nuevas migraciones.
- Aether producción sigue siendo demo/playground y Wompi sigue usando sandbox solo allí. Desarrollo permanece aislado. No se agregan compras ni planes de pago como requisito implícito.
- Se preservan cambios locales ajenos y personalizaciones de Liminal. No se fusiona el checkout antiguo completo.
- Si cambia un flujo visible del panel, actualizar en el mismo PR el prompt administrativo, navegación, herramientas y evaluaciones afectadas.
- La aplicación del plan se hace por entregas revisables. Los controles locales no se consideran activos hasta que pasen por sus PR, CI de integración y promoción requerida.

## Secuencia y dependencias

| Etapa | Resultado | Dependencias | Hallazgos principales |
| --- | --- | --- | --- |
| P0 | Estado inicial y capacidades verificadas | Ninguna | H03, H12 |
| P1 | Controles tempranos de metadatos, CI y ambientes | P0 | H03, H09, H11, H13, H16 |
| P2 | Changesets confiable y sin reescritura | P1 | H14, H15 |
| P3 | Entrega reproducible y recuperable a Liminal | P1, P2 | H01, H02, H04, H05, H17 |
| P4 | Verificación real de producción, build estable y recuperación | P1; usar manifiesto P3 al verificar cliente | H08, H10, H11 |
| P5 | Agente capaz de coordinar y reanudar toda la release | P2, P3, P4 | H06, H12, H18 |
| P6 | Menos compilaciones, validaciones y esperas repetidas | P1–P5 | H07 |
| P7 | Certificación, métricas y cierre individual | P0–P6 | H01–H18 |

Se puede preparar P4 mientras se desarrolla P3 porque modifica otra parte del sistema, pero sus pruebas finales se ejecutan contra la versión integrada. No activar las mutaciones automáticas del coordinador antes de validar los controles de P1–P4.

## P0 — Preparar una base reproducible

**Trabajo:**

1. Actualizar el inventario de ambos repositorios: ramas, ancestry, PR, checks, workflows y revisiones desplegadas. Los 17 PR de Liminal son una observación de la auditoría, no una cifra que deba asumirse actual.
2. Trabajar desde copias limpias de las ramas de integración. Inventariar borradores locales; portar solo cambios revisados que aporten al plan.
3. Verificar por capacidad las credenciales de Git/API, paquetes, dispatch y Cloudflare, sin imprimir sus valores. El dispatch funcionó; no rotar tokens por el fallo de otro actor.
4. Confirmar qué protección de ramas/rulesets puede aplicar GitHub a Liminal. El 403 observado debe investigarse; no interpretarlo como autorización para omitir protección.
5. Recuperar una muestra histórica comparable de diez releases cuando exista y conservar tiempos por paso, reintentos, PR duplicados e intervenciones humanas.
6. Registrar las configuraciones/versiones vigentes necesarias para recuperar cada ambiente, excluyendo valores secretos.

**Entregables:** inventario JSON, matriz de capacidades y registro de incertidumbres en GitHub al publicar la implementación. Vincular esta auditoría y este plan.

**Salida:** las revisiones objetivo y las ramas canónicas están identificadas; los cambios ajenos están preservados; cualquier bloqueo de permisos tiene causa y acción concreta.

**Decisión externa DEC-01:** si Liminal no admite protección equivalente en su configuración actual, presentar las opciones disponibles y su costo/impacto al usuario. Mantener las correcciones de CI avanzando, pero dejar esa parte de H03 abierta. Los controles del workflow son una mitigación, no un reemplazo acreditado de protección de ramas. No cambiar visibilidad ni contratar un plan automáticamente.

**Estado P0 al 14 de octubre:** se confirmó el repositorio canónico `aether-commerce/liminal-store`, la rama `development` y el SHA inicial observado `44e8f80bb9a56a773f2a273e0dfd7eb0434eac39`. Se conservaron sin tocar los cambios locales ajenos (`tsbuildinfo` y `.worktrees/`). Las consultas de protección de ramas y rulesets respondieron HTTP 403: “Upgrade to GitHub Pro or make this repository public to enable this feature.” No se cambió visibilidad ni plan; DEC-01 sigue abierto. El PR #122 y su CI ya se integraron en `development`; el CI del push de integración también pasó. Falta completar la matriz de capacidades y mediciones históricas. La inspección de secretos confirmó que producción carece de `PRODUCTION_AETHER_CART_TOKEN_SECRET` y `PRODUCTION_AETHER_SETTINGS_ENCRYPTION_KEY`; el preflight nuevo se detendrá antes de Cloudflare hasta que existan.

## P1 — Impedir promociones incompletas y despliegues sin evidencia

**Estado:** los gates de Aether están integrados en `develop` por PR #307; el CI del PR y el CI del push a `develop` pasaron. El gate Liminal está integrado en `development` por PR #122; `Validate Liminal client` pasó en el PR y en el push resultante. Su despliegue a `main` espera la promoción normal. No se habilita producción mientras falten los dos secretos cart/settings; los controles de ramas de GitHub siguen bloqueados por DEC-01.

**P1-A: metadatos y promoción.**

- Modificar `scripts/check-changesets.mjs` para recibir base explícita y validar nombres, niveles y cobertura de todos los paquetes publicables afectados.
- Distinguir cambios normales, PR de versiones y promoción; eliminar las excepciones amplias basadas únicamente en borrar una nota o cambiar un package.json.
- Verificar el PR de versiones reproduciendo el plan de Changesets desde la base esperada y comprobando versiones, notas consumidas y changelogs.
- Añadir a `check-release-policy.mjs` una condición del PR develop → main: versionado completo y cero changesets publicables pendientes. Conservar la defensa adicional antes de publicar.
- Hacer que el preflight local declare el diff/paquetes realmente validados. Un contexto ausente no debe producir una validación ficticia.

**P1-B: autorización técnica del despliegue.**

- Extraer una función comprobable que valide repositorio, rama, SHA, evento push, workflow esperado, resultado e intento de CI y vigencia de release.
- Aplicarla tanto al camino automático como al reintento manual de deploy/publicación. Rechazar un SHA superado antes de modificar recursos; el rollback tiene un procedimiento separado.
- En Liminal, esperar CI completo del push y hacer checkout de su SHA. Aceptar solo main y development; separar concurrencia por ambiente.
- Mover verificaciones de configuración y código antes del bootstrap/migraciones.
- Resolver variables y secretos por ambiente de forma estricta. Si falta configuración obligatoria de producción, fallar; no usar silenciosamente la de desarrollo.
- Mantener un preflight con funciones habilitadas: secretos de integraciones deshabilitadas siguen siendo opcionales.

**Archivos:** checkers de Aether; `ci.yml`, `deploy-*.yml` y `publish-packages.yml`; workflows CI/deploy y preflight de Liminal; pruebas de contratos.

**Aceptación:** casos T01–T04 y T10. No desplegar tras CI de PR solamente, CI fallido, check de otro SHA, branch incorrecto o configuración incompleta. Una promoción con notas pendientes falla antes del merge.

**Arranque inicial:** desplegar estos cambios por el flujo actual y revisar explícitamente el CI del PR y del push. Un nuevo workflow basado en eventos puede necesitar existir primero en la rama por defecto; no asumir que ya funciona por aparecer en una rama de trabajo. No usar la automatización nueva como única evidencia para aprobar su propia instalación.

## P2 — Reparar la automatización de Changesets

**Estado:** el workflow y los validadores están integrados en `develop` por PR #307. El PR automatizado de Changesets #310 pasó el check de su head y se integró en `develop` como `0106ea4`, preparando `@aether-commerce/api-worker` 0.8.2. El flujo `Prepare Aether package release` concluyó correctamente y el CI del push a `develop` [38555014895](https://github.com/aether-commerce/aether-commerce/actions/runs/38555014895) pasó. Aún falta publicar esa versión desde `main` como parte de una release completa; la aceptación operativa sigue abierta.

**Trabajo:**

1. Mantener `@changesets/cli` y `@changesets/cli/changelog`. La generación de versiones del caso auditado funcionó.
2. Preparar versiones solo desde develop con CI exitoso de push y SHA vigente. Detectar ausencia de notas antes de instalar o exigir credenciales de escritura.
3. Sustituir el manejo de rama que usa force por una actualización que conserve historia y un único PR activo.
4. Generar el resultado de versionado desde una copia limpia del develop esperado, no sobre versiones ya incrementadas de la rama de release.
5. Si la rama de release existe, incorporar la nueva base y aplicar el resultado generado solo sobre archivos de release permitidos; crear un commit nuevo y usar push normal. Verificar head antes de publicar y detenerse ante cambios ajenos. Probar expresamente que una actualización no duplica incrementos ni pierde changelog.
6. Usar la identidad de bot adecuada de forma explícita en Git y API; fijar por SHA las acciones externas empleadas.
7. Emitir número de PR, head SHA, base SHA, versiones, notas consumidas y estado `no_release_needed`/`waiting_ci`/`failed`.
8. Mantener la rama de release mientras el PR esté activo. Limpiar solo después de integración y comprobaciones del repositorio.

**Archivos:** `changeset-release-pr.yml`, script de preparación, contratos de release y pruebas con repositorios temporales.

**Aceptación:** T05–T07. Dos eventos sobre el mismo estado no crean dos PR; un nuevo develop produce un nuevo commit revisable; fallos o cambios humanos no se resuelven forzando la rama.

## P3 — Reparar la distribución de paquetes y la actualización de Liminal

**Estado:** las correcciones de distribución y actualización de P3 quedaron integradas en Aether (PR #308) y Liminal (PR #123), con CI de integración verde. La aceptación operativa sigue abierta: todavía falta observar una release nueva que recorra publicación con manifiesto, dispatch, actualización del cliente y smoke end-to-end; no se debe confundir el merge de los controles con la certificación completa de una entrega.

**P3-A: manifiesto y publicación recuperable.**

- Definir `release-manifest.v1` como snapshot completo: repositorio y SHA fuente, versión exacta de cada paquete público, si cambió en ese release, tag cuando exista, integridad de tarballs, hashes de migraciones y versión del contrato operativo del cliente.
- Comparar cada paquete fuente con el artefacto publicado de esa misma versión. Si el código empaquetable cambió sin incrementar versión, detener la release en vez de actualizar el cliente con contenido ambiguo.
- Construir/probar los paquetes publicables y verificar su integridad en el registro. No reutilizar una versión ya publicada para contenido distinto.
- Conservar un resultado por paquete, tags y notificación. Reanudar lo que falta tras un fallo parcial; no repetir etapas completas innecesariamente.
- Publicar el manifiesto de forma duradera en el registro de release de GitHub asociado a main; el ID/digest debe ser verificable. Los artefactos temporales de Actions sirven de evidencia adicional, no como única copia para reanudar meses después.
- Emitir dispatch solo con el conjunto de paquetes confirmado. Diferenciar publicación correcta, notificación enviada y cliente desplegado.

**P3-B: consumidor Liminal.**

- Configurar la identidad de bot para push/PR/merge de forma que el CI posterior se ejecute; conservar las validaciones del head vigente.
- Dividir preparación del PR y continuación por resultado de CI. Checks todavía inexistentes son una espera, no un fallo instantáneo ni un permiso de merge.
- Consumir versiones exactas del manifiesto; retirar `--latest` del camino automatizado.
- Mantener una sola rama/PR de actualización activa, actualizar mediante commits nuevos y reanudar después de interrupciones.
- Sincronizar rutas/migraciones durante el PR. Antes de D1, exigir hashes válidos y que el deploy no introduzca diferencias respecto al árbol revisado.
- Registrar PR y SHA cliente en la release fuente; comprobar integración, promoción y deploy por separado.
- Ignorar/desversionar `*.tsbuildinfo` y limitar los archivos preparados por el updater.

**P3-C: plantilla y clientes existentes.**

- Incluir CI, gate de despliegue, actualización y smoke en la plantilla.
- Versionar el contrato operativo y preparar PR de actualización de workflows para Liminal. No sobrescribir personalizaciones ni asumir que publicar paquetes actualiza la infraestructura del cliente.
- Probar el cliente generado y un cliente existente con personalizaciones.

**Orden de transición entre repositorios:**

1. Introducir el esquema y las pruebas; instalar por PR el consumidor compatible en Liminal, inicialmente sin activar el nuevo productor.
2. Durante la transición, un evento antiguo solo puede convertirse en un manifiesto verificable de su SHA; si no existe esa evidencia, queda pendiente con diagnóstico. No usar latest como compatibilidad.
3. Activar la emisión de manifiestos de Aether y ejecutar una entrega controlada a Liminal.
4. Retirar el camino antiguo cuando la entrega nueva esté verificada.
5. Comparar los PR acumulados y cerrar los redundantes solo después de conservar cualquier cambio exclusivo. Borrar una rama únicamente cuando cumpla las condiciones de limpieza; cerrar un PR por duplicado no demuestra por sí solo que su historia esté integrada.

**Aceptación:** T08–T12, T19 y T20. Dispatch repetido, evento atrasado y nueva publicación concurrente no cambian el conjunto solicitado ni multiplican PR.

## P4 — Probar lo desplegado y estabilizar recuperación

**P4-A: verificación funcional y de revisión.**

**Estado:** integrado en las ramas canónicas: Aether PR #309 (`4d8775e`) y Liminal PR #124 (`e568ca2`); sus checks de PR y CI de push concluyeron correctamente. Aether se desplegó en la ejecución [38551638244](https://github.com/aether-commerce/aether-commerce/actions/runs/38551638244): los logs confirman checkout del SHA `4d8775e` y el paso `Verify development services` terminó verde. La ejecución aparece bajo `main` porque `workflow_run` usa la rama predeterminada como contexto del workflow consumidor. Liminal PR #125 activó el despliegue reutilizable: el push `86dfc04` publicó API, storefront y Pages, pero su smoke consultó `liminal-store-admin.pages.dev` y falló con 404; no había migraciones nuevas. PR #126 corrigió el destino, restringió `workflow_run` a `main` y exige `APP_ORIGIN_ADMIN` para producción antes de mutar Cloudflare. El check de PR pasó en [38555332557](https://github.com/aether-commerce/liminal-store/actions/runs/38555332557); el merge `fa119cc` pasó CI de push y deploy en [38555639475](https://github.com/aether-commerce/liminal-store/actions/runs/38555639475). El job confirmó checkout del SHA `fa119ccd`, ausencia de migraciones pendientes y éxito de los smoke de storefront, API, Admin Pages, versiones y snapshot en `https://development.liminal-store-admin.pages.dev`. No se ha promovido a producción.

- Exponer una marca verificable de revisión por servicio y asociarla al manifiesto. No exponer secretos ni datos internos.
- Ampliar smoke de Aether: storefront, API health, asistente health/readiness, admin y portfolio. Verificar la revisión esperada para los componentes desplegados; para servicios independientes, registrar revisión compatible esperada en lugar de exigirles un SHA que no les corresponde.
- Añadir smoke de storefront, API y admin de Liminal, además de versiones de paquetes/migraciones esperadas.
- Verificar contenido relevante del catálogo, no solo que exista un producto.
- Hacer que el evaluador falle con categoría desconocida/cero casos y registre casos ejecutados, SHA y resultados.

**P4-B: catálogo y migraciones.**

**Estado:** el PR #312 se integró en `develop` como `0f44e7c`; su head `2707814` pasó el CI [38556497726](https://github.com/aether-commerce/aether-commerce/actions/runs/38556497726). El CI del push [38557383270](https://github.com/aether-commerce/aether-commerce/actions/runs/38557383270) pasó y el deploy de desarrollo [38557956077](https://github.com/aether-commerce/aether-commerce/actions/runs/38557956077) terminó verde. Sus logs confirman que se aplicó `0037_catalog_cache_generation.sql` y el smoke de API, asistente y frontends pasó. El changeset para API y migraciones se versionó por el PR #313. La suite local de migraciones pasa (3/3), la política de Changesets (10/10) y el CI Ubuntu completa build y E2E. Queda pendiente medir lecturas D1 con tráfico real y confirmar margen de Cloudflare Free; esta entrega solo se desplegó a desarrollo.

- Diseñar una generación de caché vinculada a cambios del catálogo y probar coherencia entre memoria, D1 y caché HTTP.
- Cambios de datos visibles deben invalidar o cambiar esa generación dentro del proceso de migración; añadir una migración nueva cuando corresponda, preservando las ya aplicadas.
- Mantener las fechas ISO exigidas en productos, respetar ediciones administrativas y excluir datos semilla de demo de la distribución a clientes cuando no les correspondan.
- Medir el costo de consultas/invalidación para mantener compatibilidad con Cloudflare Free.

**P4-C: build y recuperación.**

**Estado:** los cambios previos de build están integrados. El run de desarrollo [38562639663](https://github.com/aether-commerce/aether-commerce/actions/runs/38562639663) tuvo API en la revisión esperada, pero el asistente devolvió `unknown` frente a `d4d073c`. El PR [#315](https://github.com/aether-commerce/aether-commerce/pull/315) integró el deploy atómico de código y secretos. El CI de push [38566386174](https://github.com/aether-commerce/aether-commerce/actions/runs/38566386174) pasó; el deploy corregido [38567723863](https://github.com/aether-commerce/aether-commerce/actions/runs/38567723863) terminó verde y verificó storefront, API, asistente y Admin con revisión exacta `cdf3c1b`, además del portafolio como servicio independiente. La instalación limpia de Windows quedó verificada. La siguiente entrega añade un resumen SHA-scoped de cada etapa en Actions y pruebas fixture de fallos antes y después de tocar D1; T17 sigue abierto hasta integrar y validar esa recuperación en CI. El fallo inicial no se reprodujo.

- Reproducir el fallo Inter/Turbopack con el lockfile exacto. Elegir una corrección comprobada: fuente local con licencia y apariencia conservadas, o versión/corrección de Next demostrada. No atribuirlo a la red sin evidencia.
- Reproducir el binding opcional de Tailwind en un worktree Windows limpio con pnpm declarado; corregir la causa si se confirma. No convertir el enlace manual en requisito permanente.
- Guardar revisión/configuración anterior y nueva, migraciones aplicadas y última etapa correcta.
- Documentar recuperación de API nueva + frontend antiguo y otros fallos parciales. Migraciones compatibles con la transición; un rollback de Worker no se presenta como rollback de D1.
- Aplicar retry limitado a operaciones idempotentes y errores transitorios identificados; incluir Pages si la prueba confirma que es seguro. No reintentar indiscriminadamente errores de código, permisos o datos.

**Archivos:** servicios de health/catálogo, evaluador, scripts smoke, workflows y documentación de migraciones/recuperación. Incluir changesets de todos los paquetes públicos tocados.

**Aceptación:** T13–T17. Probar caché caliente y lectura concurrente, cero evaluaciones, revisión incorrecta, build limpio y fallo posterior a un componente ya desplegado. Las pruebas destructivas de recuperación usan fixtures/local/desarrollo aislado; no se restaura D1 de producción como ejercicio.

## P5 — Automatizar el recorrido completo para agentes

**Estado, fase 1:** el PR [#317](https://github.com/aether-commerce/aether-commerce/pull/317) integró `pnpm release:status` y `pnpm release:plan` con salida humana o JSON versionada. Consultan el árbol local, referencias de `main`/`develop`, PR abiertos, el check requerido del SHA exacto y la protección/App que GitHub reporta. El plan clasifica publicación de paquetes y entrega a Liminal como `required`, `not_applicable` con motivo o `unknown` si las referencias están desactualizadas. Solo hacen lecturas; no crean PR, publican ni despliegan. Bloquean un snapshot incompleto, trabajo local sucio, ancestry sin reconciliar, check fallido/viejo o App ID que no coincide. En la consulta inicial el App ID de `main` no se pudo verificar, así que el plan no autoriza promoción. Quedan abiertos `resume`, `verify`, persistencia/reanudación externa y la certificación T07/T18/T21; las mutaciones siguen deshabilitadas hasta validar P1–P4.

**Trabajo:**

1. Implementar `release:status` y `release:plan` de solo lectura antes de permitir mutaciones.
2. Implementar `release:resume --plan <id>` y `release:verify`, con contratos JSON y mensajes humanos.
3. Guardar alcance, PR incluidos, SHA base/head, intento de CI y destinos aplicables. Revalidarlos antes de cada transición.
4. Reanudar desde GitHub, registro de paquetes y estado de despliegue. El historial del chat y un archivo local no son la única fuente de estado.
5. Coordinar PR de trabajo, versiones, promoción, CI de push, publicación/deploy y cliente. Reconocer `not_applicable` para un destino que no necesita cambio, con motivo.
6. Después de una promoción, crear/reutilizar el PR de sincronización de main hacia integración y validarlo. Antes de abrir la siguiente promoción, comprobar ancestry.
7. Usar eventos y pasos breves; consultar con espera progresiva cuando sea necesario. No consumir un runner durante toda la espera de múltiples PR.
8. Persistir en GitHub summary y JSON por release/attempt con enlaces a todos los resultados, causas, tiempos y siguiente acción.
9. Activar por etapas: solo lectura → simulación sin mutaciones → ejecución supervisada → continuación automática dentro del alcance autorizado.
10. Vincular el check requerido de Aether a la App esperada de forma consistente, después de confirmar el ID correcto y probar que el check vigente satisface la protección. No modificar la configuración por adivinación.

**Controles:** estado obsoleto, cambios fuera de alcance o commit humano inesperado no se sobrescriben. Un bot con permisos de escritura no ejecuta código arbitrario de PR con secretos. Se conservan las aprobaciones realmente requeridas por política, evitando preguntas repetidas por acciones ya autorizadas.

**Agentes:** el principal se ocupa de alcance, semver, implementación y revisión técnica. Las tareas mecánicas de Git, push, commit y monitorización usan GPT-6 Luna alto conforme a la preferencia del usuario. Esta división no altera los permisos ni la exigencia del CI.

**Aceptación:** T07, T18 y T21. Interrumpir el agente después de cada transición y reanudar sin duplicar PR, publicar otra versión o mezclar SHA. Una release incompleta debe explicar el bloqueo exacto.

## P6 — Optimizar costo y duración con controles ya fiables

**Estado:** PR #314 integró la eliminación del `pnpm validate` duplicado y su prueba de regresión; PR #315 integró el despliegue atómico. CI de push [38566386174](https://github.com/aether-commerce/aether-commerce/actions/runs/38566386174) pasó. El deploy de desarrollo corregido [38567723863](https://github.com/aether-commerce/aether-commerce/actions/runs/38567723863) pasó en 2m54s sin repetir `pnpm validate`, y el smoke confirmó el SHA exacto. El workflow automático anterior seguía ejecutando la definición vieja de `main`; se canceló en `Validate workspace` a los 4m06s antes de mutar recursos. Es una muestra inicial favorable, no una comparación controlada; mantener la observación de diez releases para cerrar P6.

**Trabajo:**

- Conservar `Aether CI / validate` como check agregado; repartir tareas independientes en jobs y hacer que el agregador falle si cualquiera falla, se cancela o se omite indebidamente.
- Mantener el CI de PR y el de push: no usar el resultado de uno como sustituto del otro.
- Retirar `pnpm validate` duplicado del deploy solo después de demostrar que todos los caminos exigen CI del SHA correcto.
- Construir Next una vez por SHA/configuración de ambiente y reutilizar ese resultado para el empaquetado OpenNext.
- Reutilizar artefactos publicables probados con digest y origen de CI confiable; separar los artefactos de PR de los de publicación.
- Configurar cachés por lockfile, plataforma y entradas relevantes; no reutilizar un bundle de configuración ficticia/dev en producción.
- Evitar install/build cuando no hay release de paquetes o no hay trabajo de versionado.
- Mantener las pruebas completas de cliente generado, pero eliminar ejecuciones redundantes demostradas.
- Actualizar AGENTS.md y el comando de preflight en el mismo cambio que simplifique la secuencia local, preservando su cobertura. Hasta entonces, ejecutar íntegramente la secuencia vigente.

**Aceptación:** T22–T23 y comparación antes/después. Paralelizar solo cuando el ahorro de pared compense instalaciones/runner adicionales; el criterio incluye costo, no solo velocidad.

**Metas iniciales para validar, no promesas:** mediana de CI main ≤5 min, deploy ≤3 min y CI main → producción Aether ≤8 min en cambios comparables. Reducir minutos totales de runner; no atribuir ahorro a trabajo omitido ni a una caché excepcional. Si la cobertura adicional modifica el costo, reportar la comparación y ajustar la meta con evidencia.

## P7 — Certificar y cerrar los hallazgos

1. Ejecutar las pruebas de comportamiento y de contrato enumeradas abajo.
2. Ejecutar una release de infraestructura sin cambios publicables: no debe crear un PR de versiones ficticio.
3. Ejecutar una release real de paquetes con changesets: debe recorrer Aether y Liminal con manifiesto exacto, CI y smoke.
4. Simular duplicados, CI tardío, head nuevo y fallos parciales en fixtures/desarrollo. No fabricar commits vacíos ni borrar datos de producción para generar evidencia.
5. Reanudar un flujo interrumpido y demostrar que no duplica acciones.
6. Observar diez releases posteriores para medir tiempos, reintentos y costo. Separar cierre funcional del período de observación de rendimiento.
7. Revisar ramas y PR al terminar cada release y limpiar únicamente los que cumplan las condiciones verificadas.
8. Marcar cada hallazgo individualmente como abierto, en curso, mitigado, bloqueado externo o cerrado con enlaces. No declarar todos resueltos si DEC-01 u otra aceptación sigue pendiente.

## Matriz de cobertura de los 18 hallazgos

| ID | Corrección principal | Etapa | Evidencia de cierre |
| --- | --- | --- | --- |
| H01 | Bot y continuación de CI de Liminal | P3 | PR automático ejecuta CI y continúa; T08–T09 |
| H02 | PR único, reanudación y limpieza segura | P3 | Doble evento sin duplicado; sin archivos generados indebidos; T09 |
| H03 | Gate de deploy, rama canónica y protección acreditada | P0, P1 | T03; configuración de protección verificada o bloqueo externo abierto |
| H04 | Versiones/migraciones fijadas a manifiesto | P3 | T10–T11; SHA y hashes cliente coinciden |
| H05 | Contrato operativo también en plantilla/clientes | P3 | Cliente nuevo y existente validan el mismo contrato; T12 |
| H06 | Sincronización y ancestry automatizados | P5 | Siguiente promoción sin sincronización descubierta tarde; T18 |
| H07 | Eliminar duplicaciones y medir costo | P6 | T22–T23; comparación de muestras |
| H08 | Build Inter y entorno reproducibles | P4 | T16; logs de build limpio y reproducción corregida |
| H09 | CI/SHA y vigencia en todos los caminos | P1 | T03–T04; reintento viejo no despliega |
| H10 | Smoke semántico, revisión, caché y evaluador | P4 | T13–T15; cero falsos éxitos |
| H11 | Aislamiento y recuperación de despliegue parcial | P1, P4 | T10, T17; runbook ejercitado |
| H12 | Doctor/estado y evidencia conjunta en GitHub | P0, P5 | T21; estado completo recuperable desde otra sesión |
| H13 | Metadatos estrictos y preflight local efectivo | P1 | T01–T02; cobertura por paquete |
| H14 | Rama de release actualizada sin reescribir | P2 | T05–T06; historia y aportes ajenos preservados |
| H15 | Preparación sobre develop válido y vigente | P2 | T07; no-op y branch incorrecto correctamente tratados |
| H16 | Promoción bloquea versionado pendiente | P1 | T02; falla antes de main |
| H17 | Publicación y notificación recuperables | P3 | T19–T20; inventario de versiones/tags confirmado |
| H18 | Coordinador reanudable hasta todos los destinos | P5 | T21; release completa sin reconstrucción manual |

## Pruebas de aceptación

| Prueba | Casos y resultado exigido |
| --- | --- |
| T01 | Base ausente/inválida, changeset mal formado y paquete omitido: fallo explícito; casos válidos: éxito con diff identificado |
| T02 | Nota eliminada o versión manual no abre excepción indebida; PR de versiones reproducible pasa; promoción pendiente falla |
| T03 | CI fallido, pendiente, workflow/evento incorrecto, check antiguo o branch no permitido: cero despliegues |
| T04 | Reintento manual y evento viejo usan el mismo control; un SHA superado no toca D1 ni Workers |
| T05 | Actualización repetida del PR de Changesets: un PR, commits nuevos, sin incremento doble ni force-push |
| T06 | Commit ajeno/carrera en rama de release: no se pierde historia ni se pisa el head |
| T07 | Sin notas, CI de develop fallido, dispatch fuera de develop y nuevo head durante espera: estados correctos |
| T08 | CI de Liminal tarda en aparecer o exige aprobación: estado pendiente explícito, continuación tras resultado válido |
| T09 | Doble dispatch/reinicio/nueva release: un único PR vigente; archivos preparados limitados y sin tsbuildinfo |
| T10 | Falta configuración obligatoria de producción: fallo previo a mutaciones; ninguna credencial dev usada como sustituto |
| T11 | Latest cambia, digest inválido o migración distinta: respetar el manifiesto o bloquear; deploy no genera archivos nuevos |
| T12 | Cliente recién generado y Liminal personalizado incluyen CI, gate, update y smoke sin perder personalizaciones |
| T13 | HTTP 200 con versión equivocada o readiness fallida no cierra la release; catálogo comprueba datos esperados |
| T14 | Caché caliente en memoria/D1/HTTP y lectura concurrente a migración: coherencia nueva, sin esperar el TTL antiguo |
| T15 | Evaluación con categoría inexistente/cero casos: salida no cero y diagnóstico |
| T16 | Builds limpios Linux y Windows con versión declarada de pnpm; corrección de Inter y del caso Tailwind si se reproduce |
| T17 | Falla un componente tras desplegar otro: reporte parcial, retry seguro y recuperación documentada compatible con D1 |
| T18 | Merge a main seguido de sincronización: PR correcto, CI vigente, sin commits vacíos ni pushes protegidos |
| T19 | Corte durante publicación de paquetes: reanudar faltantes, rechazar integridad distinta para una versión existente |
| T20 | Corte después de paquetes o tags, antes de dispatch: retomar entrega sin duplicar; ausencia de token no parece éxito completo |
| T21 | Reinicio del agente/controlador en cada fase: reconstruir estado, comprobar SHA y ejecutar solo la siguiente transición válida |
| T22 | Job de CI fallido/cancelado/omitido: agregador requerido falla; pruebas y paquetes mantienen cobertura |
| T23 | Restauración de caché con ambiente/lockfile/plataforma distintos: no reutilizar salida incompatible; medir costo/tiempo |

Pruebas de lógica con fixtures y repositorios temporales; integración con acciones/registro simulados; validación real en CI para eventos y checks. Las aserciones de texto sobre YAML pueden complementar, pero no reemplazan pruebas de estado y carreras.

## Paquetes de PR y despliegues

Preparar PR pequeños por componente; agrupar promociones cuando estén verdes y pertenezcan al mismo hito. Evitar una promoción de producción por cada ajuste documental.

- **Hito A — controles y versiones:** P1 y P2. Desplegar los gates y el nuevo preparador antes de confiarle el flujo automático. Un PR de metadatos, otro de gates por repositorio y otro de Changesets son separaciones naturales.
- **Hito B — entrega y observabilidad:** P3 y P4. Coordinar primero el consumidor compatible en Liminal, después el productor Aether y la entrega real. Los cambios de runtime llevan Changesets y su PR de versiones antes de promoción.
- **Hito C — autonomía y eficiencia:** P5 y P6. Activar el coordinador gradualmente, luego retirar trabajo duplicado y certificar con P7.

Para cada PR de Aether ejecutar desde una copia limpia: `pnpm install --frozen-lockfile`, `pnpm validate`, `pnpm build`, `pnpm test:client-template`, `pnpm check:changesets`, con base de validación efectiva y configuración de build adecuada. Aplicar la versión vigente de AGENTS.md; cualquier simplificación entra mediante cambio revisado. No repetir comprobaciones ya exitosas sin cambios o evidencia nueva que lo justifique, salvo los controles requeridos de cada PR/push.

Cada promoción conserva un solo PR develop → main y espera el check del head actual más el CI de push posterior. Liminal aplica lo equivalente con development, según sus reglas revisadas.

## Medición, recuperación y decisiones pendientes

**Métricas por release:** SHA, versiones, PR, CI por evento/intento, duración por fase, minutos de runner, reintentos, duplicados, intervención humana y resultado por destino. GitHub conserva los logs detallados; el resumen apunta a ellos.

**Objetivos funcionales:** cero PR duplicados, cero despliegues con CI incorrecto, cero mezclas dev/prod, cero pruebas vacías aceptadas y cero releases anunciadas completas con un destino aplicable bloqueado.

**Ante fallo de implementación:** conservar SHA/job/log, detener el tramo afectado, reparar en rama hacia integración y repetir los controles aplicables. No deshacer cambios de D1 automáticamente ni alterar tags/versiones publicados. La recuperación de código usa revisiones compatibles; de lo contrario, preparar una corrección hacia adelante.

**Decisiones que pueden requerir intervención:** DEC-01, disponibilidad efectiva de una identidad de bot con permisos adecuados si ninguna credencial existente sirve, y cualquier compatibilidad de esquema que impida recuperar mediante el procedimiento probado. Se prepara evidencia y una propuesta concreta antes de consultar; no se solicitan permisos repetidos para operaciones ya autorizadas.

## Definición final de completado

- Los 18 IDs tienen prueba y evidencia de cierre, o un bloqueo externo claramente reconocido que impide declarar cierre total.
- Una release publicable recorre Aether y Liminal con versiones y revisiones verificadas.
- Un agente nuevo puede consultar el estado, reanudar la misma release y distinguir espera, fallo, resultado parcial y completo.
- La plantilla para vender incluye las mismas garantías operativas.
- Se documenta el resultado de las diez releases de observación para cerrar la mejora de rendimiento.
- El informe final enlaza PR, CI, publicación, despliegues, pruebas de recuperación y métricas; no depende de afirmaciones del chat.
