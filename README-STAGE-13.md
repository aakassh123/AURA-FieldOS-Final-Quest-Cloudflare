# AURA FieldOS — Stage 13: AURA Quest & Rewards

This stage adds a production-oriented gamification layer on top of the existing Stage 12 cumulative product.

## Product behavior

- Tasks are classified as General, Call, Follow-up, Meeting, Demo, Proposal, Visit or Other.
- Completing a meaningful task can award XP and optionally unlock a company-approved physical reward.
- Verified customer visits can award a separate XP/reward rule.
- Employees see level, XP, streak, unlocked rewards and redemption codes.
- Managers can create reward catalog items and reward rules from the Quest & Rewards page.
- Reward catalog supports a budget value and optional stock limit.
- Reward claims are one-time and server-generated; the browser cannot create XP or reward claims.
- Reward rules are company-scoped and protected by RLS.

## Example

A company can configure:

**Meeting completed → +60 XP → Refreshment Choice**

The seeded Refreshment Choice is described as:

> Choose one small reward: a cold drink up to ₹20 OR 2 samosa.

This is intentionally a small, tangible reward rather than a casino-like random prize.

## Anti-gaming principles

- Completing the same task twice does not grant XP twice.
- Reward claims have a unique source key.
- Verified visit rewards require the visit to be GPS verified.
- Reward generation happens inside PostgreSQL security-definer functions after authorization checks.
- The product does not reward unsafe driving speed or location manipulation.
- Companies control reward catalog, XP rules and stock/budget limits.
