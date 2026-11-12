import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: LucideIcon;
  fullWidth?: boolean;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:brightness-110",
  secondary: "bg-surface text-ink bw hover:bg-surface-2",
  ghost: "text-primary hover:bg-surface-2 underline-offset-4",
  danger: "bg-danger text-on-danger hover:brightness-110",
};

/** A big, clearly labelled button. Always has visible text. */
export function Button({
  variant = "primary",
  icon: Icon,
  fullWidth,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-[var(--target)] items-center justify-center gap-3 rounded-2xl px-6 py-3 text-lg font-bold leading-tight transition active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100",
        variants[variant],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {Icon && <Icon aria-hidden="true" className="size-6 shrink-0" strokeWidth={2.25} />}
      <span>{children}</span>
    </button>
  );
}
