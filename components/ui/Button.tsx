import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** "primary" is the one warm action per screen. "quiet" is a low-emphasis
   *  bordered action for the rare case two actions must both be buttons. */
  variant?: "primary" | "quiet";
  loading?: boolean;
  children: ReactNode;
};

/**
 * The primary action. Full-width by default so it lands in thumb reach on a
 * phone. Sentence case, no exclamation, no emoji (design rules). 44px+ tall.
 */
export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex min-h-[48px] w-full items-center justify-center gap-2",
        "rounded-button px-6 py-3 font-sans text-base font-medium",
        "transition-all duration-300 ease-keepsake",
        "disabled:cursor-not-allowed disabled:opacity-55",
        variant === "primary" &&
          "bg-accent-strong text-paper shadow-soft hover:bg-accent active:bg-accent-press",
        variant === "quiet" &&
          "border border-hairline bg-paper-raised text-ink hover:border-ink-soft active:bg-paper",
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin-slow"
        />
      )}
      {children}
    </button>
  );
}
