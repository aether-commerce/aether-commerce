# Aether: flujo de ramas, publicación y despliegue

Este repositorio se opera con un único camino de promoción:

```text
rama de trabajo -> PR a develop -> PR de promoción develop a main -> CI -> producción y paquetes
```

`develop` es la rama de integración y `main` es la rama de producción. No se
publica ni se despliega desde ramas de trabajo.

## Reglas de las ramas

- Crear una rama corta desde `develop` para cada cambio: `feat/...`, `fix/...`
  o `chore/...`.
- Abrir un PR de la rama de trabajo hacia `develop`. No hacer push directo ni
  reescribir (`force-push`) `develop` o `main`.
- Una vez integrado y validado lo que se desea liberar, abrir **un solo PR**
  desde `develop` hacia `main`. No copiar commits con cherry-pick para formar
  una liberación: la promoción debe conservar el mismo historial que fue
  validado en integración.
- Mantener en el remoto únicamente `develop` y `main` de manera permanente.
  Borrar una rama corta remota solo después de que su PR se haya fusionado y
  no tenga commits exclusivos. Antes de borrar una rama local, comprobar que
  no esté ocupada por un worktree y que no tenga cambios sin confirmar.

Configuración obligatoria de protección para ambas ramas:

- PR obligatorio, sin bypass para los autores habituales.
- Requerir el check `Aether CI / validate` del **head actual del PR**.
- Bloquear pushes directos, force-pushes y borrado de las ramas.
- Requerir que la rama esté actualizada con la base antes de fusionar.

## Antes de abrir un PR

Ejecutar desde una copia limpia de la rama y corregir cualquier fallo antes de
enviar el cambio:

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm build
pnpm test:client-template
pnpm check:changesets
```

Todo cambio publicable dentro de `packages/*` necesita un changeset. No borrar
un changeset pendiente para hacer pasar CI. Los cambios de infraestructura,
migraciones y contratos deben incluir sus pruebas y ser compatibles con el
despliegue gradual.

Antes de abrir cada PR, crear un archivo nuevo `.changeset/<nombre>.md` para
cada cambio que modifique un paquete público de `packages/*` y listar todos los
paquetes públicos afectados con el nivel `patch`, `minor` o `major` adecuado.
Ejecutar `pnpm check:changesets` como parte del preflight y conservar el
changeset en el PR; solo se consume después mediante el PR automatizado de
versiones. La configuración debe conservar el generador oficial
`@changesets/cli/changelog` para que el PR automatizado también genere o
actualice el `CHANGELOG.md` de cada paquete versionado. Si el cambio no toca
ningún paquete público, no hace falta crear uno.

## Promoción `rama -> develop`

1. Rebasar o fusionar la última `develop` en la rama de trabajo, resolver los
   conflictos y repetir el preflight.
2. Abrir el PR hacia `develop` y esperar un `Aether CI / validate` exitoso del
   commit final. Una ejecución mediante `workflow_dispatch` no sustituye el
   check de un PR: GitHub no la asocia a ese PR.
3. Fusionar solamente cuando el check requerido corresponda al head actual.
4. Confirmar que el push resultante a `develop` también termine con CI verde.
   El flujo `Prepare Aether package release` puede preparar un PR de versión
   cuando existan changesets.

## Promoción `develop -> main`

1. Cerrar o integrar los PR que deban entrar en la versión y confirmar que
   `develop` está verde.
2. Abrir el PR de promoción con base `main` y head `develop`; revisar el diff
   completo, las migraciones y los cambios de versión generados.
3. Esperar `Aether CI / validate` en el PR de promoción. No usar commits vacíos
   ni ejecuciones manuales para aparentar que un PR está validado.
4. Fusionar el PR sin reescribir el historial. El push a `main` activa el CI
   de producción; `Deploy Aether production` solo debe continuar si ese CI de
   push concluye correctamente.
5. Vigilar la ejecución hasta que termine y verificar storefront, API
   (`/api/v1/health`), asistente (`/healthz`), administración y portfolio.
   Confirmar que la revisión desplegada coincide con el SHA fusionado en
   `main`.

## Paquetes y release automatizado

- La versión se prepara desde `develop` con Changesets y se revisa como un PR
  normal a `main`. Tras fusionarlo, la publicación y las etiquetas se ejecutan
  desde `main`, nunca desde una rama temporal.
- El actor que crea o actualiza el PR de versión debe ser una GitHub App (o un
  token de bot equivalente) con permisos de contenidos y pull requests. El
  `GITHUB_TOKEN` del workflow no debe ser el único mecanismo: sus pushes y PRs
  pueden no disparar los workflows posteriores, dejando la publicación o el
  despliegue sin el CI asociado.
- Configurar la automatización para reutilizar una sola rama estable de
  release, no para forzar ni recrear ramas activas. Si existe un PR de release
  abierto, actualizarlo de forma segura y esperar su CI real.
- Publicar solamente después del merge del PR de versión que pasó CI. No
  etiquetar ni notificar al cliente si la publicación falla. Verificar el
  resultado de publicación, las etiquetas y la actualización del cliente como
  pasos separados y observables.

## Respuesta ante un fallo

1. Detener la promoción y conservar el SHA y los logs de la ejecución fallida.
2. Clasificar el fallo: validación, protección de rama, publicación, migración
   o despliegue. Corregirlo en una rama nueva hacia `develop`; no parchear
   `main` directamente.
3. Repetir la cadena completa de PR y CI. Las ejecuciones manuales solo sirven
   para diagnóstico o para reintentar un workflow que ya está autorizado; no
   reemplazan controles de rama ni pruebas del PR.
4. Después de cada release, eliminar las ramas remotas ya fusionadas y dejar
   `develop` y `main` como las únicas ramas permanentes.
