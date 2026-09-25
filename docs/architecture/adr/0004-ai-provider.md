# ADR-0004: Google Gemini as the first AI provider

- **Status:** Accepted
- **Date:** 2026-09-19
- **Related:** AIR-001–AIR-009, FR-020–FR-025, FR-070–FR-076, FR-091–FR-094, NFR-001, NFR-003, NFR-017; PRD Q9; [architecture overview, section 5.1](../overview.md#51-ai-interface); [image to vocabulary flow](../../flows/image-to-vocabulary.md); [AI tutor flow](../../flows/ai-tutor.md)

## Context

LanguZe needs an AI provider for three jobs, each behind a LanguZe-owned interface (AIR-001):

1. **Safety check:** decide whether a photo breaks the Terms of Use, and in which category (FR-091, FR-092).
2. **Vocabulary extraction:** name 3–12 objects in a photo with an English word, a Thai meaning, an example sentence, a CEFR level, accepted variants, and a **highlight box** around each object (FR-022, AIR-003–AIR-005, AIR-009). The Identify game depends on the boxes being accurate.
3. **Tutor:** answer in Thai with English examples, reading the learner's data through read-only tools, and stream the reply (FR-070–FR-075, NFR-003).

Constraints: a budget of about USD 10 per month at launch (NFR-017); photos of learners' homes are personal data under Thailand's PDPA (AIR-006); Thai-language quality; and each provider's terms about who may use apps built on it.

## Options considered

| Provider               | For                                                                                                                                                                       | Against                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Gemini**      | Documents object detection with bounding boxes; image input, structured output, tool calling, and streaming in one API; low-cost Flash-Lite models; available in Thailand | Its terms forbid apps directed at or likely to be used by people under 18; on the free tier, Google uses submitted content to improve its products |
| OpenAI                 | Allows users from 13, with parental permission and safeguards under 18                                                                                                    | Bounding boxes are not a documented feature; their accuracy would have to be proven first                                                          |
| Anthropic (Claude)     | Allows minors with safeguards; strong at following tutor instructions                                                                                                     | Bounding boxes are not a documented feature; their accuracy would have to be proven first                                                          |
| Self-hosted open model | Photos never leave LanguZe's infrastructure                                                                                                                               | GPU hosting costs far more than the budget, plus operations work for one developer                                                                 |

## Decision

1. **Provider:** the Gemini API, used through Google's official Gen AI SDK for JavaScript (`@google/genai`) inside the `ai` module's adapter only. No other module imports the SDK.
2. **Paid tier only for real learner data.** Production, and any environment that holds real learner data, uses a paid Gemini API key, because on the paid tier Google does not use prompts, images, or responses to improve its products. The free tier may be used in local development with test photos only.
3. **Adults only.** Gemini's terms exclude apps directed at or likely to be used by people under 18, so Release 1.0 is for adults (PRD Q9, V20).
4. **Models:** a current Gemini Flash-family model for each job, chosen as the cheapest model that passes the evaluation set (AIR-008, V8) and the PRD target of at least 80% correct words. Model IDs are configuration values, and changing one requires re-running the evaluation. At the time of writing, Flash-Lite models cost about USD 0.25–0.30 per million input tokens.
5. **Safety check as its own first call.** The photo is classified before extraction, with structured output: allowed, or blocked with an FR-091 category. This keeps the order that FR-092 requires, means a blocked photo never reaches extraction, and keeps each prompt to one job; the extra call costs a fraction of a US cent. If Gemini's own safety filters refuse the request or the response, that counts as a block, with the matching category or `OTHER`. An error or timeout is not a block: the analysis fails and is not counted (FR-025).
6. **Extraction output:** structured output with a JSON schema. Gemini returns boxes as `[ymin, xmin, ymax, xmax]` from 0 to 1000; the adapter converts them to the 0–1 values stored in the data model, and the `vocabulary` module applies the item rules (AIR-003, AIR-004). The image size sent to the model is chosen with the evaluation set, at most the prepared photo (V18). Boxes are relative, so resizing does not move them.
7. **Tutor:** tool calling with the three read-only tools of the [AI tutor flow](../../flows/ai-tutor.md#2-tools), streamed to the learner, with at most 5 tool rounds and an overall time limit of 30 seconds, both configurable (`AI_TUTOR_MAX_TOOL_ROUNDS`, `AI_TUTOR_TIMEOUT_MS`). The limit covers the whole reply rather than each call, so slow lookups cannot multiply the wait. The tutor's model is its own setting (`GEMINI_TUTOR_MODEL`) and defaults to a full Flash model rather than Flash-Lite: a model that skips its tools invents the learning history FR-075 forbids, and the evaluation set decides whether a cheaper one passes. Exceeding either bound, or a reply with no text in it, fails the message, which is then released rather than counted (FR-071).
8. **Data sent:** photos only to the safety check and the extraction; for the tutor, only its instructions, recent messages, and tool results; never email addresses, display names, or photos (AIR-006). The Privacy Policy names Google as a processor of photos and tutor messages.
9. **Records and evaluation:** every call is recorded in `ai_calls` (AIR-007). The evaluation set runs as a separate command before launch and before any model change, with a paid key, not in pull-request CI.

## Consequences

- LanguZe stays an adult product while Gemini is its provider. Serving teenagers later needs a provider whose terms allow minors, and that provider must pass the same evaluation set, including box accuracy. Thanks to the AI interface, that is a new adapter rather than a rewrite.
- A Google Cloud billing account is required, with a budget alert. Rough cost per photo analysis (two calls) is well under one US cent, and per tutor message about a tenth of a cent; daily limits cap the total (NFR-017), and `ai_calls` shows the real figures.
- A safety check that blocks harmless photos would unfairly count toward suspensions (FR-093, V15). The evaluation set therefore includes everyday objects that can look risky, such as kitchen knives, medicine, and alcohol bottles, which must pass (SRS 5.1), and admins can lift wrongful suspensions (FR-105).
- A general AI safety check is not a specialized detector for child sexual abuse material. The legal handling of suspected illegal material stays on the pre-launch check list (SRS 3.10).
- Gemini model versions change often; IDs are pinned in configuration, and upgrades are deliberate, with an evaluation run.
