import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type ChipProps = {
  children: ReactNode;
  /** A confirmed suggestion reads as settled; unconfirmed reads as tentative. */
  selected?: boolean;
  onClick?: () => void;
  /** When provided, shows a quiet remove affordance. */
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
};

/**
 * A suggestion chip. Extracted context (people, place, timeframe, occasion) is
 * always a suggestion the user confirms or corrects — never treated as fact.
 * Tentative until `selected`.
 */
export function Chip({
  children,
  selected = false,
  onClick,
  onRemove,
  removeLabel = "Remove",
  className,
}: ChipProps) {
  const interactive = Boolean(onClick);

  return (
    <span
      className={cn(
        "inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 py-1.5",
        "font-sans text-sm transition-colors duration-300 ease-keepsake",
        selected
          ? "border border-accent bg-accent/10 text-ink"
          : "border border-dashed border-hairline bg-paper-raised text-ink-soft",
        interactive && "cursor-pointer hover:border-ink-soft",
        className,
      )}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      aria-pressed={interactive ? selected : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="grid size-5 place-items-center rounded-full text-ink-soft transition-colors duration-300 ease-keepsake hover:text-error"
        >
          <span aria-hidden className="text-base leading-none">
            ×
          </span>
        </button>
      )}
    </span>
  );
}
