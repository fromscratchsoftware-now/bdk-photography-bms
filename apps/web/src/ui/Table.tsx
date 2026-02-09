import type { ReactNode } from "react";
import { cx } from "./cx";

export function Table({
  children,
  className,
  minWidth
}: {
  children: ReactNode;
  className?: string;
  minWidth?: number;
}): JSX.Element {
  return (
    <div className={cx("uiTableWrap", className)} style={minWidth ? { minWidth } : undefined}>
      <table className="uiTable">{children}</table>
    </div>
  );
}

