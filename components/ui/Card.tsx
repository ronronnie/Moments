import { cn } from "@/lib/cn";
import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Raise with the single soft shadow tier (default), or keep it flat. */
  raised?: boolean;
  children: ReactNode;
};

/**
 * A calm surface: 24px+ padding, 16px radius, hairline border, at most one
 * soft shadow tier. The keepsake-book page, not a dashboard panel.
 */
export function Card({
  raised = true,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-hairline bg-paper-raised p-6",
        raised && "shadow-soft",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
