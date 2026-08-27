import Image from "next/image";

/**
 * The illustrated teacher avatar from the Figma file.
 *
 * Exported from Figma as an SVG, but that export was a 762 KB base64 raster
 * wrapped in SVG markup — and `next/image` passes SVGs through unoptimised, so
 * it would ship in full on every visit. Rasterised to WebP instead: same
 * pixels, ~39x smaller, and now eligible for Next's image optimisation.
 */
export function MascotAvatar() {
  return (
    <Image
      src="/hero-icon.webp"
      alt=""
      aria-hidden="true"
      width={112}
      height={112}
      priority
      className="mx-auto"
    />
  );
}
