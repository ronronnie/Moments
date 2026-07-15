import { cn } from "@/lib/cn";

type ProgressBarProps = {
  /** 0–100. Ignored when `indeterminate` is set. */
  value?: number;
  /** Slow travelling fill for waits ("Listening to your story…"). */
  indeterminate?: boolean;
  className?: string;
  "aria-label"?: string;
};

/**
 * A thin, quiet progress line — playback scrub fill or a gentle wait indicator.
 * One accent, no chrome.
 */
export function ProgressBar({
  value = 0,
  indeterminate = false,
  className,
  "aria-label": ariaLabel,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel ?? (indeterminate ? "Listening to your story" : "Progress")}
      aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      className={cn(
        "relative h-1 w-full overflow-hidden rounded-full bg-hairline",
        className,
      )}
    >
      {indeterminate ? (
        <span className="absolute inset-y-0 rounded-full bg-accent animate-indeterminate" />
      ) : (
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-300 ease-keepsake"
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  );
}
