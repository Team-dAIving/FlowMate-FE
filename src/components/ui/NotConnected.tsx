import React from 'react';
import { Construction } from 'lucide-react';
import { cn } from '../../utils/cn';

/** Shown where a feature's backend API doesn't exist yet (deployed service only). */
export const NotConnected: React.FC<{ feature: string; className?: string }> = ({ feature, className }) => (
  <div
    role="status"
    className={cn(
      'flex items-start gap-2.5 p-3 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-200',
      className
    )}
  >
    <Construction className="h-4 w-4 shrink-0 mt-0.5" />
    <div>
      <div className="font-semibold">{feature} 기능은 준비 중입니다</div>
      <div className="mt-0.5 opacity-90">서버와 연결되면 여기에서 바로 사용할 수 있습니다.</div>
    </div>
  </div>
);
