import { isPlaceholderAddress } from '../platform/email/placeholder-address.js';

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain-text body, for mail clients that do not show HTML. */
  text: string;
  html: string;
}

/**
 * Sends an email. The abstract class is also the injection token, so tests can
 * provide {@link FakeMailSender} instead of talking to a mail server.
 *
 * `send` is concrete and `deliver` is what an implementation writes, so the rule
 * that nothing is ever sent to a placeholder address holds for every sender and
 * every caller (ADR-0003). Putting it here rather than at each call site means a
 * new kind of email cannot forget it.
 */
export abstract class MailSender {
  async send(message: MailMessage): Promise<void> {
    if (isPlaceholderAddress(message.to)) return;
    await this.deliver(message);
  }

  protected abstract deliver(message: MailMessage): Promise<void>;
}
