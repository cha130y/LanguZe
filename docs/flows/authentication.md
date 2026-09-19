# Authentication flow

- **Use cases:** UC-001–UC-005
- **Requirements:** FR-001–FR-009, FR-090, FR-105, NFR-005, NFR-009, NFR-018, NFR-019
- **Decision:** Better Auth runs inside the API (P1).

## 1. Email sign-up and verification (UC-001)

```mermaid
sequenceDiagram
  autonumber
  actor V as Visitor
  participant W as Web
  participant A as API
  participant D as Database
  participant E as Email service
  V->>W: Enter email, display name, password, year of birth, accept Terms
  W->>A: Sign up
  A->>A: Check input, age, and rate limit
  A->>D: Look up the email address
  alt Address already has an account
    A-->>W: Refused, address already registered
    W-->>V: Offer sign-in or password reset
  else New address
    A->>D: Create account (email not verified, password hash, Terms accepted at) and session
    A-->>W: Signed in with a session cookie
    A->>E: Send verification email with a single-use link
    W-->>V: App open, AI features locked until verified
  end
  V->>W: Open verification link
  W->>A: Verify the link token
  A->>D: Mark email verified, use up the token
  A-->>W: Verified
  W-->>V: AI features available
```

- The email address is unique in the database, so two sign-ups with the same address at the same moment cannot both succeed; the second gets the "already registered" answer (FR-001).
- Sign-up with any method needs a year of birth by which the visitor turns 18 this year or earlier (FR-090, V20). Otherwise nothing is created, and a cookie stops the same browser from trying another year for 24 hours.
- The verification email is sent after the account is saved (step 9 follows step 7). If sending fails, the account stays and the learner can ask for a new email (UC-001 extension 4a).

## 2. Sign-in with Google, LINE, or Facebook (UC-003)

```mermaid
sequenceDiagram
  autonumber
  actor V as Visitor
  participant W as Web
  participant A as API
  participant I as Identity provider
  participant D as Database
  V->>W: Choose Google, LINE, or Facebook
  W->>A: Start provider sign-in
  A-->>V: Redirect to the provider with a one-time state value
  V->>I: Sign in and allow access
  I-->>A: Redirect back with an authorization code
  A->>A: Check the state value
  A->>I: Exchange the code for the profile
  I-->>A: Provider user ID, name, email and whether it is verified
  A->>D: Resolve the account (decision below)
  alt Existing account, not suspended
    A->>D: Create session
    A-->>W: Signed in
  else Existing account, suspended
    A-->>W: Refused, show suspension and contact address
  else New account needed
    A->>D: Keep the provider identity as a pending sign-up for 15 minutes
    A-->>W: Show Terms step with display name prefilled
    V->>W: Accept Terms, confirm display name, give year of birth
    W->>A: Complete sign-up
    A->>D: Create account, link provider sign-in, record acceptance, create session
    A-->>W: Signed in
  end
```

How the API resolves the account at step 9 (FR-009):

```mermaid
flowchart TD
  P["Provider profile received"] --> Q1{"Is this provider sign-in already linked to an account?"}
  Q1 -- yes --> USE["Use that account"]
  Q1 -- no --> Q2{"Did the provider supply a verified email?"}
  Q2 -- no --> NEW0["New account without email, after the Terms step"]
  Q2 -- yes --> Q3{"Does an account use this email?"}
  Q3 -- no --> NEW1["New account with this email, after the Terms step"]
  Q3 -- yes --> Q4{"Is that account's email verified?"}
  Q4 -- yes --> LINK["Link the provider sign-in to that account"]
  Q4 -- no --> LINKU["Link, mark the email verified, remove the password (U6)"]
```

- An account counts as verified for AI features when its email is verified or it has any Google, LINE, or Facebook sign-in (SRS 1.3, V13, V14).
- The pending sign-up (step 13) is not a usable account: no session exists until the visitor accepts the Terms, and declining or waiting more than 15 minutes leaves nothing behind (FR-090, U5). The implementation may store it as a locked account that is removed on decline or expiry, as long as it cannot be used before acceptance.
- In the LINE and Facebook in-app browsers, the sign-in page offers only methods that work there, plus a way to open LanguZe in the default browser (NFR-018).

## 3. Authorizing every request

```mermaid
sequenceDiagram
  autonumber
  participant W as Web
  participant A as API
  participant D as Database
  W->>A: Request with session cookie
  A->>D: Load session, account status, role, verification, AI suspension
  alt No valid session
    A-->>W: Not signed in
  else Account suspended
    A-->>W: Refused, account suspended
  else Admin request and role is not ADMIN
    A-->>W: Refused
  else AI request and not verified or under AI suspension
    A-->>W: Refused with the reason
  else Allowed
    A->>A: Run the request for this learner only
    A-->>W: Result
  end
```

- Account status and role are read from the database on every request, not from data stored in the cookie. Removing the admin role or suspending an account therefore takes effect on the next request (NFR-019). Session caching in the cookie, which Better Auth offers, stays off.
- Suspending an account also deletes its sessions ([Moderation, section 3](moderation.md#3-admin-action-uc-103)); the status check above is a second line of defense.

## 4. Password reset (UC-004)

```mermaid
sequenceDiagram
  autonumber
  actor L as Learner
  participant W as Web
  participant A as API
  participant D as Database
  participant E as Email service
  L->>W: Enter email address
  W->>A: Request password reset
  A->>A: Check rate limit
  A-->>W: Same message in every case
  opt Account with a password exists for this address
    A->>D: Store a single-use reset token
    A->>E: Send reset link
  end
  L->>W: Open link, enter new password
  W->>A: Reset password with the token
  A->>D: One transaction: check token, save new password hash, use up token, delete all sessions
  A-->>W: Password changed, sign in again
```

- The API answers before looking up the account and sending the email (step 4 comes first), so neither the message nor the response time reveals whether the address has an account (FR-005).

## 5. Sign-out and account deletion (UC-002, UC-005)

Signing out deletes the current session. Account deletion:

```mermaid
sequenceDiagram
  autonumber
  actor L as Learner
  participant W as Web
  participant A as API
  participant D as Database
  participant S as Photo storage
  L->>W: Delete account and confirm
  W->>A: Delete account
  A->>D: One transaction: delete account, learning data, conversation, block records, suspensions, sign-ins, sessions, and record the photo keys for cleanup
  A-->>W: Deleted, signed out
  A->>S: Delete the photos
  alt Deletion fails
    A->>A: Keep the cleanup records and retry until done, within 24 hours
  end
```

- Admin audit entries are kept with the account identifier only (FR-106).
- The same deletion runs when an admin deletes an account ([Moderation, section 3](moderation.md#3-admin-action-uc-103)).

## 6. Points for the data model and API design

- Email addresses are unique across accounts; accounts without an email address are allowed (FR-009).
- An account records when it accepted the Terms of Use and Privacy Policy.
- Sessions live in the database so they can be deleted: on sign-out, password reset, account suspension, and account deletion.
- Verification and reset tokens are single-use and expire.
- Photo deletions are recorded as cleanup records in the same transaction as the deletion that causes them, and a retry task works through them (NFR-009).
