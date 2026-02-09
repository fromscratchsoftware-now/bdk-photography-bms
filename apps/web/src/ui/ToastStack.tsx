import { cx } from "./cx";
import { IconButton } from "./Button";
import { IconClose } from "./icons";

export type ToastTone = "success" | "error" | "warning" | "info";

export type Toast = {
  id: string;
  tone: ToastTone;
  title?: string;
  message: string;
};

export function ToastStack({
  toasts,
  onDismiss
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}): JSX.Element {
  return (
    <div className="uiToastStack" aria-live="polite" aria-relevant="additions removals">
      {toasts.map((toast) => (
        <div key={toast.id} className={cx("uiToast", `uiToast--${toast.tone}`)} role="status">
          <div className="uiToast__body">
            {toast.title ? <div className="uiToast__title">{toast.title}</div> : null}
            <div className="uiToast__message">{toast.message}</div>
          </div>
          <IconButton className="uiToast__close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
            <IconClose width={18} height={18} />
          </IconButton>
        </div>
      ))}
    </div>
  );
}

