'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { api, type PracticeSession } from '@/lib/api/client';
import { messageForError } from '@/lib/api/error-messages';

/**
 * Getting into a game (US-030, US-034).
 *
 * A game left unfinished is offered back before a new one, because starting a new
 * one closes it without a summary (FR-036) — that has to be the deliberate choice,
 * not the one that happens by pressing the obvious button.
 */
export function PlayActions({
  worldId,
  openGame,
}: {
  worldId: string;
  openGame: PracticeSession | null;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const session = await api.startGame(worldId);
      router.push(`/sessions/${session.id}`);
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
      setStarting(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:flex">
        {openGame ? (
          <Link
            href={`/sessions/${openGame.id}`}
            className={`${buttonVariants({ variant: 'cta', size: 'xl' })} sm:flex-1`}
          >
            เล่นต่อ (ข้อ {openGame.answeredCount + 1} จาก{' '}
            {openGame.questionCount})
          </Link>
        ) : null}

        <Button
          type="button"
          variant={openGame ? 'outline' : 'cta'}
          size="xl"
          className="sm:flex-1"
          disabled={starting}
          onClick={() => void start()}
        >
          {starting
            ? 'กำลังเริ่ม…'
            : openGame
              ? 'เริ่มเกมใหม่'
              : 'เริ่มเล่นเกม'}
        </Button>
      </div>

      {openGame ? (
        <p className="text-xs text-muted-foreground">
          การเริ่มเกมใหม่จะปิดเกมที่ค้างอยู่
          และคำตอบที่ตอบไปแล้วจะยังถูกบันทึกไว้
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
