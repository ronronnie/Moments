import { cn } from "@/lib/cn";
import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Set for teller-written content (e.g. a story title) so it renders in
   *  Fraunces. Leave off for UI chrome fields. */
  serif?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, serif = false, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div className="flex w-full flex-col gap-2">
      {label && (
        <label
          htmlFor={inputId}
          className="font-sans text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-[48px] w-full rounded-button border bg-paper-raised px-4 py-3",
          "text-ink placeholder:text-ink-faint",
          "transition-colors duration-300 ease-keepsake",
          "focus:outline-none focus-visible:border-accent",
          serif ? "font-serif text-lg" : "font-sans text-base",
          error ? "border-error" : "border-hairline hover:border-ink-soft",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="font-sans text-sm text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="font-sans text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
