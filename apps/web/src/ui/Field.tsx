import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "./cx";
import { Combobox, type ComboboxOption } from "./Combobox";

type FieldBaseProps = {
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  rightSlot?: ReactNode;
  className?: string;
};

export type TextFieldProps = FieldBaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, "required">;

export function TextField({
  label,
  helper,
  error,
  required,
  rightSlot,
  className,
  id,
  ...props
}: TextFieldProps): JSX.Element {
  const safeId = id ?? `field_${label.replace(/\\s+/g, "_").toLowerCase()}`;
  const describedBy = error ? `${safeId}__error` : helper ? `${safeId}__helper` : undefined;
  return (
    <label className={cx("uiField", error && "uiField--error", className)} htmlFor={safeId}>
      <span className="uiField__label">
        {label}
        {required ? <span className="uiField__required" aria-hidden="true">*</span> : null}
      </span>
      <span className="uiField__controlRow">
        <input
          id={safeId}
          className="uiField__control"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          {...props}
        />
        {rightSlot ? <span className="uiField__rightSlot">{rightSlot}</span> : null}
      </span>
      {error ? (
        <span className="uiField__error" id={`${safeId}__error`}>
          {error}
        </span>
      ) : helper ? (
        <span className="uiField__helper" id={`${safeId}__helper`}>
          {helper}
        </span>
      ) : null}
    </label>
  );
}

export type SelectFieldProps = FieldBaseProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, "required">;

export function SelectField({
  label,
  helper,
  error,
  required,
  rightSlot,
  className,
  id,
  children,
  ...props
}: SelectFieldProps): JSX.Element {
  const safeId = id ?? `field_${label.replace(/\\s+/g, "_").toLowerCase()}`;
  const describedBy = error ? `${safeId}__error` : helper ? `${safeId}__helper` : undefined;
  return (
    <label className={cx("uiField", error && "uiField--error", className)} htmlFor={safeId}>
      <span className="uiField__label">
        {label}
        {required ? <span className="uiField__required" aria-hidden="true">*</span> : null}
      </span>
      <span className="uiField__controlRow">
        <select
          id={safeId}
          className="uiField__control"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          {...props}
        >
          {children}
        </select>
        {rightSlot ? <span className="uiField__rightSlot">{rightSlot}</span> : null}
      </span>
      {error ? (
        <span className="uiField__error" id={`${safeId}__error`}>
          {error}
        </span>
      ) : helper ? (
        <span className="uiField__helper" id={`${safeId}__helper`}>
          {helper}
        </span>
      ) : null}
    </label>
  );
}

export type TextAreaFieldProps = FieldBaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "required">;

export function TextAreaField({
  label,
  helper,
  error,
  required,
  className,
  id,
  ...props
}: TextAreaFieldProps): JSX.Element {
  const safeId = id ?? `field_${label.replace(/\\s+/g, "_").toLowerCase()}`;
  const describedBy = error ? `${safeId}__error` : helper ? `${safeId}__helper` : undefined;
  return (
    <label className={cx("uiField", error && "uiField--error", className)} htmlFor={safeId}>
      <span className="uiField__label">
        {label}
        {required ? <span className="uiField__required" aria-hidden="true">*</span> : null}
      </span>
      <textarea
        id={safeId}
        className="uiField__control uiField__control--textarea"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required={required}
        {...props}
      />
      {error ? (
        <span className="uiField__error" id={`${safeId}__error`}>
          {error}
        </span>
      ) : helper ? (
        <span className="uiField__helper" id={`${safeId}__helper`}>
          {helper}
        </span>
      ) : null}
    </label>
  );
}

export function ComboboxField({
  label,
  helper,
  error,
  required,
  className,
  options,
  value,
  onChange,
  placeholder,
  disabled
}: FieldBaseProps & {
  value: string;
  options: ComboboxOption[];
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
}): JSX.Element {
  const safeId = `field_${label.replace(/\\s+/g, "_").toLowerCase()}`;
  const describedBy = error ? `${safeId}__error` : helper ? `${safeId}__helper` : undefined;
  return (
    <div className={cx("uiField", error && "uiField--error", className)}>
      <span className="uiField__label">
        {label}
        {required ? <span className="uiField__required" aria-hidden="true">*</span> : null}
      </span>
      <div aria-describedby={describedBy}>
        <Combobox value={value} options={options} onChange={onChange} placeholder={placeholder} disabled={disabled} />
      </div>
      {error ? (
        <span className="uiField__error" id={`${safeId}__error`}>
          {error}
        </span>
      ) : helper ? (
        <span className="uiField__helper" id={`${safeId}__helper`}>
          {helper}
        </span>
      ) : null}
    </div>
  );
}
