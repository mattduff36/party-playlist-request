'use client';

import { InputHTMLAttributes } from 'react';

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  size?: 'sm' | 'md';
}

const sizeClasses: Record<NonNullable<RadioProps['size']>, { outer: string; inner: string }> = {
  sm: { outer: 'h-4 w-4', inner: 'h-2 w-2' },
  md: { outer: 'h-5 w-5', inner: 'h-2.5 w-2.5' },
};

export default function Radio({
  className = '',
  size = 'sm',
  disabled,
  ...props
}: RadioProps) {
  const { outer, inner } = sizeClasses[size];

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <input
        type="radio"
        disabled={disabled}
        className="peer absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden="true"
        className={`${outer} flex items-center justify-center rounded-full border border-white/20 bg-surface transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink peer-checked:border-accent peer-checked:[&_span]:opacity-100 peer-disabled:opacity-50`}
      >
        <span className={`${inner} rounded-full bg-accent opacity-0 transition-opacity`} />
      </span>
    </span>
  );
}
