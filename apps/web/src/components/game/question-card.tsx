'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { WorldPhoto } from '@/components/worlds/world-photo';
import {
  api,
  type AnswerResult,
  type PracticeSession,
  type Question,
} from '@/lib/api/client';
import { messageForError } from '@/lib/api/error-messages';

/** The longest answer the API accepts (V19); the input says so too. */
const MAX_ANSWER = 100;

const MASTERY_TEXT: Record<string, string> = {
  LEARNING: 'กำลังเรียน',
  FAMILIAR: 'เริ่มคุ้น',
  MASTERED: 'จำได้แล้ว',
};

/**
 * One question and what comes of answering it (FR-031, FR-033, US-031, US-032).
 *
 * The word is not here to be found: the page is given a photo and a box, and the
 * server decides whether the answer names the object (S5). That is also why the
 * feedback below can only appear once an answer has been sent.
 *
 * The form is a plain one rather than React Hook Form: there is a single field
 * whose only rule is a length the input already enforces, and the answer that
 * matters is judged on the server. It takes focus on sight, because typing a word
 * is the only thing this page is for.
 */
export function QuestionCard({
  session,
  question,
}: {
  session: PracticeSession;
  question: Question;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (body: { answer?: string; dontKnow?: boolean }) => {
    setSending(true);
    setError(null);
    try {
      setResult(await api.answerQuestion(session.id, question.id, body));
    } catch (caught) {
      setError(messageForError(caught));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        ข้อ {question.position} จาก {session.questionCount}
      </p>

      <WorldPhoto
        photoUrl={question.photoUrl}
        alt="รูปภาพของคุณ โดยมีกรอบล้อมรอบสิ่งของที่ต้องตอบ"
      >
        {/*
         * One box, drawn as a shape rather than a colour: a white outline inside a
         * dark one reads on any photo, and on a screen where colour is lost
         * (NFR-012, US-030 criterion 4).
         */}
        <span
          aria-hidden
          className="pointer-events-none absolute rounded-xl border-4 border-white ring-3 ring-black/70 ring-inset"
          style={{
            left: `${question.box.x * 100}%`,
            top: `${question.box.y * 100}%`,
            width: `${question.box.width * 100}%`,
            height: `${question.box.height * 100}%`,
          }}
        />
      </WorldPhoto>

      {result ? (
        <Feedback
          result={result}
          onNext={() => {
            // The server holds where the session has got to, so the page asks again.
            router.refresh();
          }}
        />
      ) : (
        <form
          className="grid gap-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void send({ answer });
          }}
        >
          <label htmlFor="answer" className="font-semibold">
            สิ่งของในกรอบนี้ ภาษาอังกฤษเรียกว่าอะไร?
          </label>
          <input
            id="answer"
            name="answer"
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={MAX_ANSWER}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            className="rounded-xl border border-border bg-input/30 p-3 text-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="grid gap-3 sm:flex">
            <Button
              type="submit"
              variant="cta"
              size="xl"
              className="sm:flex-1"
              disabled={sending || answer.trim() === ''}
            >
              {sending ? 'กำลังตรวจ…' : 'ตอบ'}
            </Button>
            {/* US-032: saying so is a real choice, not a punishment for guessing. */}
            <Button
              type="button"
              variant="outline"
              size="xl"
              className="sm:flex-1"
              disabled={sending}
              onClick={() => void send({ dontKnow: true })}
            >
              ไม่ทราบ
            </Button>
          </div>
        </form>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/**
 * What the answer was worth (FR-033). Right or wrong, the word is taught here:
 * an answer the learner never sees the truth of teaches them nothing.
 */
function Feedback({
  result,
  onNext,
}: {
  result: AnswerResult;
  onNext: () => void;
}) {
  return (
    <div
      role="status"
      className={`glass-panel grid gap-3 rounded-3xl p-6 ${
        result.correct ? 'ring-2 ring-primary/40' : ''
      }`}
    >
      {/* Not colour alone: the mark and the words both say which it was. */}
      <p className="flex items-center gap-2 text-lg font-bold">
        <span aria-hidden>{result.correct ? '✓' : '✕'}</span>
        {result.correct
          ? `ถูกต้อง +${result.xpAwarded} XP`
          : result.dontKnow
            ? 'ไม่เป็นไร คำนี้คือ'
            : 'ยังไม่ถูก คำที่ถูกคือ'}
      </p>

      <div className="grid gap-1">
        <p className="text-xl font-bold">{result.word.english}</p>
        <p className="text-sm">{result.word.thaiMeaning}</p>
        <p className="text-sm text-muted-foreground italic">
          {result.word.exampleSentence}
        </p>
      </div>

      {result.mastery.before !== result.mastery.after ? (
        <p className="text-sm text-muted-foreground">
          ระดับความจำของคำนี้: {MASTERY_TEXT[result.mastery.after]}
        </p>
      ) : null}

      <Button
        type="button"
        variant="cta"
        size="xl"
        className="mt-1"
        onClick={onNext}
      >
        {result.sessionCompleted ? 'ดูผลสรุป' : 'ข้อต่อไป'}
      </Button>
    </div>
  );
}
