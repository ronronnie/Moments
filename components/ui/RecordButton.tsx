"use client";

import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type RecordButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  recording?: boolean;
};

/**
 * The moment of vulnerability made calm. At rest it breathes (slow 4s scale
 * pulse); while recording it ripples softly outward. Never mechanical, never
 * bouncy. A large circular target well above the 44px minimum.
 */
export function RecordButton({
  recording = false,
  disabled,
  className,
  "aria-label": ariaLabel,
  ...props
}: RecordButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={recording}
      aria-label={ariaLabel ?? (recording ? "Stop recording" : "Start telling your story")}
      className={cn(
        "relative grid size-20 place-items-center rounded-full",
        "border border-hairline bg-paper-raised shadow-soft",
        "transition-transform duration-500 ease-keepsake",
        "disabled:cursor-not-allowed disabled:opacity-55",
        !disabled && !recording && "animate-breathe hover:scale-[1.04]",
        !disabled && recording && "animate-ripple",
        className,
      )}
      {...props}
    >
      {/* Idle: a warm terracotta dot. Recording: a rounded stop square. */}
      <span
        aria-hidden
        className={cn(
          "bg-accent transition-all duration-500 ease-keepsake",
          recording ? "size-6 rounded-md" : "size-9 rounded-full",
        )}
      />
    </button>
  );
}
