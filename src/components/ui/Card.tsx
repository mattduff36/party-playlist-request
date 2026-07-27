import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}

interface CardSectionProps {
  children: ReactNode;
  className?: string;
}

/** Interaction / grouping surface — use only when it aids understanding */
export default function Card({ children, className = '', as: Tag = 'div' }: CardProps) {
  return (
    <Tag
      className={`rounded-xl border border-white/10 bg-elevated/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ children, className = '' }: CardSectionProps) {
  return <div className={`flex flex-col gap-1.5 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: CardSectionProps) {
  return <h3 className={`font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
}

export function CardContent({ children, className = '' }: CardSectionProps) {
  return <div className={className}>{children}</div>;
}

export { Card };
