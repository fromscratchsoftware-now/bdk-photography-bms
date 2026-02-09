import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={cx("uiButton", `uiButton--${variant}`, `uiButton--${size}`, className)}
      {...props}
    >
      {icon ? <span className="uiButton__icon" aria-hidden="true">{icon}</span> : null}
      <span className="uiButton__label">{children}</span>
    </button>
  );
}

export function IconButton({
  className,
  children,
  variant = "ghost",
  size = "md",
  type = "button",
  ...props
}: Omit<ButtonProps, "icon">): JSX.Element {
  return (
    <button
      type={type}
      className={cx("uiIconButton", `uiButton--${variant}`, `uiButton--${size}`, className)}
      {...props}
    >
      {children}
    </button>
  );
}

