import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldWrapperProps {
  label?: string;
  error?: string;
  children: React.ReactNode;
}

export function FieldWrapper({ label, error, children }: FieldWrapperProps) {
  return (
    <div>
      {label && <label className="field-label">{label}</label>}
      {children}
      {error && <div className="field-error">⚠ {error}</div>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...rest }: InputProps) {
  return (
    <FieldWrapper label={label} error={error}>
      <input className={`field-input ${error ? 'error' : ''} ${className}`.trim()} {...rest} />
    </FieldWrapper>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', ...rest }: TextareaProps) {
  return (
    <FieldWrapper label={label} error={error}>
      <textarea className={`field-input ${error ? 'error' : ''} ${className}`.trim()} {...rest} />
    </FieldWrapper>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className = '', children, ...rest }: SelectProps) {
  return (
    <FieldWrapper label={label} error={error}>
      <select className={`field-input ${error ? 'error' : ''} ${className}`.trim()} {...rest}>
        {children}
      </select>
    </FieldWrapper>
  );
}
