/**
 * Stable, machine-readable error codes returned in `error.code` (API design, section 4).
 * The web app maps each code to Thai text, so codes must never be renamed once released.
 */
export const ErrorCode = {
  // Generic codes for errors raised by the framework or shared infrastructure.
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_SIGNED_IN: 'NOT_SIGNED_IN',
  FORBIDDEN: 'FORBIDDEN',
  ORIGIN_NOT_ALLOWED: 'ORIGIN_NOT_ALLOWED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Feature codes, introduced by the increments that raise them.
  TERMS_NOT_ACCEPTED: 'TERMS_NOT_ACCEPTED',
  MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  TERMS_PENDING: 'TERMS_PENDING',
  AGE_BELOW_MINIMUM: 'AGE_BELOW_MINIMUM',
  NOT_VERIFIED: 'NOT_VERIFIED',
  AI_SUSPENDED: 'AI_SUSPENDED',
  OWN_ACCOUNT: 'OWN_ACCOUNT',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  WORLD_LIMIT_REACHED: 'WORLD_LIMIT_REACHED',
  WORLD_NOT_READY: 'WORLD_NOT_READY',
  RETRY_NOT_AVAILABLE: 'RETRY_NOT_AVAILABLE',
  LAST_WORD: 'LAST_WORD',
  NOTHING_TO_REVIEW: 'NOTHING_TO_REVIEW',
  SESSION_CLOSED: 'SESSION_CLOSED',
  QUESTION_UNAVAILABLE: 'QUESTION_UNAVAILABLE',
  ACTION_NOT_APPLICABLE: 'ACTION_NOT_APPLICABLE',
  PHOTO_TOO_LARGE: 'PHOTO_TOO_LARGE',
  PHOTO_TYPE_NOT_ALLOWED: 'PHOTO_TYPE_NOT_ALLOWED',
  DAILY_ANALYSIS_LIMIT: 'DAILY_ANALYSIS_LIMIT',
  DAILY_TUTOR_LIMIT: 'DAILY_TUTOR_LIMIT',
  AI_PROVIDER_UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** The code used for an HTTP status when an error carries no code of its own. */
export function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case 401:
      return ErrorCode.NOT_SIGNED_IN;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 409:
      return ErrorCode.CONFLICT;
    case 413:
      return ErrorCode.PAYLOAD_TOO_LARGE;
    case 415:
      return ErrorCode.UNSUPPORTED_MEDIA_TYPE;
    case 429:
      return ErrorCode.RATE_LIMITED;
    case 503:
      return ErrorCode.SERVICE_UNAVAILABLE;
    default:
      return status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST;
  }
}
