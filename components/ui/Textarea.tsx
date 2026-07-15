"use client";

import { cn } from "@/lib/cn";
import { forwardRef, useId } from "react";
import type { ReactNode, TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Set for story content the teller wrote/said: Fraunces, capped at ~60ch
   *  measure for comfortable reading and editing. */
  serif?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { label, hint, error, serif = false, className, id, rows = 5, ...props },
    ref,
  ) {
    const autoId = useId();
    const areaId = id ?? autoId;
    const describedBy = error
      ? `${areaId}-error`
      : hint
        ? `${areaId}-hint`
        : undefined;

    return (
      <div className="flex w-full flex-col gap-2">
        {label && (
          <label
            htmlFor={areaId}
            className="font-sans text-sm font-medium text-ink"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full rounded-card border bg-paper-raised px-4 py-3",
            "text-ink placeholder:text-ink-faint",
            "transition-colors duration-300 ease-keepsake",
            "focus:outline-none focus-visible:border-accent",
            // ~60ch reading/editing measure for story text.
            serif
              ? "font-serif text-lg leading-relaxed [max-width:60ch]"
              : "font-sans text-base",
            error ? "border-error" : "border-hairline hover:border-ink-soft",
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={`${areaId}-error`} className="font-sans text-sm text-error">
            {error}
          </p>
        ) : hint ? (
          <p id={`${areaId}-hint`} className="font-sans text-sm text-ink-soft">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
