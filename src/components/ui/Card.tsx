import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
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
