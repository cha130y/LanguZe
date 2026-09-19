# LanguZe — User Stories

- **Document status:** Draft v0.5 — questions raised while writing, and their decisions, are in [Appendix A](#appendix-a-questions-raised-while-writing-the-stories)
- **Date:** 2026-09-19
- **Release covered:** Release 1.0
- **Source:** [SRS](SRS.md) v0.10 and [PRD](PRD.md) v0.7
- **Next documents:** use cases (`UC-xxx`) → process flows

## 1. Introduction

### 1.1 Purpose

This document describes Release 1.0 as user stories: what each kind of user wants to do, and how we will know it works. The SRS remains the source of exact rules. Each story names the requirements it delivers, and its acceptance criteria are the starting point for tests.

### 1.2 How to read a story

- **Story:** _As a (role), I want (capability), so that (benefit)._
- **Acceptance criteria:** numbered scenarios written as **Given** (situation), **when** (action), **then** (observable result). Each scenario should become at least one automated test.
- **Requirements:** the SRS IDs the story delivers. If a story and the SRS disagree, the SRS wins and the story is corrected.
- Story IDs follow the SRS section numbering: `US-001`–`US-009` for accounts (SRS 3.1), `US-010`–`US-019` for worlds (SRS 3.2), and so on. IDs are stable; removed stories are marked as removed rather than renumbered.
- Every story is in Release 1.0 scope. Build order is decided during planning, after the architecture and data model.
- Questions found while writing the stories are recorded, with their decisions, in [Appendix A](#appendix-a-questions-raised-while-writing-the-stories); the decisions are part of the SRS.

### 1.3 Roles

| Role             | Who                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| Visitor          | Someone without an account, or not signed in.                                                                        |
| Learner          | A signed-in account holder (SRS 2.2).                                                                                |
| Verified learner | A learner who can use AI features (SRS 1.3).                                                                         |
| Admin            | A learner with the admin role, moderating in the admin area (SRS 3.11).                                              |
| Operator         | The person who deploys and runs LanguZe. Works through deployment configuration and scripts, not through the app UI. |

## 2. Definition of Done

A story is done when its acceptance criteria pass and all of the following hold. These come from the non-functional requirements and apply to every story, so they are not repeated in each one.

- **Authorization:** every request is authorized on the server. A learner can never read or change another learner's data, including by requesting another learner's resource directly (FR-008, NFR-004).
- **Validation:** input is validated at the API boundary; uploaded files and AI output are untrusted (NFR-007).
- **Secrets:** secrets and provider credentials never reach the browser or the logs; production traffic uses HTTPS (NFR-006).
- **Interface:** interface text is in Thai (NFR-013); pages work from 360 px wide and in the environments of SRS 2.3, including the LINE and Facebook in-app browsers (NFR-014).
- **Accessibility:** keyboard operable, visible focus, labelled inputs, sufficient contrast (NFR-012).
- **States:** loading, error, and empty states are designed, not left blank.
- **Privacy and logging:** no passwords, session tokens, photos, or tutor message text in logs; errors are logged with a request identifier (NFR-008, NFR-016).
- **Abuse protection:** the endpoints listed in NFR-005 are rate-limited.
- **Performance:** non-AI API requests meet NFR-002.
- **Tests:** acceptance criteria are covered by automated tests at the lowest level that proves them (unit, API e2e, or web). AI behavior also has evaluation cases (AIR-008).
- **Pipeline and docs:** CI passes (NFR-015), and documentation affected by the change is updated.

## 3. Core journey

The PRD release criterion is that a new learner completes this journey in production without help (PRD section 7). It is also the main end-to-end test.

| Step                           | Stories                        |
| ------------------------------ | ------------------------------ |
| 1. Sign up and verify          | US-001 and US-002, or US-004   |
| 2. Create a world              | US-010                         |
| 3. Get vocabulary from a photo | US-020                         |
| 4. Remove wrong words          | US-022                         |
| 5. Play Identify               | US-030, US-031, US-032, US-033 |
| 6. Mastery and mistakes update | US-040, US-042                 |
| 7. Review weak words           | US-050                         |
| 8. Ask the tutor               | US-070, US-071                 |

## 4. Stories

### 4.1 Accounts and access (PRD F1, SRS 3.1)

#### US-001 Sign up with email

As a **visitor**, I want to create an account with my email address and a password, so that my worlds and progress are kept in my own account.

1. **Given** I am on the sign-up page, **when** I enter an email address, a display name, a password of at least 8 characters, and my year of birth, accept the Terms of Use and Privacy Policy, and submit, **then** my account is created, I am signed in, and a verification email is sent to me.
2. **Given** I have not accepted the Terms of Use and Privacy Policy, **when** I submit, **then** no account is created and I am asked to accept them.
3. **Given** my password has fewer than 8 characters, **when** I submit, **then** no account is created and I see the password rule.
4. **Given** my year of birth means I do not turn 18 this year, **when** I submit, **then** no account is created, I am told that LanguZe is for adults, and this browser cannot try again with another year for 24 hours.
5. **Given** the email address already has an account, **when** I submit, **then** no account is created, and I am told so and offered sign-in and password reset.
6. **Given** I have not verified my email yet, **when** I use LanguZe, **then** I can use every feature except photo analysis and the AI tutor (US-008).

**Requirements:** FR-001, FR-004, FR-006, FR-090, NFR-005

#### US-002 Verify my email address

As a **learner who signed up with email**, I want to verify my email address, so that I can use photo analysis and the AI tutor.

1. **Given** I received the verification email, **when** I open its link, **then** my email address is marked as verified and AI features become available to me.
2. **Given** I cannot find the verification email, **when** I ask for a new one, **then** a new verification email is sent.
3. **Given** I keep asking for new verification emails, **when** I exceed the rate limit, **then** I am asked to wait before trying again.

**Requirements:** FR-004, NFR-005

#### US-003 Sign in and sign out with email

As a **learner**, I want to sign in with my email and password and sign out when I am done, so that only I can use my account.

1. **Given** I have an account with a password, **when** I enter the correct email and password, **then** I am signed in.
2. **Given** I enter a wrong email or password, **when** I submit, **then** I am not signed in and I see that the email or password is incorrect.
3. **Given** I am signed in, **when** I sign out, **then** my session on this device ends and pages with my data ask me to sign in again.
4. **Given** an admin has suspended my account, **when** I try to sign in, **then** I am not signed in, and I see that my account is suspended and how to contact LanguZe.

**Requirements:** FR-002, FR-099, FR-105, NFR-005

#### US-004 Sign up or sign in with Google, LINE, or Facebook

As a **visitor**, I want to sign in with my Google, LINE, or Facebook account, so that I do not need another password.

1. **Given** I use a provider for the first time, **when** I finish the provider's sign-in, accept the Terms of Use and Privacy Policy, confirm my display name (prefilled from the provider profile), and give my year of birth, **then** a LanguZe account is created and treated as verified.
2. **Given** I use a provider for the first time, **when** I decline the Terms of Use, **then** no account is created.
3. **Given** I use a provider for the first time, **when** my year of birth means I do not turn 18 this year, **then** no account is created and I am told that LanguZe is for adults.
4. **Given** I have signed in with this provider before, **when** I sign in with it again, **then** I am signed in to the same account.
5. **Given** the provider supplies a verified email address that matches the verified email of an existing account, **when** I sign in, **then** the sign-in is linked to that account.
6. **Given** the provider supplies a verified email address that matches an account whose email is not verified, **when** I sign in, **then** the sign-in is linked to that account, the email becomes verified, and the account's password is removed.
7. **Given** I cancel at the provider or the provider refuses the sign-in, **when** I return to LanguZe, **then** no account is created and I can choose another method.
8. **Given** an admin has suspended my account, **when** I sign in with a provider, **then** I am treated as in US-003 criterion 4.

**Requirements:** FR-003, FR-009, FR-090, FR-105

#### US-005 Use LanguZe without an email address

As a **learner who signs in with LINE or Facebook**, I want LanguZe to work even when my account shares no email address, so that my provider's settings do not block me.

1. **Given** LINE or Facebook supplies no email address, **when** I sign in, **then** my account works and is treated as verified (V13, V14).
2. **Given** my account has no email address, **when** I use LanguZe, **then** I am not offered password reset and I receive no email.
3. **Given** the provider supplies no verified email address, or one that matches no existing account, **when** I sign in, **then** a separate account is used; it is not linked to my other accounts.

**Requirements:** FR-003, FR-009

#### US-006 Sign in from the LINE or Facebook app

As a **visitor who opened a LanguZe link inside LINE or Facebook**, I want to sign in without getting stuck, so that I can start learning from the link I was sent.

1. **Given** I am in the LINE or Facebook in-app browser, **when** I open the sign-in page, **then** I can sign in with the methods that work there.
2. **Given** a sign-in method does not work in the in-app browser (Google often blocks its sign-in there), **when** I open the sign-in page, **then** I am offered the other methods and a way to open LanguZe in my device's default browser.

**Requirements:** NFR-014, NFR-018

#### US-007 Reset a forgotten password

As a **learner with a password**, I want to reset a forgotten password by email, so that I can get back into my account.

1. **Given** I enter an email address on the reset page, **when** I submit, **then** I see the same message whether or not the address has an account.
2. **Given** the address belongs to an account with a password, **when** I submit, **then** a reset link is sent to it.
3. **Given** the address belongs to an account without a password (Google, LINE, or Facebook only), **when** I submit, **then** I see the same message and no reset link is sent.
4. **Given** I open a valid reset link, **when** I enter a new password of at least 8 characters, **then** my password is changed and I can sign in with it.
5. **Given** I reset my password, **when** the change completes, **then** all my existing sessions end, so every device must sign in again with the new password.

**Requirements:** FR-005, FR-009, NFR-005

#### US-008 Learn how to unlock AI features

As an **unverified learner**, I want to know why I cannot create a world or use the tutor and how to fix it, so that I can unlock AI features.

1. **Given** my account is not verified, **when** I try to create a world or open the AI tutor, **then** I see that my account needs verification and I can request a new verification email.
2. **Given** my account is not verified, **when** a photo analysis or tutor request reaches the API directly, **then** it is refused.

**Requirements:** FR-006, NFR-004

#### US-009 Delete my account

As a **learner**, I want to delete my account and all my data, so that LanguZe no longer keeps anything about me.

1. **Given** I am signed in, **when** I choose to delete my account and confirm explicitly, **then** my account and all my data (worlds, photos, vocabulary, attempts, mastery, XP, tutor conversation, block records, and AI suspensions) are deleted, my Google, LINE, and Facebook sign-ins are removed, and I am signed out.
2. **Given** my account was deleted, **then** my photos are removed from storage within 24 hours.
3. **Given** I start deleting my account, **when** I cancel instead of confirming, **then** nothing is deleted.
4. **Given** my account was deleted, **when** I sign in again with the same Google, LINE, or Facebook account, **then** a new, empty account is created.
5. **Given** an admin acted on my account before, **when** my account is deleted, **then** the admin audit entries keep only my account identifier.

**Requirements:** FR-007, FR-106, NFR-009

### 4.2 Worlds and photos (PRD F2, SRS 3.2)

#### US-010 Create a world from a photo

As a **verified learner**, I want to name a place and upload a photo of it, so that I can learn the English words for things in my own surroundings.

1. **Given** I am verified, not under an AI suspension, have fewer than 20 worlds, and have analyses left today, **when** I enter a name of 1–50 characters and upload a JPEG, PNG, or WebP photo of up to 10 MB, **then** the world is created and its analysis starts (US-020).
2. **Given** I am on a phone, **when** I add a photo, **then** I can take one with the camera or pick one from my photos.
3. **Given** the file is not really a JPEG, PNG, or WebP image (checked from its content) or is larger than 10 MB, **when** I upload it, **then** it is rejected with the reason and no world is created.
4. **Given** the name is empty or longer than 50 characters, **when** I submit, **then** I see the rule and no world is created.
5. **Given** I already have 20 worlds, **when** I try to create another, **then** I see the limit and that deleting a world frees a place.
6. **Given** I have no analyses left today, counting analyses still in progress as used, **when** I try to create a world, **then** I see that the limit is reached and when it resets.
7. **Given** my AI features are suspended, **when** I try to create a world, **then** I see why and until when (US-092).
8. **Given** my photo contains metadata such as the location where it was taken, **when** it is stored, **then** the metadata is removed, the photo is upright, and its longer side is at most 2,048 pixels.

**Requirements:** FR-010, FR-011, FR-012, FR-017, FR-020, FR-080, FR-096, NFR-005, NFR-007, NFR-014

#### US-011 See my worlds

As a **learner**, I want to see all my worlds at a glance, so that I can choose where to practise.

1. **Given** I have worlds, **when** I open My Worlds, **then** each world shows its name, photo thumbnail, analysis status, word count, and number of mastered words.
2. **Given** a world was `ANALYZING` when I left, **when** I come back later, **then** I see its current status.
3. **Given** I have no worlds, **when** I open My Worlds, **then** I see how to create my first world, or how to verify my account first if I am not verified.
4. **Given** someone else has the address of one of my photos, **when** they request it, **then** it is refused.

**Requirements:** FR-008, FR-013, FR-021, NFR-008

#### US-012 Open a world

As a **learner**, I want to open a world and see its photo and words, so that I can study them before I play.

1. **Given** a `READY` world, **when** I open it, **then** I see its photo and its words, each with its Thai meaning, CEFR level, and my mastery level.
2. **Given** a `READY` world, **when** I open it, **then** I can start an Identify game (US-030) and remove wrong words (US-022).
3. **Given** an `ANALYZING` or `FAILED` world, **when** I open it, **then** I see its status and, for `FAILED`, what I can do next (US-021).
4. **Given** a world that belongs to another learner, **when** I try to open it, **then** it is refused.

**Requirements:** FR-008, FR-014, FR-021

#### US-013 Rename a world

As a **learner**, I want to rename a world, so that its name still fits when the place or my idea of it changes.

1. **Given** a world, **when** I enter a new name of 1–50 characters, **then** the world shows the new name everywhere.
2. **Given** the new name is empty or longer than 50 characters, **when** I save, **then** I see the rule and the name does not change.

**Requirements:** FR-016

#### US-014 Delete a world

As a **learner**, I want to delete a world I no longer need, so that my list stays useful and its photo is removed.

1. **Given** a world, **when** I delete it and confirm, **then** the world, its photo, and its words are removed from my account, and the photo is removed from storage within 24 hours.
2. **Given** a word from this world also appears in another of my worlds, **when** I delete this world, **then** that word keeps its mastery and mistake history.
3. **Given** a word appears only in this world, **when** I delete the world, **then** its mastery and mistake history are removed.
4. **Given** I delete a world, **then** my total XP does not decrease (V4).
5. **Given** I start deleting a world, **when** I cancel, **then** nothing changes.

**Requirements:** FR-015, NFR-009

### 4.3 AI vocabulary extraction (PRD F3, SRS 3.3)

#### US-020 Get vocabulary from my photo

As a **verified learner**, I want LanguZe to find the objects in my photo and give me English words with Thai meanings, so that I learn words for things I see every day.

1. **Given** I created a world, **when** its analysis runs, **then** the world shows `ANALYZING`, and I can leave the page and see the result later.
2. **Given** the analysis succeeds, **when** it finishes, **then** the world is `READY` with 3–12 words, each with an English word in singular base form, a Thai meaning, an English example sentence, a CEFR level, and a highlight box on the object.
3. **Given** the words are chosen, **then** they are common everyday names suitable for CEFR A1–B1 learners, and example sentences use A1–B1 English (checked by the evaluation set, SRS 5.1).
4. **Given** the AI returns invalid items, **when** the output is checked, **then** only items that pass validation are saved.
5. **Given** my photo shows people, **when** it is analysed, **then** it is not blocked for that reason, and no words for people or body parts and no highlight boxes on people are returned.
6. **Given** my photo contains text that tries to instruct the AI, **when** it is analysed, **then** that text has no effect on the result.
7. **Given** a word matches a vocabulary word I already have (same English word and Thai meaning), **when** it is saved, **then** it is linked to that word and keeps my mastery (US-041).
8. **Given** a typical everyday photo, **when** it is analysed, **then** it is `READY` within 20 seconds at the 95th percentile.
9. **Given** the analysis succeeds, **then** it counts toward my daily analysis limit.

**Requirements:** FR-020, FR-021, FR-022, FR-023, FR-024, FR-043, FR-094, AIR-001–AIR-005, AIR-007, AIR-008, AIR-009, NFR-001

#### US-021 Recover from a failed analysis

As a **verified learner**, I want to know why an analysis failed and what to do next, so that I do not lose my world or my daily limit.

1. **Given** fewer than 3 valid words are found, **when** the analysis ends, **then** the world is `FAILED` with advice to take a clearer photo of a place with more objects.
2. **Given** the AI provider fails, times out, or returns invalid output, **when** the analysis ends, **then** the world is `FAILED` and no vocabulary from it is saved.
3. **Given** an analysis has not finished 5 minutes after it started, **then** the world is `FAILED` as for a provider error.
4. **Given** an analysis failed for any reason above, **then** it does not count toward my daily analysis limit.
5. **Given** a `FAILED` world that still has its photo, **when** I choose retry, **then** the same photo is analysed again, after the daily limit check.
6. **Given** a `FAILED` world, **when** I delete it, **then** it is deleted as in US-014.
7. **Given** I want to use a different photo, **then** I create a new world; a world's photo cannot be replaced.

Photos that fail the safety check are covered in US-091.

**Requirements:** FR-024, FR-025, NFR-010

#### US-022 Remove wrong words

As a **learner**, I want to remove words the AI got wrong or that I do not want, so that I only practise words that are right for me.

1. **Given** a `READY` world with more than one word, **when** I remove a word, **then** it disappears from the world and from future games of that world.
2. **Given** the removed word appears in another of my worlds, **then** its mastery and mistake history are kept; otherwise they are removed.
3. **Given** only one word is left, **when** I try to remove it, **then** I cannot, and I am told to delete the world instead (V5).

Editing a word's text is not part of Release 1.0 (PRD Q3).

**Requirements:** FR-026, FR-027

### 4.4 Identify game (PRD F4, SRS 3.4)

#### US-030 Play Identify on a world

As a **learner**, I want to name objects highlighted in my own photo, so that I practise words in the place where I see them.

1. **Given** a `READY` world, **when** I start a game, **then** the session has up to 10 of its words: `NEW` and `LEARNING` first, then `FAMILIAR`, then `MASTERED`, in random order within each level.
2. **Given** a world that is not `READY`, **then** I cannot start a game.
3. **Given** a question, **then** I see the world's photo with the object's highlight box, a text box for the English word, and an "I don't know" option.
4. **Given** a question, **then** the highlight box is visible without relying on color alone, and I can answer using only the keyboard.

**Requirements:** FR-030, FR-031, NFR-012

#### US-031 Answer a question and get feedback

As a **learner**, I want to type the word and see at once whether I was right, with its meaning and an example, so that I learn from every answer.

1. **Given** the word `sofa` with accepted variants `couch` and `sofas`, **when** I answer `Sofa`, `a sofa`, `couch`, or `sofas`, **then** the answer is correct; **when** I answer `sofaa`, **then** it is incorrect (SRS 4.2).
2. **Given** I submit an answer, **then** I see whether it was correct, the correct word, its Thai meaning, and the example sentence; a correct answer also shows the 10 XP earned.
3. **Given** I answer incorrectly, **then** the mistake is kept with what I typed, I earn no XP, and no XP is taken away.
4. **Given** I submit an answer, **then** it is checked on the server, and the attempt, the mastery update, and the XP are saved together or not at all.
5. **Given** a question I have not answered yet, **then** its correct answer and accepted variants are not sent to my browser.
6. **Given** I already answered a question, **when** an answer to it is submitted again, **then** no second attempt is recorded and no extra XP is given.

**Requirements:** FR-032, FR-033, FR-034, FR-042, FR-060, NFR-011

#### US-032 Choose "I don't know"

As a **learner**, I want to say I don't know a word and see the answer, so that I learn it instead of guessing.

1. **Given** a question, **when** I choose "I don't know", **then** I see the correct word, its Thai meaning, and the example sentence.
2. **Given** I chose "I don't know", **then** it counts as an incorrect attempt without answer text, is kept as a mistake marked "I don't know", and earns no XP.

**Requirements:** FR-031, FR-032, FR-042

#### US-033 See my session result

As a **learner**, I want a summary at the end of a session, so that I can see what I achieved.

1. **Given** I answered the last question, **when** the session ends, **then** I see how many answers were correct, the XP earned, and the words whose mastery level changed, with their new level.

**Requirements:** FR-035

#### US-034 Leave a session and continue later

As a **learner**, I want to stop a session whenever I need to and pick it up again later, so that practice fits my time and an interruption does not waste my progress.

1. **Given** I am in the middle of a game or review session, **when** I leave, **then** the answers I submitted stay recorded and the unanswered questions have no effect.
2. **Given** the page reloads during a session, for example when the LINE or Facebook app reloads it after I switch apps, **then** I continue at the next unanswered question.
3. **Given** I left a session unfinished less than 24 hours ago, **when** I open that world's game (or review) again, **then** I can continue at the next unanswered question or start a new session.
4. **Given** I finish a session I continued, **then** the summary covers all of its answers.
5. **Given** 24 hours have passed, or I started a new session for the same world (or a new review), **then** the unfinished session is closed without a summary.

**Requirements:** FR-035, FR-036

### 4.5 Mistakes and mastery (PRD F5, SRS 3.5)

#### US-040 Mastery follows my answers

As a **learner**, I want each word's mastery level to change with my answers, so that I can see which words I really know.

The complete rule is SRS section 4.1; these scenarios are its main cases.

1. **Given** a `NEW` word, **when** I answer correctly, **then** it becomes `LEARNING` with a streak of 1; **when** I answer incorrectly, **then** it becomes `LEARNING` with a streak of 0.
2. **Given** a `LEARNING` word with a streak of 1, **when** I answer correctly, **then** it becomes `FAMILIAR`, its streak resets to 0, and today becomes its familiar day.
3. **Given** a `LEARNING` word, **when** I answer incorrectly, **then** its streak resets to 0.
4. **Given** a `FAMILIAR` word, **when** I answer correctly on its familiar day, **then** nothing changes.
5. **Given** a `FAMILIAR` word, **when** I answer correctly twice on days after its familiar day, **then** it becomes `MASTERED`.
6. **Given** a `FAMILIAR` word, **when** I answer incorrectly, **then** it becomes `LEARNING` with a streak of 0.
7. **Given** a `MASTERED` word, **when** I answer correctly, **then** nothing changes; **when** I answer incorrectly, **then** it becomes `FAMILIAR`, its streak resets to 0, and today becomes its familiar day.
8. **Given** any of the above, **then** "day" means a calendar day in `Asia/Bangkok` (V1).

**Requirements:** FR-041

#### US-041 One word, one mastery across my worlds

As a **learner**, I want a word that appears in several of my worlds to have one mastery level, so that practising it anywhere counts.

1. **Given** `chair` is in both "My Room" and "My Office", **when** I answer it in either world, **then** the same mastery changes.
2. **Given** a new world contains a word I already have (same English word and Thai meaning), **when** its analysis finishes, **then** the word shows my existing mastery.
3. **Given** two words have the same English word but different Thai meanings (for example `bat` as ค้างคาว and as ไม้ตี), **then** they are separate words with separate mastery.

**Requirements:** FR-040, FR-043

#### US-042 My mistakes are remembered

As a **learner**, I want LanguZe to remember what I got wrong, so that review and the tutor can help with my real weak points.

1. **Given** I answer incorrectly or choose "I don't know", **then** a mistake is kept with my answer text (or marked "I don't know") and the time.
2. **Given** I have mistakes, **then** review puts those words first (US-050) and the tutor can read them (US-071).

**Requirements:** FR-042

### 4.6 Personalized review (PRD F6, SRS 3.6)

#### US-050 Review my weak words

As a **learner**, I want a review session that brings back the words I struggle with from all my worlds, so that I fix my weak points.

1. **Given** I have words that are not `MASTERED` and have at least one attempt, **when** I start a review, **then** the session has up to 10 of them in this order: words with mistakes (most recent mistake first), then `FAMILIAR` words, then `LEARNING` words (least recently practised first in both).
2. **Given** a word appears in several worlds, **when** it is asked, **then** the question uses its occurrence from my most recently created world that contains it.
3. **Given** a review question, **then** answering, "I don't know", feedback, mastery, and XP work exactly as in the Identify game (US-031, US-032).
4. **Given** a word I have never answered (`NEW`), **then** it is not part of review.

**Requirements:** FR-050, FR-051, FR-052

#### US-051 Nothing to review yet

As a **learner**, I want to be told when there is nothing to review, so that I know what to do instead.

1. **Given** no word qualifies for review, **when** I open review, **then** I see that there is nothing to review and a suggestion to play a world.

**Requirements:** FR-053

### 4.7 Progress and XP (PRD F7, SRS 3.7)

#### US-060 See my progress

As a **learner**, I want to see my XP and how many words I know at each level, so that I can see myself improving.

1. **Given** I open the progress page, **then** I see my total XP, the number of my words at each mastery level, and each world's word and mastery counts.
2. **Given** I answer correctly in a game or review, **then** I earn 10 XP; incorrect answers earn none and never remove XP.
3. **Given** I delete a world or remove a word, **then** my total XP does not decrease (V4).

**Requirements:** FR-060, FR-061

### 4.8 AI tutor (PRD F8, SRS 3.8)

#### US-070 Chat with the AI tutor

As a **verified learner**, I want to ask an AI tutor about English, so that I get explanations in Thai when I am stuck.

1. **Given** I am verified and not under an AI suspension, **when** I send a message of up to 1,000 characters, **then** the tutor replies in Thai with English examples at CEFR A1–B1 level.
2. **Given** I ask the tutor to answer in another language, **then** it does.
3. **Given** I sent a message, **then** the reply starts streaming or completes within 10 seconds at the 95th percentile.
4. **Given** I come back later, **when** I open the tutor, **then** my conversation is still there (one conversation per learner, V6).
5. **Given** the AI provider fails, **when** I send a message, **then** I see an error and can send it again, and the failed message does not count toward my daily limit.

**Requirements:** FR-070, FR-071, FR-073, NFR-003, NFR-010

#### US-071 The tutor knows my words and mistakes

As a **verified learner**, I want the tutor to look at my own weak words and mistakes, so that its help fits me instead of being generic.

1. **Given** I have mistakes, **when** I ask "Why do I keep getting this word wrong?", **then** the tutor uses my recent mistakes, including what I typed, to explain.
2. **Given** I ask about one of my words, **then** the tutor can look up that word's details.
3. **Given** I have no mistakes yet, **when** I ask about my mistakes, **then** the tutor says so and does not invent history.
4. **Given** the tutor reads learning data, **then** it reads only my data, and its tools cannot change anything.
5. **Given** the tutor calls the AI model, **then** my email address, display name, and photos are not sent.

**Requirements:** FR-072, FR-075, AIR-006, AIR-008

#### US-072 The tutor stays on topic and keeps data private

As a **verified learner**, I want the tutor to stay focused on learning English and keep everyone's data private, so that I can trust it.

1. **Given** I ask about something unrelated to learning English, **then** the tutor politely declines and steers back to English.
2. **Given** I ask for its instructions or for another learner's data, **then** it refuses and reveals neither.
3. **Given** my message tries to override the tutor's instructions, **then** its behavior does not change.

**Requirements:** FR-074, AIR-008

#### US-073 Clear my tutor conversation

As a **verified learner**, I want to clear my tutor conversation, so that I can start fresh.

1. **Given** I have a conversation, **when** I clear it and confirm, **then** it is deleted and my next message starts a new conversation.
2. **Given** I clear the conversation, **then** today's message count is not reset.

**Requirements:** FR-076

### 4.9 Usage limits (SRS 3.9)

#### US-080 See my daily limits

As a **verified learner**, I want to see how many photo analyses and tutor messages I have left today, so that I can plan my practice.

1. **Given** I am verified, **then** I can see my remaining photo analyses and tutor messages for today.
2. **Given** I used all 10 analyses today, **then** creating a world is disabled and shows when the limit resets.
3. **Given** I sent 30 tutor messages today, **then** the tutor input is disabled and shows when the limit resets.
4. **Given** my message is longer than 1,000 characters, **then** I cannot send it and I see the limit.
5. **Given** it is midnight in `Asia/Bangkok`, **then** both daily limits reset.
6. **Given** an analysis or a tutor reply failed because of LanguZe or its providers, **then** it does not use my limit; a blocked photo does (US-091).

**Requirements:** FR-020, FR-025, FR-071, FR-080, FR-093

#### US-081 Configure usage limits

As the **operator**, I want to set usage limits per environment without changing code, so that I can keep costs within budget and test easily.

1. **Given** I set limit values in an environment's configuration (worlds per learner, analyses per day, tutor messages per day), **when** the application starts, **then** it uses those values.
2. **Given** a limit value is invalid, **when** the application starts, **then** it refuses to start and names the setting.
3. **Given** a limit value is not set, **then** the SRS value applies (20 worlds, 10 analyses per day, 30 tutor messages per day).

**Requirements:** FR-012, FR-081, NFR-017

### 4.10 Content policy and safety (PRD F9, SRS 3.10)

#### US-090 Read the Terms of Use and Privacy Policy

As a **visitor or learner**, I want to read the rules and how my data is used, so that I know what I agree to.

1. **Given** any page, **then** it links to the Terms of Use and the Privacy Policy.
2. **Given** I read the Terms of Use, **then** they state that LanguZe is for people aged 18 or older, and which photos are allowed (everyday places and objects) and which are prohibited (FR-091).
3. **Given** I read the Privacy Policy or look in the app, **then** I find a contact address for abuse reports, suspension appeals, and personal-data requests.

Accepting the Terms of Use and Privacy Policy at sign-up is covered in US-001 and US-004.

**Requirements:** FR-090, FR-091, FR-099

#### US-091 Unsafe photos are blocked

As a **learner**, I want to be told clearly when a photo breaks the rules, so that I know what happened and what is allowed.

1. **Given** I upload a photo, **then** it passes an automatic safety check before any vocabulary extraction.
2. **Given** the photo fails the check, **then** it is deleted immediately and never shown, and the world is `FAILED` with a general message that links to the Terms of Use.
3. **Given** a photo is blocked, **then** it counts toward my daily analysis limit.
4. **Given** a photo is blocked, **then** LanguZe records me, the time, and the block category, but not the photo.
5. **Given** a world whose photo was blocked, **then** I can delete it but not retry it, because the photo no longer exists.

**Requirements:** FR-092, FR-093, FR-095, AIR-008

#### US-092 Repeated blocked photos pause AI features

As the **operator**, I want AI features paused automatically for learners who keep uploading blocked photos, so that LanguZe stays safe without anyone watching every upload.

1. **Given** a learner has had no earlier AI suspension, **when** their third photo within 7 days is blocked, **then** their AI features are paused for 7 days and resume automatically afterwards (level 1).
2. **Given** a learner has had an earlier AI suspension, **when** they again reach 3 blocked photos within 7 days, **then** their AI features stay off until an admin reviews the case (level 2); the case appears in the review queue and admins are emailed.
3. **Given** my AI features are paused, **when** I open world creation or the tutor, **then** I see why, until when (or that a review is pending), and how to contact LanguZe.
4. **Given** my AI features are paused, **then** my worlds, games, review, and progress still work.
5. **Given** a learner's AI features are paused, **when** a photo analysis or tutor request reaches the API, **then** it is refused.

**Requirements:** FR-096, FR-099, FR-103, FR-107, NFR-004

#### US-093 Suspected illegal material

As the **operator**, I want a photo suspected to be illegal material to suspend AI features at once and alert admins, so that serious cases are handled immediately.

1. **Given** a photo is blocked as suspected illegal material, **then** the learner's AI features are suspended immediately until an admin reviews the case, whatever their earlier block count.
2. **Given** such a suspension, **then** the case appears in the review queue and admins are emailed.
3. Further handling follows Thai law; see note N1 in Appendix A.

**Requirements:** FR-098, FR-103, FR-107

### 4.11 Administration (PRD F9, SRS 3.11)

#### US-100 Promote an admin

As the **operator**, I want to give the admin role with a deployment script, so that no feature of the application can grant admin rights.

1. **Given** an account listed in the script's configuration exists, **when** I run the script, **then** that account becomes an admin.
2. **Given** a listed account does not exist, **when** I run the script, **then** the script reports it and creates nothing.
3. **Given** I run the script again with the same list, **then** nothing else changes.
4. **Given** any request through the application, **then** it cannot grant or remove the admin role.

**Requirements:** FR-100, FR-101

#### US-101 Open the admin area

As an **admin**, I want a separate admin area, so that moderation tools are kept apart from learning.

1. **Given** I am an admin, **then** I see a link to the admin area and can open it.
2. **Given** I am not an admin, **then** I see no link, and opening an admin page or calling an admin API is refused.
3. **Given** my admin role is removed or my account is suspended, **when** I make my next request, **then** I no longer have admin access.
4. **Given** I perform admin actions, **then** they are rate-limited.

**Requirements:** FR-100, FR-102, NFR-019

#### US-102 See cases that need review

As an **admin**, I want a list of learners whose AI suspension needs review, oldest first, so that I handle cases fairly and in order.

1. **Given** learners with a level 2 suspension or a suspected illegal material suspension, **when** I open the review queue, **then** I see them oldest first, with their block counts and categories.
2. **Given** a new case needs review, **then** admins receive an email.
3. **Given** no case needs review, **when** I open the review queue, **then** I see that it is empty.
4. **Given** a case's AI suspension is lifted or given an end date, or the account is suspended or deleted, **then** the case leaves the queue; if a suspended account is reactivated while its AI suspension still awaits review, the case returns.

**Requirements:** FR-097, FR-103, FR-107

#### US-103 See a learner's moderation record

As an **admin**, I want to see only what I need to judge a case, so that I can decide fairly without seeing the learner's private content.

1. **Given** I open a learner from the review queue (or from search, US-106), **then** I see their block records, AI suspension history, account age, and sign-in methods.
2. **Given** any learner, **then** I see only the items above, never their photos or tutor conversation.

**Requirements:** FR-097, FR-104

#### US-104 Act on a learner's case

As an **admin**, I want to lift or extend an AI suspension, suspend or reactivate an account, or delete an account, each with a reason, so that I can resolve cases and explain my decisions later.

1. **Given** any action, **when** I submit it without a reason, **then** it is refused.
2. **Given** I lift an AI suspension, **then** the learner can use AI features again immediately.
3. **Given** I extend an AI suspension until a future date, **then** the learner's AI features stay off until that date.
4. **Given** I suspend an account, **then** the learner is signed out everywhere immediately and cannot sign in until I reactivate the account.
5. **Given** I delete an account, **then** the effect is the same as the learner deleting it (US-009).
6. **Given** any action, **then** it is saved together with its audit entry, or not at all.
7. **Given** the account is my own, **then** I cannot take any of these actions on it.
8. **Given** the learner appealed by email, **when** I act on their case, **then** I note the appeal in the reason; appeals have no separate field.

**Requirements:** FR-097, FR-105, FR-106, NFR-019

#### US-105 See the audit log

As an **admin**, I want to see every admin action, so that moderation stays accountable.

1. **Given** admin actions exist, **when** I open the audit log, **then** I see for each one the admin, the learner, the action, the reason, and the time, newest first.
2. **Given** an audit entry, **then** no one can edit or delete it through the application.
3. **Given** the learner's account was deleted, **then** the entry remains with the learner identifier and no other personal data.

**Requirements:** FR-106

#### US-106 Find a learner

As an **admin**, I want to find a learner by email address or account ID, so that I can handle an appeal or a personal-data request that arrives by email.

1. **Given** I enter an exact email address or account ID, **when** I search, **then** I see the matching learner, or that none was found.
2. **Given** a learner has no email address, **then** they can see their account ID in their account settings and include it when they contact LanguZe.
3. **Given** the admin area, **then** it offers no partial search and no list of all learners.

**Requirements:** FR-099, FR-108

## 5. Traceability

| SRS section                    | Requirements    | Stories                                               |
| ------------------------------ | --------------- | ----------------------------------------------------- |
| 3.1 Accounts and access        | FR-001–FR-009   | US-001–US-009, US-011, US-012                         |
| 3.2 Worlds and photos          | FR-010–FR-017   | US-010–US-014                                         |
| 3.3 AI vocabulary extraction   | FR-020–FR-027   | US-010, US-020–US-022, US-080                         |
| 3.4 Identify game              | FR-030–FR-036   | US-030–US-034                                         |
| 3.5 Mistakes and mastery       | FR-040–FR-043   | US-020, US-031, US-032, US-040–US-042                 |
| 3.6 Personalized review        | FR-050–FR-053   | US-050, US-051                                        |
| 3.7 Progress and XP            | FR-060, FR-061  | US-031, US-060                                        |
| 3.8 AI tutor                   | FR-070–FR-076   | US-070–US-073, US-080                                 |
| 3.9 Usage limits               | FR-080, FR-081  | US-010, US-080, US-081                                |
| 3.10 Content policy and safety | FR-090–FR-099   | US-001, US-004, US-010, US-090–US-093, US-102–US-104  |
| 3.11 Administration            | FR-100–FR-108   | US-003, US-004, US-009, US-092, US-093, US-100–US-106 |
| 4 Business rules               | 4.1, 4.2        | US-031, US-040                                        |
| 5 AI requirements              | AIR-001–AIR-009 | US-020, US-071, US-072, US-091; Definition of Done    |
| 6 Non-functional requirements  | NFR-001–NFR-019 | Definition of Done, and the stories that name them    |

## Appendix A. Questions raised while writing the stories

Writing acceptance criteria exposed points the SRS did not settle. All were decided on 2026-09-19 and recorded in SRS v0.6.

| ID  | Question                                                                                                                                                                        | Decision                                                                                                                                                                                                     | Recorded in            | Status               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | -------------------- |
| S1  | How does an admin find a learner who is not in the review queue, for example to handle an appeal against a level 1 suspension or a personal-data request that arrives by email? | Search by exact email address or account ID only; no partial search and no list of all learners. Learners can see their account ID in account settings, which matters for accounts without an email address. | FR-108, US-106         | Confirmed 2026-09-19 |
| S2  | FR-104 showed "whether an appeal was received", but appeals arrive by email (FR-099), so the system cannot know.                                                                | Removed from FR-104. The admin notes an appeal in the reason of the action they take, which the audit log keeps.                                                                                             | FR-104, FR-105, US-104 | Confirmed 2026-09-19 |
| S3  | What does "retry" mean for a failed analysis (FR-025)?                                                                                                                          | Retry analyses the same stored photo again, after the daily limit check. A blocked photo is already deleted, so its world can only be deleted. To use a different photo, the learner creates a new world.    | FR-025, US-021, US-091 | Confirmed 2026-09-19 |
| S4  | Can an admin act on their own account?                                                                                                                                          | No. An admin cannot take any admin action on their own account, as in BidNest, where an admin cannot suspend or reactivate themselves.                                                                       | FR-105, US-104         | Confirmed 2026-09-19 |
| S5  | How is the Identify game protected against reading answers in advance and against answering the same question twice?                                                            | The correct answer and accepted variants are not sent to the browser before the learner answers. Each question accepts one answer; a repeated submission records nothing and gives no XP.                    | FR-032, FR-034, US-031 | Confirmed 2026-09-19 |
| S6  | Does a tutor message that fails because of LanguZe or its AI provider count toward the daily limit (FR-071)?                                                                    | No, consistent with failed analyses (FR-025).                                                                                                                                                                | FR-071, US-070, US-080 | Confirmed 2026-09-19 |
| S7  | Does resetting a password sign out the learner's other devices?                                                                                                                 | Yes. Completing a reset ends all existing sessions, because the old password may have been compromised. BidNest does the same.                                                                               | FR-005, US-007         | Confirmed 2026-09-19 |

**Note for before launch**

- **N1:** FR-092 deletes a blocked photo immediately, and FR-098 says that suspected illegal material is handled according to Thai law. Before launch, check whether Thai law requires such material to be preserved or reported. If it does, FR-092 needs an exception for that category. This check is also recorded in SRS section 3.10.
