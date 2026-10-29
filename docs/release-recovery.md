# Reanudar y verificar releases

El release se identifica por el SHA completo del commit en `main`. Para consultar el
último estado desde un checkout con acceso de lectura a GitHub:

```bash
pnpm release:verify --sha <SHA_DE_MAIN> --json
```

El resultado versionado muestra CI de push, deploy de producción, publicación,
manifiesto inmutable, entrega a Liminal y reconciliación del historial de
`main` en `develop`. `complete` significa que todos los destinos aplicables
tienen evidencia. `incomplete`, `failed` o `unknown` indican la etapa y el
enlace o motivo disponible. El comando consulta GitHub y no modifica el release.

Si el resultado indica `dispatch`, reanudar **una etapa** con el `planId` recién
obtenido:

```bash
pnpm release:resume --sha <SHA_DE_MAIN> --plan <PLAN_ID>
```

El comando vuelve a consultar el estado antes de actuar. Rechaza un plan viejo,
un SHA que ya no sea el head de `main`, CI de push no exitoso o una ejecución
todavía activa. Puede reintentar el deploy de producción, la fase de manifiesto
y entrega de paquetes **ya publicados**, o la creación del PR de historial.
Nunca republica paquetes desde el reintento. Si la publicación falló antes de
crear el manifiesto, requiere inspeccionar el registro y los tags antes de
continuar con el procedimiento de recuperación de paquetes.

Tras un CI de push exitoso en `main`, `Sync Aether main history` crea o actualiza
un PR desde `chore/sync-main-to-develop` hacia `develop`, sin force push. Si el
merge no cambia archivos, habilita auto-merge y además espera el CI real del
PR. Al terminar ese CI, un job comprueba otra vez el SHA del head, el diff vacío,
que contiene los heads actuales de `main` y `develop`, y fusiona el PR si GitHub
aún no aplicó auto-merge. Otro job elimina la rama tras el CI del push a
`develop` y solo si su head es ancestro de `develop`. Si cambia archivos o hay conflictos, deja el
PR para revisión. Una promoción posterior debe esperar a que
`main` sea ancestro de `develop`.

El bot necesita `AETHER_RELEASE_TOKEN` con permiso de escritura de contenidos y
pull requests. La rama de sincronización se reutiliza solo cuando conserva sus
commits y su PR abierto; si quedó integrada sin PR, se elimina antes de crear
una nueva. Nunca se descartan commits exclusivos de una rama huérfana.
