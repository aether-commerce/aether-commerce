# Registro de conflictos y problemas de CI/CD

Este archivo conserva observaciones verificables para orientar futuras mejoras del flujo. Registra síntomas, impacto y candidatos de optimización; no reemplaza los logs completos de GitHub Actions. Nunca incluyas valores de secretos, tokens, datos personales ni contenido de pedidos.

## 2026-10-13 — Promoción de `develop` a producción

**Resultado:** la versión quedó publicada desde `main`, SHA `5150ca5b28417ad9ced22e76a8134d51a1b11d42`. No hubo fallo final de CI, despliegue ni publicación.

**Conflictos y esperas observados**

- El PR de promoción [#298](https://github.com/aether-commerce/aether-commerce/pull/298) quedó detrás de `main` porque faltaba sincronizar el historial de producción con `develop`. Se abrió y validó el PR [#299](https://github.com/aether-commerce/aether-commerce/pull/299); después el PR de promoción quedó actualizado y pudo integrarse. La prevalidación de ancestry antes de abrir el PR de promoción evitaría esta vuelta adicional.
- Un intento de integrar el PR de promoción encontró `Aether CI / validate` todavía en progreso. Se esperó el resultado asociado al push y se continuó cuando terminó. Conviene revisar por qué el estado requerido seguía pendiente tras el check del head del PR y aclarar cuál ejecución debe bloquear la integración; no se deben omitir checks requeridos para acortar la espera.
- El flujo de actualización abrió el PR [liminal-store #120](https://github.com/aether-commerce/liminal-store/pull/120), pero GitHub dejó su primer CI en `Action required` hasta que un mantenedor aprobó la ejecución. Tras aprobarla, `validate` terminó correctamente en **1 min 49 s**. Hay que decidir y documentar una política segura para ejecuciones de automatización interna en el repositorio cliente.
- La sesión local de `gh` no autenticaba, aunque los workflows de Actions y la sesión autenticada del conector/navegador completaron las tareas. Este error local no indicó que los secretos de Actions fueran inválidos; se deben diagnosticar por separado antes de considerar una rotación de credenciales.

**Duraciones observadas**

| Ejecución | Resultado | Duración |
| --- | --- | ---: |
| [CI de producción #919](https://github.com/aether-commerce/aether-commerce/actions/runs/38492715868) | Correcto | 7 min 10 s |
| [Despliegue de producción #245](https://github.com/aether-commerce/aether-commerce/actions/runs/38493387028) | Correcto | 4 min 39 s |
| [Publicación de paquetes #91](https://github.com/aether-commerce/aether-commerce/actions/runs/38493387032) | Correcto | 3 min 16 s |
| [CI de actualización Liminal](https://github.com/aether-commerce/liminal-store/actions/runs/38493781832) | Correcto tras aprobación | 1 min 49 s |

Las duraciones corresponden a ejecuciones separadas y pueden solaparse; no son una medición de tiempo total de pared de la promoción. No incluyen la sincronización del historial ni las esperas de aprobación.

**Estado de credenciales verificado en esta promoción:** el CI, el despliegue y la publicación se completaron con las credenciales existentes; `AETHER_CLIENT_DISPATCH_TOKEN` permitió abrir el PR #120. Esto confirma que las credenciales funcionaban para estas acciones en esa fecha, no que deban copiarse, exponerse o dejar de rotarse si aparece evidencia posterior de compromiso o revocación. El error de la sesión local de `gh` debe tratarse como un problema distinto.

## 2026-10-13 — Preflight limpio en Windows

- El `pnpm` disponible en `PATH` era 8.6.0 aunque `package.json` fija 8.15.9. Se usó Corepack para ejecutar la versión declarada; conviene hacer que el setup local y CI respeten siempre el campo `packageManager`.
- En el worktree aislado, el build no encontró el enlace local del binding opcional de Tailwind para Windows. El paquete sí estaba en la instalación bloqueada; un enlace temporal dentro de `node_modules` permitió resolverlo y el build completo pasó. No se modificó ningún archivo versionado para esta prueba. Investigar la resolución de dependencias opcionales en worktrees anidados antes de añadir workarounds al código.
- El build del admin también requiere `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` durante prerender. Se usó un valor ficticio solo para la compilación local; nunca se leyó ni transmitió un secreto.

**Candidatos para optimizar y medir**

1. Añadir una comprobación automática de que `develop` contiene el historial de `main` antes de iniciar la promoción, con un mensaje accionable si hace falta un PR de sincronización.
2. Medir los pasos internos de `Aether CI / validate` para identificar qué explica sus 7 min 10 s; optimizar caché y trabajos paralelos solo donde mantengan los mismos checks obligatorios.
3. Reducir ambigüedad entre checks de PR y de push, conservando el requisito de validar el head actual y el CI posterior al merge.
4. Documentar el proceso de aprobación inicial de workflows de cliente y evaluar una política restringida para el bot/repositorio de confianza, sin aprobar código externo indiscriminadamente.
5. Publicar un resumen único de release con CI, despliegue, publicación y actualización del cliente, manteniendo cada resultado y SHA verificables por separado.
6. Reproducir la instalación de worktrees en Windows con pnpm 8.15.9 y corregir la causa del enlace faltante antes de incorporar cambios a dependencias.

## 2026-10-14 — Auditoría conjunta de Aether y Liminal

**Alcance:** revisión de código, protecciones y evidencia de GitHub, sin cambios remotos. Informe detallado: [auditoría CI/CD y Liminal](audits/2026-10-14-cicd-liminal.md); [tiempos de los jobs](audits/2026-10-14-cicd-timings.json).

**Aether:** main `8a417cd5d33580a151f78763652ddc07ebee6c8a`; develop `07be83f3c87a724d290d61d72bacb9ee8a7e03ad`.

- La promoción [#305](https://github.com/aether-commerce/aether-commerce/pull/305) volvió a necesitar sincronización de historial. [#306](https://github.com/aether-commerce/aether-commerce/pull/306) cambió cero archivos y su CI consumió 7 min. Es una consecuencia del merge de promoción más la protección estricta de ambas ramas; un chequeo previo evita descubrirlo tarde, pero no elimina la sincronización.
- Se recuperó el log del [primer intento de CI 38520790124](https://github.com/aether-commerce/aether-commerce/actions/runs/38520790124/job/115709760003). El build del admin falló en Turbopack/`next/font/google` al resolver Inter, con `next/font/google queries have exactly one entry`. El reintento del mismo SHA pasó. No se ha demostrado la causa interna ni un fallo de red; no clasificarlo como Cloudflare o credenciales.
- [CI main](https://github.com/aether-commerce/aether-commerce/actions/runs/38522037071): job de 429 s. [Deploy](https://github.com/aether-commerce/aether-commerce/actions/runs/38522754669): 264 s, de los que 160 s repiten `pnpm validate` ya aprobado. [Publish](https://github.com/aether-commerce/aether-commerce/actions/runs/38522754527): 193 s. No sumar publish y deploy como si fueran secuenciales.
- El intervalo entre apertura de #305 y final del deploy fue 34 min 10 s; entre inicio del CI main y fin del deploy, 11 min 42 s. Son mediciones de esta release, no un promedio.
- El smoke de catálogo confirma visibilidad y timestamp, pero no los datos esperados ni el SHA vivo. Una migración directa como 0036 no invalida la caché persistente de productos.
- Se reprodujo localmente que el evaluador de IA acepta una categoría inexistente con cero casos y salida 0. Hay que exigir casos seleccionados para no registrar una validación ficticia.

**Liminal:** main `adf0bfffd809fa615979d1415ab5faf8f2595b56`; último deploy registrado correcto el 8 de octubre, [37770025016](https://github.com/aether-commerce/liminal-store/actions/runs/37770025016).

- La notificación desde Aether fue correcta, pero [la actualización 38523074834](https://github.com/aether-commerce/liminal-store/actions/runs/38523074834) falló después de abrir [#121](https://github.com/aether-commerce/liminal-store/pull/121): `gh pr checks` consultó antes de que aparecieran checks y terminó con `no checks reported`. Después [el CI](https://github.com/aether-commerce/liminal-store/actions/runs/38523178942) quedó en `action_required`.
- Precisión sobre la observación anterior de #120: la aprobación no se debe atribuir a un fork sin evidencia. #121 es un PR interno creado con `GITHUB_TOKEN`. La [documentación vigente](https://docs.github.com/en/actions/concepts/security/github_token) describe que ese actor deja los workflows de PR pendientes de aprobación; recomienda una App o PAT para ejecución sin ese paso. El token que envía el dispatch no es el que crea el PR del cliente.
- Hay 17 PR de actualización abiertos (#105–#121); el updater crea una rama por ejecución y no reanuda el PR anterior. Las últimas 20 ejecuciones por dispatch están fallidas; solo se diagnosticó en detalle la más reciente.
- El deploy del cliente se dispara por push sin esperar CI, acepta tanto `develop` como `development` y no ejecuta un smoke público final. Su AGENTS.md declara `development` como canónica.
- La consulta de protección de ramas devuelve 403 por la disponibilidad de esa función en el plan del repositorio privado. No se pudo verificar protección equivalente a Aether.
- El consumidor ignora `release_sha` para escoger paquetes y usa `--latest`. La plantilla para nuevos clientes tampoco incluye el mismo contrato de CI que el repositorio de Aether.

**Orden de corrección:** entrega idempotente de Liminal y actor correcto; gates por SHA, ambientes y plantilla; sincronización y resumen por release; reducción de validaciones/builds repetidos; verificadores semánticos y recuperación. Mantener el flujo de PR y las protecciones. Un resultado debe distinguir Aether desplegado, paquetes publicados, cliente actualizado y cliente desplegado.

## 2026-10-14 — Changesets y continuidad de releases por agentes

Ampliación solicitada: [Changesets y promoción operable por agentes](audits/2026-10-14-changesets-agent-release.md). La auditoría incluye ahora H01–H18.

- El [PR de versiones #302](https://github.com/aether-commerce/aether-commerce/pull/302) y su CI real fueron correctos. La revisión descargada de `changesets/action` admite el input `github-token`; no hay error demostrado en ese input.
- Se reprodujo que `check-changesets.mjs` y `check-release-policy.mjs` salen correctamente sin validar cuando falta `GITHUB_BASE_REF` en local. El preflight del agente debe recibir una base explícita y emitir evidencia del diff validado.
- El checker actual no parsea la cobertura de notas por paquete; sus excepciones por nota eliminada o versión modificada son demasiado amplias. Añadir pruebas de comportamiento y una distinción verificable del PR de versiones.
- El [run 38506174507](https://github.com/aether-commerce/aether-commerce/actions/runs/38506174507) usó `git push ... --force` sobre `changeset-release/develop`. El código de la acción confirma ese comportamiento; el log de esa ocasión no demuestra pérdida de historia. La política exige una actualización sin reescritura de ramas activas.
- El rechazo de changesets pendientes debe ocurrir en CI del PR de promoción, además de conservar la defensa al publicar. Preparar el PR de versiones no equivale a haber validado el push de integración.
- Se definió un controlador propuesto con status/plan/resume/verify, PR únicos, checks del SHA vigente, recuperación de publicación parcial y evidencia conjunta de Aether/Liminal. Es diseño auditado, todavía no una herramienta disponible.
- El objetivo operativo es que los agentes lleven una release autorizada hasta todos sus destinos aplicables, con el flujo de ramas y protecciones vigente, sin aprobaciones repetidas para pasos ya autorizados.

## 2026-10-14 — Plan de corrección

Se preparó el [plan integrado de los 18 hallazgos](audits/2026-10-14-cicd-remediation-plan.md): ocho etapas P0–P7, tres hitos de entrega, matriz de cobertura y 23 pruebas de aceptación. La ejecución está pendiente. Los controles de versión/CI preceden a la automatización de promociones y a la eliminación de validaciones repetidas. La protección de ramas de Liminal queda como decisión externa verificable; no se considera resuelta por añadir un gate en Actions.

La implementación de P1 está en curso en `fix/cicd-release-guards`: el checker ahora exige changeset válido por cada paquete público afectado, el PR de versiones se identifica de forma específica, y el CI de promoción bloquea notas pendientes o paquetes sin aumento de versión. Deploy y publicación también contrastan el repositorio, rama, SHA, push/CI exitoso y vigencia de la punta remota; los dispatch manuales consultan el CI exitoso del mismo SHA. Las pruebas locales del checker y del contrato pasaron; falta el preflight integral y el check real del PR.
