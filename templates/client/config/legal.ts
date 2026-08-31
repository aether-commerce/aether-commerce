/**
 * Bump this whenever your privacy/cookie policy changes - AssistantWidget
 * and ContactForm both send it with every request so consent stays tied to
 * whatever version of the policy the visitor actually agreed to.
 *
 * The route shells and default renderer are part of the template. Copy or
 * replace this client-owned copy and contact block before taking a store
 * live, then bump this version whenever the policies change.
 */
export const legalPolicyVersion = "1.0.0";

type LegalDocuments = {
  es: Record<
    "privacy" | "cookies" | "terms" | "returns" | "shipping",
    {
      eyebrow: string;
      title: string;
      summary: string;
      updated: string;
      sections: Array<{
        title: string;
        paragraphs?: string[];
        items?: string[];
        links?: Array<{ label: string; href: string }>;
      }>;
    }
  >;
  en: Record<
    "privacy" | "cookies" | "terms" | "returns" | "shipping",
    {
      eyebrow: string;
      title: string;
      summary: string;
      updated: string;
      sections: Array<{
        title: string;
        paragraphs?: string[];
        items?: string[];
        links?: Array<{ label: string; href: string }>;
      }>;
    }
  >;
};

const contact = {
  name: "Store owner",
  address: "Add the store's legal address",
  email: "owner@example.com",
  phone: "Add the store's phone number"
};

const contactLine = `${contact.name} · ${contact.address} · ${contact.email} · ${contact.phone}`;

export const legalDocuments = {
  es: {
    privacy: {
      eyebrow: "Legal / Datos personales",
      title: "Política de privacidad y tratamiento de datos",
      summary:
        "Información sobre los datos que trata la tienda, sus finalidades y los derechos de sus visitantes y clientes.",
      updated: "Última actualización: 31 de agosto de 2026 · Versión 1.0.0",
      sections: [
        {
          title: "1. Responsable y contacto",
          paragraphs: [
            `El responsable de esta tienda es ${contactLine}. Puedes usar la página de contacto para consultas, solicitudes de acceso, corrección, actualización, revocación o supresión cuando corresponda.`
          ]
        },
        {
          title: "2. Información que tratamos",
          items: [
            "Datos que entregas al crear una cuenta, realizar un pedido o comunicarte con la tienda.",
            "Datos de navegación, carrito y preferencias necesarios para prestar el servicio.",
            "Información técnica y registros mínimos de seguridad para prevenir fraude, abuso y errores."
          ]
        },
        {
          title: "3. Finalidades",
          paragraphs: [
            "Usamos la información para operar el catálogo, procesar pedidos, responder solicitudes, mantener la seguridad y cumplir obligaciones legales. No vendemos datos personales ni los usamos para publicidad no autorizada."
          ]
        },
        {
          title: "4. Derechos y solicitudes",
          paragraphs: [
            "Puedes solicitar conocer, actualizar, corregir o eliminar tus datos cuando sea procedente. Incluye tu nombre, la solicitud y datos suficientes para verificar tu identidad. Para asuntos de protección de datos en Colombia también puedes acudir a la Superintendencia de Industria y Comercio."
          ]
        }
      ]
    },
    cookies: {
      eyebrow: "Legal / Navegador",
      title: "Política de cookies y almacenamiento local",
      summary:
        "La tienda usa tecnologías funcionales para mantener la sesión, el carrito, las preferencias y la seguridad.",
      updated: "Última actualización: 31 de agosto de 2026 · Versión 1.0.0",
      sections: [
        {
          title: "1. Uso funcional",
          paragraphs: [
            "El almacenamiento local y las cookies estrictamente necesarias pueden conservar sesión, carrito, idioma, tema y preferencias. No se activan tecnologías publicitarias por defecto."
          ]
        },
        {
          title: "2. Gestión",
          paragraphs: [
            "Puedes borrar cookies y almacenamiento desde la configuración de tu navegador. Esto puede cerrar tu sesión o eliminar el carrito y preferencias guardadas."
          ]
        },
        {
          title: "3. Cambios",
          paragraphs: [
            "Si se agregan analítica no esencial, personalización o publicidad, esta política se actualizará y se solicitará el consentimiento requerido antes de activar esas categorías."
          ]
        }
      ]
    },
    terms: {
      eyebrow: "Legal / Uso",
      title: "Términos y condiciones",
      summary: "Reglas para navegar, comprar y comunicarse con la tienda.",
      updated: "Última actualización: 31 de agosto de 2026 · Versión 1.0.0",
      sections: [
        {
          title: "1. Catálogo y pedidos",
          paragraphs: [
            "Las publicaciones muestran la información disponible al momento de consulta. Un pedido queda sujeto a disponibilidad, validación del pago, datos de entrega y confirmación de la tienda."
          ]
        },
        {
          title: "2. Uso permitido",
          items: [
            "Entregar información veraz y mantener segura la cuenta.",
            "No intentar vulnerar la tienda, automatizar abuso, suplantar a terceros ni enviar contenido ilícito.",
            "Revisar precios, cantidades, dirección y condiciones antes de confirmar un pedido."
          ]
        },
        {
          title: "3. Contacto y ley aplicable",
          paragraphs: [
            `Para preguntas o reclamaciones, comunícate con ${contactLine}. Se aplican las normas colombianas y los derechos imperativos del consumidor.`
          ]
        }
      ]
    },
    returns: {
      eyebrow: "Ayuda / Compras",
      title: "Devoluciones, cambios y garantías",
      summary: "Canales generales para solicitar soporte después de una compra.",
      updated: "Última actualización: 31 de agosto de 2026 · Versión 1.0.0",
      sections: [
        {
          title: "1. Solicitudes",
          paragraphs: [
            `Escríbenos a ${contact.email} con tu número de pedido, nombre, motivo y fotografías cuando sean útiles. La tienda confirmará requisitos, dirección y pasos según el caso.`
          ]
        },
        {
          title: "2. Derechos del consumidor",
          paragraphs: [
            "Las solicitudes se revisan conforme a la garantía legal, el retracto, la reversión del pago y demás derechos aplicables en Colombia. Las condiciones particulares del producto y la orden prevalecen cuando sean más favorables."
          ]
        },
        { title: "3. Contacto", paragraphs: [`Responsable: ${contactLine}.`] }
      ]
    },
    shipping: {
      eyebrow: "Ayuda / Entregas",
      title: "Política de envíos",
      summary: "Información sobre cobertura, costos, tiempos y novedades de entrega.",
      updated: "Última actualización: 31 de agosto de 2026 · Versión 1.0.0",
      sections: [
        {
          title: "1. Antes de comprar",
          paragraphs: [
            "La tienda muestra, cuando están disponibles, cobertura, costo y tiempo estimado antes de confirmar el pedido. Las fechas pueden variar por inventario, transportador, clima o fuerza mayor."
          ]
        },
        {
          title: "2. Incidencias",
          paragraphs: [
            `Si tu pedido se retrasa o llega con una novedad, conserva el comprobante y comunícate con ${contact.email}. No envíes datos de pago completos por correo o chat.`
          ]
        },
        { title: "3. Contacto", paragraphs: [`Responsable: ${contactLine}.`] }
      ]
    }
  },
  en: {
    privacy: {
      eyebrow: "Legal / Personal data",
      title: "Privacy and personal data policy",
      summary:
        "How the store processes visitor and customer information and how to exercise applicable rights.",
      updated: "Last updated: August 31, 2026 · Version 1.0.0",
      sections: [
        {
          title: "1. Controller and contact",
          paragraphs: [
            `The store controller is ${contactLine}. Use the contact page for access, correction, update, withdrawal, or deletion requests where applicable.`
          ]
        },
        {
          title: "2. Information processed",
          items: [
            "Information you provide when creating an account, placing an order, or contacting the store.",
            "Browsing, cart, and preference data needed to provide the service.",
            "Minimal technical and security records used to prevent fraud, abuse, and errors."
          ]
        },
        {
          title: "3. Purposes",
          paragraphs: [
            "We use information to operate the catalog, process orders, answer requests, protect the service, and comply with law. We do not sell personal data or use it for unauthorized advertising."
          ]
        },
        {
          title: "4. Rights and requests",
          paragraphs: [
            "You may request access, correction, update, or deletion where applicable. Include your name, request, and enough information to verify your identity. Colombian data-protection matters may also be raised with the Superintendence of Industry and Commerce."
          ]
        }
      ]
    },
    cookies: {
      eyebrow: "Legal / Browser",
      title: "Cookie and local storage policy",
      summary:
        "Functional technologies keep the session, cart, preferences, and security features working.",
      updated: "Last updated: August 31, 2026 · Version 1.0.0",
      sections: [
        {
          title: "1. Functional use",
          paragraphs: [
            "Essential cookies and local storage may preserve session, cart, language, theme, and preferences. Advertising technologies are not enabled by default."
          ]
        },
        {
          title: "2. Controls",
          paragraphs: [
            "You can clear cookies and storage in browser settings. This may sign you out or remove saved cart and preferences."
          ]
        },
        {
          title: "3. Changes",
          paragraphs: [
            "If non-essential analytics, personalization, or advertising is added, this policy will be updated and required consent will be requested before activation."
          ]
        }
      ]
    },
    terms: {
      eyebrow: "Legal / Use",
      title: "Terms and conditions",
      summary: "Rules for browsing, purchasing from, and contacting the store.",
      updated: "Last updated: August 31, 2026 · Version 1.0.0",
      sections: [
        {
          title: "1. Catalog and orders",
          paragraphs: [
            "Listings reflect information available at the time of viewing. Orders remain subject to availability, payment validation, delivery information, and store confirmation."
          ]
        },
        {
          title: "2. Acceptable use",
          items: [
            "Provide accurate information and protect your account.",
            "Do not compromise the store, automate abuse, impersonate others, or submit unlawful content.",
            "Review prices, quantities, delivery details, and conditions before confirming an order."
          ]
        },
        {
          title: "3. Contact and governing law",
          paragraphs: [
            `For questions or claims, contact ${contactLine}. Colombian law and mandatory consumer rights apply.`
          ]
        }
      ]
    },
    returns: {
      eyebrow: "Help / Purchases",
      title: "Returns, exchanges, and warranties",
      summary: "General channels for support after a purchase.",
      updated: "Last updated: August 31, 2026 · Version 1.0.0",
      sections: [
        {
          title: "1. Requests",
          paragraphs: [
            `Email ${contact.email} with your order number, name, reason, and photos where useful. The store will confirm requirements, return address, and next steps.`
          ]
        },
        {
          title: "2. Consumer rights",
          paragraphs: [
            "Requests are reviewed under applicable legal warranty, withdrawal, payment-reversal, and other Colombian consumer rights. Product- and order-specific terms apply where they are more favorable."
          ]
        },
        { title: "3. Contact", paragraphs: [`Controller: ${contactLine}.`] }
      ]
    },
    shipping: {
      eyebrow: "Help / Delivery",
      title: "Shipping policy",
      summary: "Information about delivery coverage, costs, timing, and incidents.",
      updated: "Last updated: August 31, 2026 · Version 1.0.0",
      sections: [
        {
          title: "1. Before purchase",
          paragraphs: [
            "Where available, the store shows coverage, cost, and estimated timing before order confirmation. Dates may change because of inventory, carrier, weather, or force majeure."
          ]
        },
        {
          title: "2. Incidents",
          paragraphs: [
            `If an order is delayed or arrives with an issue, keep your receipt and contact ${contact.email}. Do not send full payment details by email or chat.`
          ]
        },
        { title: "3. Contact", paragraphs: [`Controller: ${contactLine}.`] }
      ]
    }
  }
} satisfies LegalDocuments;
