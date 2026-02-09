import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { IconButton } from "./Button";
import { IconClose } from "./icons";

export type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
};

function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )
  );
  return nodes.filter((el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"));
}

export function Modal({ open, title, children, footer, onClose, size = "md" }: ModalProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const labelId = useMemo(() => `modal_${title.replace(/\\s+/g, "_").toLowerCase()}`, [title]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const root = dialogRef.current;
        if (!root) {
          return;
        }
        const focusables = getFocusable(root);
        if (!focusables.length) {
          event.preventDefault();
          return;
        }
        const active = document.activeElement as HTMLElement | null;
        const idx = active ? focusables.indexOf(active) : -1;
        const nextIdx = event.shiftKey ? (idx <= 0 ? focusables.length - 1 : idx - 1) : (idx >= focusables.length - 1 ? 0 : idx + 1);
        event.preventDefault();
        focusables[nextIdx]?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const root = dialogRef.current;
    if (!root) {
      return;
    }
    const focusables = getFocusable(root);
    (focusables[0] ?? root).focus();
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="uiModalOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={cx("uiModal", `uiModal--${size}`)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="uiModal__header">
          <div className="uiModal__titleRow">
            <div className="uiModal__title" id={labelId}>
              {title}
            </div>
            <IconButton className="uiModal__close" onClick={onClose} aria-label="Close dialog">
              <IconClose width={18} height={18} />
            </IconButton>
          </div>
        </div>

        <div className="uiModal__body">{children}</div>

        {footer ? <div className="uiModal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
