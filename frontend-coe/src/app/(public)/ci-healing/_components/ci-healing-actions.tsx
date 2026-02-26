'use client';

import { useState, useTransition, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CiHealingActionsProps {
  runId: string;
}

type ActionType = 'approve' | 'deny' | 'abort' | 'human-fix';

export function CiHealingActions({ runId }: CiHealingActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  const trigger = (action: ActionType) => {
    startTransition(async () => {
      setMessage('');

      const response = await fetch('/api/ci-healing/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          runId,
          action,
          note: note.trim() ? note.trim() : undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setMessage(payload.error ?? 'Action failed');
        return;
      }

      setMessage(`Action '${action}' completed.`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <Input
        value={note}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setNote(event.target.value)}
        placeholder="Optional reviewer note"
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={isPending} onClick={() => trigger('approve')}>
          Approve / Merge
        </Button>
        <Button disabled={isPending} variant="destructive" onClick={() => trigger('deny')}>
          Deny
        </Button>
        <Button disabled={isPending} variant="outline" onClick={() => trigger('abort')}>
          Abort
        </Button>
        <Button disabled={isPending} variant="secondary" onClick={() => trigger('human-fix')}>
          Mark Human Fixed
        </Button>
      </div>
      {message ? <p className="text-muted-foreground text-xs">{message}</p> : null}
    </div>
  );
}
