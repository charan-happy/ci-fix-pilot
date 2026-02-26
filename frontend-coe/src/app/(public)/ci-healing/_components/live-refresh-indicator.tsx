'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface LiveRefreshIndicatorProps {
  intervalMs?: number;
}

export function LiveRefreshIndicator({ intervalMs = 6000 }: LiveRefreshIndicatorProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsRefreshing(true);
      router.refresh();

      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, router]);

  return (
    <div className="text-muted-foreground flex items-center gap-2 text-xs">
      <span className={`bg-primary inline-flex h-2.5 w-2.5 rounded-full ${isRefreshing ? 'animate-pulse' : ''}`} />
      <span>Live agent updates every {Math.round(intervalMs / 1000)}s</span>
    </div>
  );
}
