import { FakeMailSender } from './fake-mail-sender.js';

const message = (to: string) => ({
  to,
  subject: 'ยืนยันอีเมลของคุณ',
  text: 'link',
  html: '<a>link</a>',
});

describe('MailSender', () => {
  /*
   * Accounts from a provider that shares no email get a placeholder address (D1).
   * Better Auth sends a verification email on every sign-up, so without this rule
   * each LINE or Facebook sign-up would try to email a domain that cannot exist.
   */
  it('sends nothing to a placeholder address', async () => {
    const mail = new FakeMailSender();

    await mail.send(message('0192f0c1@languze.invalid'));

    expect(mail.sent).toHaveLength(0);
  });

  it('still sends to a real address', async () => {
    const mail = new FakeMailSender();

    await mail.send(message('nok@example.com'));

    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toBe('nok@example.com');
  });
});
