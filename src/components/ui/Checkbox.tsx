'use client';

import { InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  size?: 'sm' | 'md';
}

const sizeClasses: Record<NonNullable<CheckboxProps['size']>, { box: string; icon: string }> = {
  sm: { box: 'h-4 w-4', icon: 'h-3 w-3' },
  md: { box: 'h-5 w-5', icon: 'h-3.5 w-3.5' },
};

export default function Checkbox({
  className = '',
  size = 'sm',
  disabled,
  ...props
}: CheckboxProps) {
  const { box, icon } = sizeClasses[size];

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <input
        type="checkbox"
        disabled={disabled}
        className="peer absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden="true"
        className={`${box} flex items-center justify-center rounded border border-white/20 bg-surface text-ink transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink peer-checked:border-accent peer-checked:bg-accent peer-checked:[&_svg]:opacity-100 peer-disabled:opacity-50`}
      >
        <Check className={`${icon} stroke-[3] opacity-0 transition-opacity`} />
      </span>
    </span>
  );
}
