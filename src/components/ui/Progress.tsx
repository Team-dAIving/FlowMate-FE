import React from 'react';
import { cn } from '../../utils/cn';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  size?: 'sm' | 'md' | 'lg';
  indicatorClassName?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  size = 'md',
  className,
  indicatorClassName,
  ...props
}) => {
  const sizes = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-border/80', sizes[size], className)}
      {...props}
    >
      <div
        className={cn('h-full bg-primary transition-all duration-300 ease-in-out', indicatorClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};
