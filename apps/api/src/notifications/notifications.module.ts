import { Module } from '@nestjs/common';
import { MailSender } from './mail-sender.js';
import { SmtpMailSender } from './smtp-mail-sender.js';

/** Outgoing email. Tests replace {@link MailSender} with the fake sender. */
@Module({
  providers: [{ provide: MailSender, useClass: SmtpMailSender }],
  exports: [MailSender],
})
export class NotificationsModule {}
