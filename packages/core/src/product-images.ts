import type { Product } from "@aether-commerce/schemas";

export const PRODUCT_THUMBNAIL_WIDTH = 640;
export const PRODUCT_DETAIL_WIDTH = 1600;
export const PRODUCT_IMAGE_WIDTHS = [64, 128, 256, 384, 480, 640, 768, 960, 1280, 1600, 1920] as const;

const deliveryTransform = /^c_limit,w_\d+,q_auto,f_auto$/;
const transformation = /^(?:a|ar|b|bo|c|co|d|dn|dpr|e|f|fl|g|h|l|o|q|r|t|u|w|x|y|z)_[^/]+$/;

/** Public unsigned Cloudinary images only. Keep other providers and signed URLs intact. */
export function getProductImageUrl(src: string, width: number): string {
  if (!Number.isFinite(width) || width <= 0) return src;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.port || url.username || url.password) return src;
  const match = url.pathname.match(/^\/([^/]+)\/image\/upload\/(.+)$/);
  if (!match || /(?:^|\/)s--[^/]+--(?:\/|$)/.test(url.pathname) || url.searchParams.has("__cld_token__") || /\.(?:svg|gif)$/i.test(url.pathname)) return src;

  const segments = match[2]!.split("/");
  const transforms: string[] = [];
  while (segments.length > 1 && transformation.test(segments[0]!)) {
    const segment = segments.shift()!;
    // Replace our delivery step rather than stacking resizes on an API thumbnail.
    if (!deliveryTransform.test(segment)) transforms.push(segment);
  }
  const boundedWidth = Math.min(2560, Math.round(width));
  transforms.push(`c_limit,w_${boundedWidth},q_auto,f_auto`);
  url.pathname = `/${match[1]}/image/upload/${[...transforms, ...segments].join("/")}`;
  return url.toString();
}

/** Presentation copy only: never mutate the cached/admin product or persisted originals. */
export function withStorefrontProductImages(product: Product): Product {
  return {
    ...product,
    thumbnail: getProductImageUrl(product.thumbnail, PRODUCT_THUMBNAIL_WIDTH),
    images: product.images.map((image) => ({ ...image, url: getProductImageUrl(image.url, PRODUCT_DETAIL_WIDTH) })),
    gallery: product.gallery.map((src) => getProductImageUrl(src, PRODUCT_DETAIL_WIDTH)),
    category: { ...product.category, image: product.category.image ? getProductImageUrl(product.category.image, PRODUCT_THUMBNAIL_WIDTH) : product.category.image }
  };
}
