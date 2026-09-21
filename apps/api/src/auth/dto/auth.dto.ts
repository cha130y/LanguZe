import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Longest value the API accepts for a password, to keep hashing work bounded. */
const MAX_PASSWORD_LENGTH = 128;
const MAX_TOKEN_LENGTH = 512;

export class SignUpDto {
  @ApiProperty({ maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    minLength: 8,
    maxLength: MAX_PASSWORD_LENGTH,
    description: 'At least 8 characters (V2).',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 50,
    description: 'Display name (V12, V19).',
  })
  @IsString()
  @Length(1, 50)
  name: string;

  @ApiProperty({
    description: 'Year of birth; the learner must turn 18 this year (V20).',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  birthYear: number;

  @ApiProperty({
    description:
      'Must be true: accepting the Terms of Use and Privacy Policy (FR-090). False is answered with TERMS_NOT_ACCEPTED.',
  })
  @IsBoolean()
  acceptTerms: boolean;
}

/**
 * Finishing a provider sign-up (FR-090, V20). The same display name and year of
 * birth rules as email sign-up; the Terms are accepted by calling the endpoint at
 * all, so there is no flag to send.
 */
export class AcceptTermsDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 50,
    description:
      'Display name, prefilled from the provider profile (V12, V19).',
  })
  @IsString()
  @Length(1, 50)
  name: string;

  @ApiProperty({
    description: 'Year of birth; the learner must turn 18 this year (V20).',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  birthYear: number;
}

export class SignInDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty()
  @IsString()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string;
}

export class EmailOnlyDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'The token from the verification link.' })
  @IsString()
  @Length(1, MAX_TOKEN_LENGTH)
  token: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'The token from the reset link.' })
  @IsString()
  @Length(1, MAX_TOKEN_LENGTH)
  token: string;

  @ApiProperty({ minLength: 8, maxLength: MAX_PASSWORD_LENGTH })
  @IsString()
  @MinLength(8)
  @MaxLength(MAX_PASSWORD_LENGTH)
  newPassword: string;
}

export class AiAccessDto {
  @ApiProperty()
  available: boolean;

  @ApiPropertyOptional({
    enum: ['NOT_VERIFIED', 'AI_SUSPENDED'],
    nullable: true,
    description: 'Why AI features are unavailable, if they are.',
  })
  reason: 'NOT_VERIFIED' | 'AI_SUSPENDED' | null;
}

/** The signed-in account and what it may do (API design, section 3.2). */
export class MeResponseDto {
  @ApiProperty({
    description: 'The account ID a learner can quote to LanguZe (FR-108).',
  })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Empty for accounts without an email address (D1).',
  })
  email: string | null;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty({
    description: 'Whether photo analysis and the tutor are unlocked (SRS 1.3).',
  })
  verifiedForAi: boolean;

  @ApiProperty({ enum: ['LEARNER', 'ADMIN'] })
  role: 'LEARNER' | 'ADMIN';

  @ApiProperty({
    description:
      'False while a provider sign-up has not accepted the Terms (FR-090).',
  })
  termsAccepted: boolean;

  @ApiProperty({ type: AiAccessDto })
  aiAccess: AiAccessDto;
}

/** A message with nothing to return, kept uniform so the web app can ignore the body. */
export class AcknowledgementDto {
  @ApiProperty({ example: true })
  ok: true;
}
