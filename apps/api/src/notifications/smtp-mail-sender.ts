import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { MailSender, type MailMessage } from './mail-sender.js';

/**
 * Sends email over SMTP: Maildev locally, an email provider in production.
 * Recipients and subjects are logged, message bodies are not (NFR-008).
 */
@Injectable()
export class SmtpMailSender extends MailSender {
  private readonly logger = new Logger(SmtpMailSender.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    this.from = config.get('MAIL_FROM', { infer: true });
    this.transporter = createTransport({
      host: config.get('MAIL_HOST', { infer: true }),
      port: config.get('MAIL_PORT', { infer: true }),
      // Maildev and most providers upgrade with STARTTLS on their submission port.
      secure: false,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ ...message, from: this.from });
    this.logger.log(`Sent "${message.subject}"`);
  }
}
