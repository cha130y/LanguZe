import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import {
  ApiError,
  api,
  type AnswerResult,
  type PracticeSession,
  type Question,
} from '@/lib/api/client';
import { QuestionCard } from './question-card';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => {
  const router = { refresh, push: vi.fn() };
  return { useRouter: () => router };
});

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: { answerQuestion: vi.fn() },
}));

const session = {
  id: 'session-1',
  kind: 'GAME',
  status: 'IN_PROGRESS',
  worldId: 'world-1',
  answeredCount: 2,
  questionCount: 6,
  startedAt: '2026-09-25T04:00:00.000Z',
  summary: null,
} as PracticeSession;

const question: Question = {
  id: 'question-3',
  position: 3,
  photoUrl: 'https://photos.test/photo.jpg?X-Amz-Signature=abc',
  box: { x: 0.2, y: 0.1, width: 0.4, height: 0.25 },
};

const result = (overrides: Partial<AnswerResult> = {}): AnswerResult => ({
  correct: true,
  dontKnow: false,
  alreadyAnswered: false,
  word: {
    english: 'sofa',
    thaiMeaning: 'โซฟา',
    exampleSentence: 'We sit on the sofa.',
  },
  xpAwarded: 10,
  mastery: { before: null, after: 'LEARNING' },
  sessionCompleted: false,
  summary: null,
  ...overrides,
});

beforeEach(() => {
  refresh.mockReset();
  vi.mocked(api.answerQuestion).mockReset().mockResolvedValue(result());
});

test('shows the photo and the box, and asks for the word (FR-031)', () => {
  const { container } = render(
    <QuestionCard session={session} question={question} />,
  );

  expect(screen.getByText('ข้อ 3 จาก 6')).toBeInTheDocument();
  expect(screen.getByLabelText(/ภาษาอังกฤษเรียกว่าอะไร/)).toHaveFocus();
  const box = container.querySelector<HTMLElement>('[aria-hidden="true"]');
  expect(box?.style.left).toBe('20%');
  expect(box?.style.width).toBe('40%');
});

/*
 * S5: the word is checked on the server, so it can never be in the page before
 * the learner answers. This is the test that would notice if it ever were.
 */
test('has no sight of the answer before one is given', () => {
  const { container } = render(
    <QuestionCard session={session} question={question} />,
  );

  expect(container.innerHTML).not.toContain('sofa');
  expect(container.innerHTML).not.toContain('โซฟา');
});

test('sends the typed answer and teaches the word (US-031)', async () => {
  render(<QuestionCard session={session} question={question} />);

  await userEvent.type(screen.getByLabelText(/ภาษาอังกฤษ/), 'sofa');
  await userEvent.click(screen.getByRole('button', { name: 'ตอบ' }));

  expect(api.answerQuestion).toHaveBeenCalledWith('session-1', 'question-3', {
    answer: 'sofa',
  });
  expect(await screen.findByText(/ถูกต้อง \+10 XP/)).toBeInTheDocument();
  expect(screen.getByText('sofa')).toBeInTheDocument();
  expect(screen.getByText('โซฟา')).toBeInTheDocument();
  expect(screen.getByText('We sit on the sofa.')).toBeInTheDocument();
});

/* US-031 criterion 2: a wrong answer still teaches the word. */
test('teaches the word after a wrong answer too', async () => {
  vi.mocked(api.answerQuestion).mockResolvedValue(
    result({
      correct: false,
      xpAwarded: 0,
      mastery: { before: null, after: 'LEARNING' },
    }),
  );
  render(<QuestionCard session={session} question={question} />);

  await userEvent.type(screen.getByLabelText(/ภาษาอังกฤษ/), 'zzz');
  await userEvent.click(screen.getByRole('button', { name: 'ตอบ' }));

  expect(await screen.findByText(/ยังไม่ถูก/)).toBeInTheDocument();
  expect(screen.getByText('sofa')).toBeInTheDocument();
  expect(screen.queryByText(/XP/)).toBeNull();
});

/* US-032: saying so is a choice of its own, not a guess with an empty box. */
test('offers "I don’t know" and sends it as such', async () => {
  vi.mocked(api.answerQuestion).mockResolvedValue(
    result({ correct: false, dontKnow: true, xpAwarded: 0 }),
  );
  render(<QuestionCard session={session} question={question} />);

  await userEvent.click(screen.getByRole('button', { name: 'ไม่ทราบ' }));

  expect(api.answerQuestion).toHaveBeenCalledWith('session-1', 'question-3', {
    dontKnow: true,
  });
  expect(await screen.findByText(/ไม่เป็นไร/)).toBeInTheDocument();
});

test('will not send an empty answer', async () => {
  render(<QuestionCard session={session} question={question} />);

  expect(screen.getByRole('button', { name: 'ตอบ' })).toBeDisabled();
  await userEvent.type(screen.getByLabelText(/ภาษาอังกฤษ/), '   ');
  expect(screen.getByRole('button', { name: 'ตอบ' })).toBeDisabled();
  expect(api.answerQuestion).not.toHaveBeenCalled();
});

test('asks the server for the next question (FR-036)', async () => {
  render(<QuestionCard session={session} question={question} />);

  await userEvent.click(screen.getByRole('button', { name: 'ไม่ทราบ' }));
  await userEvent.click(
    await screen.findByRole('button', { name: 'ข้อต่อไป' }),
  );

  expect(refresh).toHaveBeenCalled();
});

test('offers the summary when that was the last question (US-033)', async () => {
  vi.mocked(api.answerQuestion).mockResolvedValue(
    result({ sessionCompleted: true }),
  );
  render(<QuestionCard session={session} question={question} />);

  await userEvent.click(screen.getByRole('button', { name: 'ไม่ทราบ' }));

  expect(
    await screen.findByRole('button', { name: 'ดูผลสรุป' }),
  ).toBeInTheDocument();
});

test('explains a refusal and keeps the question on screen', async () => {
  vi.mocked(api.answerQuestion).mockRejectedValue(
    new ApiError('SESSION_CLOSED', 409, 'closed'),
  );
  render(<QuestionCard session={session} question={question} />);

  await userEvent.click(screen.getByRole('button', { name: 'ไม่ทราบ' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/เกมนี้ปิดไปแล้ว/);
  expect(screen.getByLabelText(/ภาษาอังกฤษ/)).toBeInTheDocument();
});
