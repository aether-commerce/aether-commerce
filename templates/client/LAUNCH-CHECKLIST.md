# Aether: condiciones de entrega de una tienda

Esta plantilla entrega catálogo, administración, carrito y conectores de pago.
El asistente de IA de la tienda **no está incluido como servicio desplegable**
en la entrega inicial: `apps/ai/` es un adaptador para una implementación
posterior. No se debe ofertar como «tienda con IA lista para operar» hasta
construir, desplegar y probar ese servicio para el cliente.

## Antes de aceptar pagos reales

- [ ] Contratar el dominio y comprobar que tienda, API y panel usan los
  orígenes correctos y HTTPS.
- [ ] Configurar un proveedor de pago y su secreto de webhook en el mismo
  entorno. Confirmar moneda, país, cuenta receptora y flujo de reembolso.
- [ ] Configurar origen de correo y entrega transaccional; probar pedido,
  restock y alerta de disputa.
- [ ] Cargar catálogo real: precios, impuestos aplicables, SKU, fotos que
  correspondan al producto y cantidad física inicial. Revisar variantes.
- [ ] Definir zonas, coste y plazo de envío. Si se cobra envío, confirmar que
  la dirección obligatoria se pide antes de pagar.
- [ ] Publicar con asesoría del comercio las políticas de privacidad, cookies,
  términos, envío, garantía y devoluciones. Las páginas y textos legales son
  responsabilidad del comercio; no se incluyen textos universales.
- [ ] Probar en sandbox cupón, envío, pago aprobado y rechazado, pago tardío,
  último artículo, cancelación, reembolso parcial y reembolso total. Confirmar
  pedido, saldo, correo, stock y webhook en cada caso.
- [ ] Confirmar que el HTML desplegado entrega CSP, HSTS y demás cabeceras en
  portada, producto, checkout, error y panel autenticado.
- [ ] Ensayar copia/restauración de la base y acordar tiempos de recuperación,
  soporte y salida/exportación de datos con el cliente.
- [ ] Entregar por escrito el alcance contratado, titularidad de dominio/datos,
  costes recurrentes y licencia comercial aplicable; el repositorio no concede
  por sí solo uso comercial bajo su licencia no comercial.

Los reembolsos no reponen inventario automáticamente: solo se repone tras
verificar la recepción y el estado físico del artículo. No lanzar una tienda
si una prueba de pago deja dinero cobrado sin pedido o caso de conciliación
visible para el operador.
