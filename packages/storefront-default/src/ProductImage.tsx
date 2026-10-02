"use client";

import Image, { type ImageProps } from "next/image";
import { getProductImageUrl, PRODUCT_IMAGE_WIDTHS, PRODUCT_THUMBNAIL_WIDTH } from "@aether-commerce/core";

export type ProductImageProps = Omit<ImageProps, "src" | "loader" | "quality" | "placeholder" | "blurDataURL" | "onLoadingComplete"> & { src: string };

/** CDN resizing works even in client apps with Next's image optimizer disabled. */
export function ProductImage({ src, alt, fill, sizes, width, height, priority, preload, loading, unoptimized, overrideSrc, style, ...props }: ProductImageProps) {
  const fallbackWidth = width !== undefined ? Number(width) : PRODUCT_THUMBNAIL_WIDTH;
  const optimizedSrc = getProductImageUrl(src, fallbackWidth);
  if (optimizedSrc === src && getProductImageUrl(src, fallbackWidth + 1) === src) {
    return <Image {...props} src={src} alt={alt} {...(fill ? { fill } : {})} {...(sizes ? { sizes } : {})} {...(width !== undefined ? { width } : {})} {...(height !== undefined ? { height } : {})} {...(priority !== undefined ? { priority } : {})} {...(preload !== undefined ? { preload } : {})} {...(loading ? { loading } : {})} {...(unoptimized !== undefined ? { unoptimized } : {})} {...(overrideSrc ? { overrideSrc } : {})} {...(style ? { style } : {})} />;
  }
  const eager = priority || preload || loading === "eager";
  return (
    // Cloudinary negotiates f_auto with the browser directly; no Worker proxy or sharp is needed.
    <img
      {...props}
      src={overrideSrc ?? optimizedSrc}
      srcSet={PRODUCT_IMAGE_WIDTHS.map((candidate) => `${getProductImageUrl(src, candidate)} ${candidate}w`).join(", ")}
      alt={alt}
      sizes={sizes ?? (width ? `${width}px` : "100vw")}
      width={width}
      height={height}
      loading={eager ? "eager" : loading ?? "lazy"}
      fetchPriority={eager ? "high" : props.fetchPriority ?? "auto"}
      decoding={props.decoding ?? "async"}
      style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style}
    />
  );
}
