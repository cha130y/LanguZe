import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NodeEnv,
  type EnvironmentVariables,
} from '../config/env.validation.js';
import { MailSender } from '../notifications/mail-sender.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import {
  passwordResetEmail,
  verificationEmail,
} from '../notifications/templates/account-emails.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthController, MeController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AUTH } from './auth.tokens.js';
import { createAuth } from './create-auth.js';
import { SessionGuard } from './session.guard.js';

const mailLogger = new Logger('AccountEmails');

/**
 * Accounts and sessions (ADR-0003). A failed email never fails the request that
 * triggered it: the learner can ask for a new one (UC-001 extension 4a).
 */
@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [AuthController, MeController],
  providers: [
    {
      provide: AUTH,
      inject: [ConfigService, PrismaService, MailSender],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
        prisma: PrismaService,
        mail: MailSender,
      ) => {
        const send = async (message: ReturnType<typeof verificationEmail>) => {
          try {
            await mail.send(message);
          } catch (error) {
            mailLogger.error(
              `Could not send "${message.subject}"`,
              error instanceof Error ? error.stack : String(error),
            );
          }
        };

        return createAuth({
          prisma,
          secret: config.get('AUTH_SECRET', { infer: true }),
          baseURL: config.get('AUTH_URL', { infer: true }),
          webOrigin: config.get('WEB_ORIGIN', { infer: true }),
          isProduction:
            config.get('NODE_ENV', { infer: true }) === NodeEnv.Production,
          sendVerificationEmail: (to, url) => send(verificationEmail(to, url)),
          sendPasswordResetEmail: (to, url) =>
            send(passwordResetEmail(to, url)),
        });
      },
    },
    AuthService,
    SessionGuard,
  ],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
