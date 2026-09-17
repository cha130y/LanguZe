# LanguZe — Product Requirements Document (PRD)

- **Document status:** Draft v0.2 — open questions in section 12 must be resolved before the SRS is finalized
- **Date:** 2026-09-17
- **Product release covered:** Release 1.0 (first public release)
- **Next documents:** SRS (`FR-xxx`) → user stories (`US-xxx`) → use cases (`UC-xxx`) → process flows

## 1. Product overview

**LanguZe** (pronounced _แลน-กุ-เซ่_) — **Learn from your world.**

_เปลี่ยนสิ่งรอบตัวคุณให้กลายเป็นบทเรียนภาษา_

LanguZe is an AI-powered, gamified vocabulary-learning web application. A learner photographs a real place from their own life, such as their room, kitchen, or workplace. AI turns the objects in that photo into English vocabulary with Thai meanings, the learner practises those words through a game, LanguZe remembers which words the learner gets wrong, and a personal AI tutor uses that history to explain and coach.

## 2. Problem statement

Thai speakers see and use everyday objects all day, but typical vocabulary apps teach from fixed, generic word lists:

- **Disconnected content.** Lessons such as "Animals" or "Food" are chosen by the app, not by what the learner actually sees and needs.
- **Right/wrong without understanding.** Most exercises mark an answer correct or incorrect without explaining the mistake in the learner's own language.
- **No memory of personal weak points.** Progress is tracked as lessons completed or points earned, not as which specific words a learner keeps getting wrong.

As a result, learners forget words that never connected to their real environment and keep repeating the same mistakes.

## 3. Product vision

Turn the learner's own world into personalized language lessons, with AI as the learning engine rather than an add-on feature.

| Pillar                    | What it means for the learner                                                    |
| ------------------------- | -------------------------------------------------------------------------------- |
| **Learn from your world** | Upload a photo of a real place and receive vocabulary about the things in it.    |
| **Adaptive learning**     | LanguZe remembers each word's mastery and brings weak words back for practice.   |
| **AI personal tutor**     | Ask questions and get explanations grounded in your own vocabulary and mistakes. |
| **Gamification**          | XP and progress make practice engaging; more game types and multiplayer follow.  |

Positioning compared with traditional vocabulary apps:

| Traditional app      | LanguZe                                     |
| -------------------- | ------------------------------------------- |
| Predefined lessons   | Lessons generated from the learner's photos |
| Generic exercises    | Practice driven by the learner's mistakes   |
| Correct / wrong only | AI explains mistakes                        |
| Course-centric       | Learner-centric: "learn from your world"    |

## 4. Target users

### Primary persona: Thai-speaking English learner

- Native Thai speaker who wants practical English vocabulary for everyday surroundings.
- Uses a smartphone or laptop browser and can take or upload photos.
- Prefers explanations in Thai with English examples.
- Proficiency range to target is an open question (section 12).

### Future users (later releases)

- English speakers learning Thai, and learners of other language pairs.
- Teachers who prepare worlds or track learners.

## 5. Release 1.0 features

| #   | Feature                  | Description                                                                                                                                                                                                                                         |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Account                  | Sign up and sign in with email and password or Google; email verification; password reset.                                                                                                                                                          |
| F2  | My World                 | Create a named world (for example "My Room") by uploading a photo; list and open the learner's worlds.                                                                                                                                              |
| F3  | AI vocabulary extraction | AI identifies objects in the photo and produces English words, Thai meanings, and an example sentence per word. Output is validated before it is saved; failures are shown clearly.                                                                 |
| F4  | Identify game            | For a world's vocabulary, the learner is shown an object from their photo and types the English word. Answers are checked against accepted variants; feedback shows the correct word, its Thai meaning, and the example sentence.                   |
| F5  | Mistakes and mastery     | Every answer updates the word's mastery state: `NEW` → `LEARNING` → `FAMILIAR` → `MASTERED`. Incorrect answers are recorded as mistakes.                                                                                                            |
| F6  | Personalized review      | A review session that prioritizes the learner's weakest words across all worlds.                                                                                                                                                                    |
| F7  | Progress and XP          | Correct answers earn XP; the learner sees total XP and word counts per mastery state.                                                                                                                                                               |
| F8  | AI tutor                 | A chat where the learner asks about their vocabulary (for example "Why do I keep getting this word wrong?"). The tutor retrieves the learner's weak words and recent mistakes through application tools and explains in Thai with English examples. |

Exact rules (accepted answer variants, mastery transitions, XP amounts, review ordering, limits) are defined in the SRS.

## 6. User journey

```text
Sign up / sign in
      ↓
Create a world: name it and upload a photo      (e.g., "My Room")
      ↓
AI analyses the photo → English words + Thai meanings + example sentences
      ↓
Play Identify: see an object from the photo → type the English word
      ↓
Feedback → correct: XP · incorrect: correct word + meaning + example
      ↓
Mastery updated, mistakes recorded
      ↓
Personalized review of weak words
      ↓
Ask the AI tutor about words and mistakes
```

## 7. Release 1.0 scope

**In scope:** features F1–F8 as a responsive web application for mobile and desktop browsers, deployed to production.

**Release criteria:**

- A new learner can complete the full journey in section 6 in production without assistance.
- AI extraction, answer feedback, and tutor behaviors have evaluation cases (expected, edge, and failure) that pass.
- CI passes on `main` (format, lint, typecheck, tests, build, API e2e).

## 8. Roadmap (later releases)

Candidates, in no fixed order; each needs its own requirement and, where architecture changes, an ADR:

- Additional game types: multiple choice, spelling, translation, sentence writing with AI feedback, listening.
- AI-generated practice scenes when the learner has no suitable photo.
- AI tutor grounded in full learning history through retrieval-augmented generation (RAG) with PostgreSQL + pgvector.
- Daily Challenge built from weak and almost-mastered words.
- Real-time multiplayer challenges and leaderboards.
- Achievements and notifications, including weekly learning reports by email.
- Facebook and LINE sign-in, passkeys, and multi-factor authentication.
- English → Thai direction and other language pairs.
- Teacher role and community features.

## 9. Success metrics

Targets marked _proposed_ are starting values to confirm or adjust.

| Area                | Metric                                                                                                                     | Target                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Core journey        | Participants in usability testing who complete sign-up → world → game → review → tutor without help                        | ≥ 5 participants (_proposed_)               |
| AI extraction       | Share of extracted words that correctly name an object visible in the photo, on an evaluation set of everyday-scene photos | ≥ 80% (_proposed_)                          |
| AI output safety    | AI results persisted without passing schema validation                                                                     | 0 (invariant)                               |
| Responsiveness      | Photo upload to vocabulary ready (95th percentile)                                                                         | ≤ 20 seconds (_proposed_)                   |
| Engineering quality | CI status on `main`; evaluation cases for AI behaviors                                                                     | Always green; cases for F3, F4 feedback, F8 |
| Operating cost      | Monthly infrastructure and AI spend at launch                                                                              | ≤ USD 10 (initial budget)                   |

## 10. Non-goals for Release 1.0

- Native iOS or Android apps.
- Payments, subscriptions, or ads.
- Game types other than Identify.
- Real-time multiplayer, leaderboards, and achievements.
- AI image generation.
- RAG and long-term learning-history search.
- Speech, pronunciation, and listening practice.
- Languages or directions other than Thai speakers learning English.
- Teacher, organization, or admin dashboards beyond what operating the service requires.
- Offline use.

## 11. Constraints, assumptions, and risks

**Constraints**

- Developed and operated by a single developer; each technology must be justified by a feature ([ADR-0001](../architecture/adr/0001-modular-monolith.md), [ADR-0002](../architecture/adr/0002-toolchain-baseline.md)).
- Initial operating budget of about USD 0–10 per month, using free tiers where possible.

**Assumptions**

- Learners are comfortable uploading photos of their surroundings.
- A vision-capable AI model on a free or low-cost tier is accurate enough for everyday objects.

**Risks**

| Risk                                                              | Mitigation direction                                                                                 |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| AI misidentifies objects or invents words                         | Treat AI output as untrusted: schema validation, deterministic post-processing, evaluation set.      |
| Photos contain personal information (faces, documents, addresses) | Send only what the feature needs to AI providers; define retention and deletion (section 12).        |
| Text inside a photo tries to instruct the AI (prompt injection)   | Constrain prompts and structured outputs; never let model output trigger actions without validation. |
| Inappropriate or unsafe uploads                                   | Validate file type and size; define a content policy.                                                |
| AI free-tier quotas, rate limits, or cost spikes                  | Rate-limit AI features per learner; provider abstraction so providers can be switched.               |
| Abuse of public sign-up and uploads                               | Rate limiting and per-learner usage limits; decide the registration model (section 12).              |

## 12. Open questions

| #   | Question                                                                                                        | Affects         |
| --- | --------------------------------------------------------------------------------------------------------------- | --------------- |
| Q1  | Which English proficiency range should Release 1.0 target (for example CEFR A1–B1)?                             | F3, F8          |
| Q2  | How does the Identify game point to an object: highlighted region on the photo, cropped image, or another hint? | F3, F4          |
| Q3  | Can learners remove or correct AI-extracted words before playing?                                               | F3, F4          |
| Q4  | How long are photos kept, and can learners delete a world and its photo?                                        | F2, privacy     |
| Q5  | What per-learner limits apply to worlds, photos, and tutor messages?                                            | F2, F3, F8      |
| Q6  | Is registration open to the public at launch, or invite-only?                                                   | F1, cost, abuse |

## 13. References

- Product planning notes (Thai): product concept, differentiation, stack, and roadmap decisions summarized in this document.
- [ADR-0001: Modular monolith](../architecture/adr/0001-modular-monolith.md)
- [ADR-0002: Toolchain baseline](../architecture/adr/0002-toolchain-baseline.md)
