import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ComponentProps } from "react";

type TextLinkProps = ComponentProps<typeof Link> & {
  /** Use for secondary actions — quiet text links, never competing buttons. */
  muted?: boolean;
};

/**
 * A quiet secondary action. Secondary actions are always text links so the one
 * primary Button on a screen is never rivaled.
 */
export function TextLink({
  muted = true,
  className,
  children,
  ...props
}: TextLinkProps) {
  return (
    <Link
      className={cn(
        "font-sans text-sm underline decoration-hairline underline-offset-4",
        "transition-colors duration-300 ease-keepsake hover:decoration-current",
        muted ? "text-ink-soft hover:text-ink" : "text-accent hover:text-accent-press",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
