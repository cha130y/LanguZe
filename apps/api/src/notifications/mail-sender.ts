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
 */
export abstract class MailSender {
  abstract send(message: MailMessage): Promise<void>;
}
