export interface MailMessage {
  to: string;
  subject: string;
  /** Plain-text body, for mail clients that do not show HTML. */
  text: string;
  html: string;
}

/**
 * Accounts that sign in with a provider that shares no email address get a
 * placeholder on the reserved `.invalid` domain, which exists only to satisfy the
 * column (D1). RFC 2606 reserves it precisely so it can never resolve.
 */
const PLACEHOLDER_DOMAIN_SUFFIX = '.invalid';

export const isPlaceholderAddress = (address: string): boolean =>
  address.toLowerCase().endsWith(PLACEHOLDER_DOMAIN_SUFFIX);

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
