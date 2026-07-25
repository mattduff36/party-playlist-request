import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  tone?: 'accent' | 'muted' | 'success' | 'error' | 'spotify';
  className?: string;
}

const toneClasses: Record<NonNullable<BadgeProps['tone']>, string> = {
  accent: 'bg-accent/15 text-accent border-accent/30',
  muted: 'bg-white/5 text-muted border-white/10',
  success: 'bg-success/15 text-success border-success/30',
  error: 'bg-error/15 text-error border-error/30',
  spotify: 'bg-[#1DB954]/15 text-[#1DB954] border-[#1DB954]/30',
};

export default function Badge({ children, tone = 'accent', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
