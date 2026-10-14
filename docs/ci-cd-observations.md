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
