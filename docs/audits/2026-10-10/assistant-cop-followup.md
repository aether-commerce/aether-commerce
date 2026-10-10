# Seguimiento de compra en COP

Fecha: 10 de octubre de 2026. Revisión pública observada: `f6ca14f`.

Esta prueba se hizo en la tienda demo publicada, desde el catálogo y su asistente. Se enviaron tres consultas sintéticas; no se inició un pago ni se introdujeron datos de comprador.

| Caso | Resultado observado | Comportamiento esperado |
| --- | --- | --- |
| Dos accesorios distintos con total máximo de 200.000 COP | El asistente respondió que no encontró artículos. | El catálogo mostraba Cable Trenzado USB-C a USB-C por 49.000 COP y Cable Trenzado USB-C a Lightning por 66.500 COP, ambos con opción de agregar. Su total es 115.500 COP. |
| Precio del Cable Trenzado USB-C a USB-C en COP | El asistente dijo que no encontró el artículo. | Debe mostrar el artículo real y 49.000 COP. |
| Comparación de ambos cables y su suma | El asistente dijo que no encontró artículos. | Debe resolver ambos nombres y dar los precios y el total de 115.500 COP. |
| Carrito guardado antes del cambio de moneda | El chat y el carrito mostraron Soporte Plegable de Escritorio a US$19; al usar «Actualizar» en el carrito, la página mostró 66.500 COP, pero el resumen del chat siguió mostrando el valor anterior. | La vista debe actualizar la copia local con los precios vigentes y nunca sumar USD y COP. |

El código de la revisión publicada confirma factores que contribuyen al problema: el asistente asignaba USD a cada producto aunque la API entregara COP; el extractor de presupuesto no reconocía «máximo» con tilde; las preguntas con nombres concretos dependían de que el modelo eligiera bien la herramienta; y el resumen del chat leía una copia local del carrito sin actualizarla al cambiar la moneda.

La rama `fix/assistant-cop-cart` agrega respuestas deterministas para nombres exactos y parejas bajo un presupuesto, conserva la moneda del catálogo y renueva los precios de carritos locales antiguos. La corrección requiere CI, integración y una repetición de estas pruebas en producción antes de cerrar los hallazgos.

Quedan fuera de esta muestra: carga y latencia sostenida del asistente, acceso entre dos cuentas, políticas y compatibilidad, y el ciclo completo de pago Wompi en sandbox. La lista de lanzamiento comercial sigue siendo la fuente de aceptación para pagos, pedidos, inventario, notificaciones y reembolsos.
