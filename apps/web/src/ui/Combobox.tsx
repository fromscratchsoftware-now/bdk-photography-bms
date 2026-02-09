import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "./cx";

export type ComboboxOption = {
  value: string;
  label: string;
  keywords?: string;
  disabled?: boolean;
};

export function Combobox({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  className
}: {
  value: string;
  options: ComboboxOption[];
  onChange: (nextValue: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  useEffect(() => {
    if (!open) {
      setQuery(selected?.label ?? "");
      setHighlight(-1);
    }
  }, [open, selected?.label]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return options;
    }
    return options.filter((o) => {
      const hay = `${o.label} ${o.keywords ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      if (!root.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const listId = useMemo(() => `cb_${Math.random().toString(36).slice(2)}`, []);

  function commit(option: ComboboxOption): void {
    if (option.disabled) {
      return;
    }
    onChange(option.value);
    setOpen(false);
    // Keep focus on the input after selection.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className={cx("uiCombobox", className)} ref={rootRef}>
      <input
        ref={inputRef}
        className="uiCombobox__input"
        type="text"
        value={open ? query : selected?.label ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onFocus={() => {
          if (disabled) {
            return;
          }
          setOpen(true);
          setQuery(selected?.label ?? "");
        }}
        onChange={(event) => {
          setOpen(true);
          setQuery(event.target.value);
          setHighlight(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setHighlight((prev) => {
              const next = prev + 1;
              return next >= filtered.length ? 0 : next;
            });
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setHighlight((prev) => {
              const next = prev - 1;
              return next < 0 ? Math.max(filtered.length - 1, 0) : next;
            });
            return;
          }

          if (event.key === "Enter") {
            if (!open) {
              setOpen(true);
              return;
            }
            const pick = filtered[highlight] ?? filtered[0] ?? null;
            if (pick) {
              event.preventDefault();
              commit(pick);
            }
          }
        }}
      />

      {open ? (
        <div className="uiCombobox__popover">
          <ul className="uiCombobox__list" id={listId} role="listbox">
            {filtered.length ? (
              filtered.map((opt, idx) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  className={cx(
                    "uiCombobox__option",
                    idx === highlight && "isHighlighted",
                    opt.value === value && "isSelected",
                    opt.disabled && "isDisabled"
                  )}
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commit(opt)}
                >
                  <span className="uiCombobox__label">{opt.label}</span>
                </li>
              ))
            ) : (
              <li className="uiCombobox__empty">No matches</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

