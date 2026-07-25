'use client';

import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export default function Input({ label, hint, className = '', id, ...props }: InputProps) {
  const inputId = id || props.name;
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-bone">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={`w-full rounded-lg border border-white/10 bg-elevated px-3 py-2.5 text-base text-bone placeholder:text-faint outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20 disabled:opacity-50 ${className}`}
        {...props}
      />
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
