# Recuperación de despliegues de Aether

Este procedimiento sirve para aislar un deploy parcial y recuperar el servicio desde la revisión correcta. Desarrollo y producción usan Workers, Pages y D1 distintos; confirma el ambiente y los nombres de recursos antes de cualquier acción. La producción de Aether es una demo y los pagos deben seguir en sandbox.

## Evidencia que se conserva

En la ejecución fallida de GitHub Actions registra el enlace y run ID, evento, rama, SHA fuente completo, último paso exitoso, paso fallido, conclusión de CI que autorizó el deploy y revisiones que reportan los endpoints. Guarda nombres de variables/configuración y migraciones aplicadas, nunca valores de secretos ni datos de clientes.

El workflow despliega en este orden: autorización del SHA, instalación, preflight de configuración, build, generación de configuraciones, bundle del storefront, metadatos de build, migraciones D1, API Worker con sus secretos en una sola versión, asistente Worker con sus secretos en una sola versión, storefront Worker, Admin Pages y smoke. En producción agrega la comprobación del catálogo después del smoke. Consulta el YAML del [workflow de desarrollo](../.github/workflows/deploy-development.yml) o el [workflow de producción](../.github/workflows/deploy-production.yml) para ver el orden vigente.

Al terminar incluso con un fallo, ambos workflows escriben un snapshot con el ambiente, SHA, URL del run y el resultado de cada etapa en el resumen de GitHub Actions. `failed_before_mutation` indica que el fallo ocurrió antes de migraciones o despliegues; `partial` indica que al menos una operación remota se inició y exige inspección; `incomplete_after_mutation` identifica verificaciones omitidas tras mutar recursos; `verified` requiere que todas las etapas aplicables concluyan. En desarrollo, el control de catálogo de producción aparece como `not_applicable`. El snapshot no asegura que una operación fallida no haya alcanzado Cloudflare: confirma D1 y las revisiones de cada servicio antes de reintentar.

Incidente resuelto en el primer smoke posterior al arreglo: el run de desarrollo 38567723863 quedó `verified`; storefront, API, asistente y Admin reportaron la revisión completa esperada `cdf3c1bfa7ee2caab35cab3fdb3bd291d48064de`, y el portafolio independiente respondió 200. El flujo anterior activaba una nueva versión al ejecutar `wrangler secret bulk` después del deploy de código. El deploy atómico integrado por PR #315 no reprodujo `unknown`; esta evidencia lo mitiga y apunta a la doble activación como causa probable, pero no es una prueba A/B aislada. Si reaparece, conservar run, SHA y respuesta por servicio antes de reintentar.

## Clasificar el punto de fallo

| Último paso completado | Posible estado remoto | Acción inicial |
| --- | --- | --- |
| Antes de «Apply development D1 migrations» o «Apply D1 migrations» | El preflight y los builds no despliegan servicios ni aplican cambios a D1. | Corregir configuración/build en una rama y PR hacia **develop**; repetir CI. |
| Aplicación de migraciones | Puede haber una o más migraciones anteriores aplicadas. Wrangler registra el avance en la tabla de migraciones. | Consultar migraciones aplicadas y pendientes para la D1 del ambiente; conservar los SQL ya aplicados. La migración que falla se revierte; las anteriores exitosas siguen aplicadas. Corregir mediante una migración nueva si el esquema requiere reparación. |
| API Worker o configuración de sus secretos | D1 puede estar en el esquema nuevo mientras API, asistente y frontends siguen en revisiones anteriores. | Comprobar /api/v1/health/ready y el SHA que reporta; continuar con una corrección hacia delante compatible con el esquema aplicado. |
| Asistente Worker, storefront Worker o Admin Pages | Uno o más servicios pueden servir la revisión nueva y los demás la anterior. | Consultar /healthz y /readyz del asistente, /build-info.json del storefront y Admin, y registrar el SHA por servicio. Desplegar la revisión compatible que falta. |
| Smoke o catálogo | Los servicios pueden estar desplegados aunque la ejecución termine fallida. | Tratar el release como incompleto. Revisar las respuestas y SHA de cada verificación; no reportar éxito por HTTP 200 aislado. |

Ejemplo: si D1 y API terminaron correctamente pero falló el deploy del asistente, el snapshot debe quedar `partial`, con `lastSuccessfulStage=api` y `firstIncompleteStage=assistant`. Verifica las migraciones de D1 y el SHA servido por la API y el asistente antes de reintentar. El resultado del paso de API indica que se intentó una mutación; no vuelvas a desplegarla a ciegas ni reviertas D1. Corrige la causa y reanuda el SHA autorizado; después vuelve a ejecutar el smoke de todos los servicios.\n\nLos mensajes del workflow identifican el último paso completado, pero la ejecución puede haber aplicado varias migraciones antes de fallar en una posterior. Confirma siempre el estado de D1 en Cloudflare antes de reanudar.

## Reintentar o corregir

1. Detén promociones nuevas mientras exista un deploy parcial que afecte al mismo ambiente.
2. Reintenta solo si la causa fue transitoria, no hay cambios de código/configuración pendientes y el SHA sigue siendo la punta actual de la rama canónica. El workflow manual valida la rama, la punta remota y un CI de push exitoso para ese mismo SHA.
3. Si la rama avanzó, no intentes desplegar el SHA anterior: prepara una corrección en una rama nueva, actualiza **develop** mediante PR y deja que CI/despliegue operen con el SHA vigente.
4. No edites ni borres migraciones ya aplicadas para hacer que el deploy pase. Cada reparación del esquema entra como nueva migración, probada y compatible con el código que sigue activo.
5. Tras la recuperación, ejecuta y conserva el smoke completo: API readiness y revisión, asistente liveness/readiness y revisión, storefront y Admin con build-info.json del SHA esperado, y los checks adicionales del ambiente. El portafolio se verifica como servicio independiente.

## Límites del rollback

Un rollback de Worker crea un nuevo deploy con una versión anterior, pero no revierte D1, KV, R2 u otros recursos enlazados. Antes de seleccionar una versión anterior, confirma que sus bindings siguen disponibles y que el código antiguo funciona con el esquema actual. La compatibilidad entre esquema y código debe guiar la decisión, no solo el orden temporal del deploy. La documentación de Cloudflare permite volver a una versión anterior desde el dashboard o Wrangler y advierte que el rollback no modifica recursos asociados: [Workers rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

Cloudflare Pages permite volver a una publicación de producción construida correctamente; una publicación preview no es un objetivo válido. Para el branch deploy **develop**, reanuda con una revisión compatible y verifica la URL de Admin configurada. Consulta [Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/).

La restauración de D1 con Time Travel es una acción distinta, destructiva y fuera de la automatización normal: sobrescribe la base, cancela consultas en vuelo y requiere seleccionar conscientemente un bookmark. Antes de considerarla, confirma el backend/función de Time Travel habilitada para esa base, el punto temporal, el efecto sobre escrituras posteriores y el plan para deshacer la restauración. No se ejecuta como respuesta automática a un rollback de Worker. La retención indicada por Cloudflare depende del plan (7 días en Free y 30 en Paid): [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).

Wrangler aplica migraciones pendientes en secuencia y registra las aplicadas; si una migración falla, esa migración se revierte y la última anterior exitosa permanece aplicada. Valida el estado con uno de estos comandos, usando el archivo del ambiente correcto:

- Desarrollo: pnpm exec wrangler d1 migrations list DB --remote --config apps/api/wrangler.development.json
- Producción: pnpm exec wrangler d1 migrations list DB --remote --config apps/api/wrangler.production.json

No ejecutes comandos contra D1 sin revisar antes el nombre e ID del ambiente. Consulta [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) y [comandos de Wrangler D1](https://developers.cloudflare.com/d1/wrangler-commands/).
