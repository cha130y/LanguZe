import { Injectable } from '@nestjs/common';
import { MailSender, type MailMessage } from './mail-sender.js';

/**
 * Keeps messages in memory instead of sending them, so tests can read what a
 * learner would have received (testing strategy, section 1).
 */
@Injectable()
export class FakeMailSender extends MailSender {
  readonly sent: MailMessage[] = [];

  protected deliver(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  /** The most recent message sent to an address, if any. */
  lastTo(to: string): MailMessage | undefined {
    return this.sent.filter((message) => message.to === to).at(-1);
  }

  clear(): void {
    this.sent.length = 0;
  }
}
