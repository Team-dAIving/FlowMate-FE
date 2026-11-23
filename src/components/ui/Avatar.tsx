import React from 'react';
import { cn } from '../../utils/cn';

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name = 'User', size = 'sm', className }) => {
  const sizes = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const getInitials = (str: string) => {
    return str.slice(0, 2).toUpperCase();
  };

  // Server data: only https images (no data:/javascript:/http), and don't send the page URL along
  const safeSrc = src && /^https:\/\//i.test(src) ? src : undefined;

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 rounded-full font-medium overflow-hidden border border-border select-none bg-primary-light text-primary',
        sizes[size],
        className
      )}
      title={name}
    >
      {safeSrc ? (
        <img src={safeSrc} alt={name} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
};
