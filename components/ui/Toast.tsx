import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type ToastProps = {
  children: ReactNode;
  variant?: "neutral" | "success" | "error";
  onDismiss?: () => void;
  className?: string;
};

/**
 * A brief, quiet message. Warm and plain — "Your story is saved," never a
 * banner shouting. Semantic colors are muted (sage, clay).
 */
export function Toast({
  children,
  variant = "neutral",
  onDismiss,
  className,
}: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 rounded-card border bg-paper-raised px-4 py-3 shadow-soft",
        "animate-rise-in",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          variant === "success" && "bg-success",
          variant === "error" && "bg-error",
          variant === "neutral" && "bg-ink-soft",
        )}
      />
      <p className="flex-1 font-sans text-sm text-ink">{children}</p>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="grid size-6 place-items-center rounded-full text-ink-soft transition-colors duration-300 ease-keepsake hover:text-ink"
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </button>
      )}
    </div>
  );
}
