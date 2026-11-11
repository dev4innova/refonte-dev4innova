import Image from "next/image";
import type * as React from "react";

import { cn } from "@/lib/utils";

export type ProductFrameImage = {
  src: string;
  /** Describes what the screenshot shows (required, FR/EN). */
  alt: string;
  width: number;
  height: number;
};

export type ProductFrameProps = Omit<React.ComponentProps<"figure">, "children"> & {
  /** Window title shown in the bar (product name). */
  title: string;
  /**
   * Mandatory label stating that the data shown are demonstration data ("Démonstration").
   * Real product screenshots only; never a mock-up presented as a client project.
   */
  demoLabel: string;
  caption?: React.ReactNode;
  image?: ProductFrameImage;
  /** Responsive sizes of the image (next/image). */
  sizes?: string;
  /** Content shown instead of an image (skeleton while a screenshot is not available). */
  children?: React.ReactNode;
};

/** "Window" frame around a real screenshot of a product built by DEV4INNOVA. */
export function ProductFrame({
  title,
  demoLabel,
  caption,
  image,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  children,
  className,
  ...props
}: ProductFrameProps) {
  return (
    <figure data-slot="product-frame" className={cn("flex flex-col gap-3", className)} {...props}>
      <div className="overflow-hidden rounded-frame border border-hairline bg-card shadow-frame">
        <div
          data-slot="product-frame-bar"
          className="flex items-center gap-1.5 bg-inverse-elevated px-3 py-2 text-inverse-muted-foreground"
        >
          <span aria-hidden="true" className="size-2 rounded-full bg-inverse-border" />
          <span aria-hidden="true" className="size-2 rounded-full bg-inverse-border" />
          <span aria-hidden="true" className="size-2 rounded-full bg-inverse-border" />
          <span className="ml-2 truncate text-xs font-medium">{title}</span>
        </div>
        <div className="aspect-[16/10] bg-muted">
          {image ? (
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes={sizes}
              className="size-full object-cover object-top-left"
            />
          ) : (
            children
          )}
        </div>
      </div>
      <figcaption className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground in-data-[variant=inverse]:text-inverse-muted-foreground">
        <span
          data-slot="product-frame-demo"
          className="rounded-sm border border-current px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide"
        >
          {demoLabel}
        </span>
        {caption}
      </figcaption>
    </figure>
  );
}
