import React from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, hoverEffect, children, ...props }) => {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface text-text-primary shadow-subtle p-4',
        hoverEffect && 'transition-all duration-150 hover:border-primary/50 hover:shadow-card cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={cn('flex items-center justify-between pb-3 border-b border-border/60', className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, children, ...props }) => (
  <h4 className={cn('text-sm font-semibold tracking-tight text-text-primary', className)} {...props}>
    {children}
  </h4>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={cn('pt-3', className)} {...props}>
    {children}
  </div>
);
