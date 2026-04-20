# Readily — Policy Remediation & Role Management PRD

**Version 1.0 — April 20, 2026**

---

## Overview

Readily currently surfaces compliance gaps but leaves remediation entirely to the officer. This closes the loop: when a question fails or partially fails, the AI drafts a concrete policy patch inline. Officers can expand it, review it, and accept it with one click — immediately re-indexing the patched policy so future audits reflect the change. A user switcher (no login page) lets the demo show multi-role behavior fluidly. Together: Readily becomes a **closed-loop compliance management system**, not just an audit tool.

---

## User Roles

### Compliance Officer (2 demo users)

- Runs audits, reviews results
- Can expand and accept AI-drafted policy patches
- Cannot rollback accepted patches or manage users

**Demo users:** Sarah Chen (existing), Marcus Williams (new)

### Admin (1 demo user)

- All compliance officer capabilities
- Can rollback any accepted patch
- Sees patch history tab in the Policy Library

**Demo user:** Dr. Priya Nair (new)

---

## Prioritized Feature List

Ordered by demo impact. Build top-down; stop when time runs short.

| Priority | Feature | Why it matters |
|---|---|---|
| 1 | **AI policy patch suggestion** (inline, expand/collapse) | The demo's "wow moment" — AI closes the compliance loop |
| 2 | **Accept patch** → patches policy + re-indexes | Shows the system is live, not static |
| 3 | **User switcher** (3 users at top of UI) | Role demo without auth friction |
| 4 | **Role-gated UI** (admin sees rollback; CO doesn't) | Shows the platform thinks about real org structure |
| 5 | **Patch rollback** (admin only) | Credibility: "what if the AI was wrong?" |
| 6 | **Patched badge** in policy library | Visual proof that acceptance did something real |
| 7 | **Re-run audit after patch** | Proves re-indexing actually fixed the fail |
| 8 | **Patch history log** (admin view) | Nice-to-have; skip if time is tight |

---

## User Stories

### Feature 1 — AI Policy Patch Suggestion

**US-1.1** As a compliance officer reviewing a failed question, I want to see a collapsed "Suggested Policy Update" section below the fail verdict so I'm not overwhelmed by AI text I didn't ask for.

**US-1.2** As a compliance officer, when I expand the suggestion, I want to see the current policy excerpt first, then the AI-drafted replacement below it, so I can diff them visually.

**US-1.3** As a compliance officer, I want the AI patch to be specific and minimal — targeting only the clause that caused the failure — not a full policy rewrite.

**US-1.4** As a compliance officer reviewing a partial pass, I want the same expand/collapse pattern so I can see what the AI recommends strengthening.

### Feature 2 — Accept Patch

**US-2.1** As a compliance officer, I want an "Accept Patch" button inside the expanded suggestion so I can apply it with one click.

**US-2.2** As a compliance officer, after accepting, I want the suggestion UI to change state (e.g., "Patch accepted — policy updated") so I have confirmation without leaving the page.

**US-2.3** As any user, I want accepted patches to take effect for the next audit run — if I re-run the same audit, the previously failing question should now pass.

### Feature 3 — User Switcher

**US-3.1** As a demo presenter, I want a user switcher at the top of the UI so I can show role differences without a login page.

**US-3.2** As a presenter switching to the admin user, I want the UI to immediately reflect admin-only capabilities (rollback button, patch history tab).

**US-3.3** As a presenter switching between compliance officers, I want the name and avatar in the user badge to update so the audience sees distinct users.

### Feature 4 — Role-Gated UI

**US-4.1** As a compliance officer, I should see "Accept Patch" but not "Rollback."

**US-4.2** As an admin, I want both "Accept Patch" and "Rollback Patch" on any already-accepted patch.

**US-4.3** As an admin, I want a "Policy Updates" tab in the Policy Library listing every accepted patch, who accepted it, and when.

### Feature 5 — Patch Rollback (Admin Only)

**US-5.1** As an admin, if a compliance officer accepted a bad patch, I want a "Rollback" button that restores the previous policy text.

**US-5.2** As an admin, after rollback, the policy library should reflect the restored text immediately.

### Feature 6 — Patched Policy Badge

**US-6.1** As any user browsing the Policy Library, I want a visual indicator on any policy document that has been AI-patched so I know its history at a glance.

### Feature 7 — Re-run Audit After Patch

**US-7.1** As a compliance officer, after accepting patches, I want to re-run the audit and see previously failing questions now passing.

---

## Data Model Changes

### `AuditQuestion.patchSuggestion` (new optional field)

```typescript
interface PolicyPatch {
  originalText: string;        // The specific clause being replaced
  patchedText: string;         // AI-drafted replacement
  reasoning: string;           // Why this change addresses the gap
  status: "pending" | "accepted" | "rolled_back";
  acceptedBy?: string;         // User displayName
  acceptedAt?: number;         // Unix ms
  rolledBackBy?: string;
  rolledBackAt?: number;
}

// Added to existing AuditQuestion interface:
patchSuggestion?: PolicyPatch;
```

Patch generation is **lazy** — only triggered when the user first expands the suggestion. Evaluation streaming stays fast; no patches are generated for questions the user never opens.

### `PolicyDocument` (new fields)

```typescript
interface PolicyDocument {
  // ...existing fields...
  currentText: string;         // Live text (may differ from original PDF after patching)
  patches: PolicyPatch[];      // Append-only log; last accepted patch wins
  isPatched: boolean;          // Convenience flag for badge rendering
}
```

**Re-indexing on accept:** when a patch is accepted, the server replaces `currentText` for that single document, re-chunks it, and updates its entries in the TF-IDF index. No full re-seed needed.

### `AppState.currentUser` (new client-side state)

```typescript
interface DemoUser {
  id: "sarah" | "marcus" | "priya";
  displayName: string;
  role: "compliance_officer" | "admin";
  avatarInitials: string;
  avatarColor: string;         // Tailwind bg class for visual distinction
}
```

User state lives **client-side only** — no server session. Role checks are pure UI gates. This is a demo.

---

## UI/UX Notes

### Policy Patch Expand/Collapse

The suggestion is a disclosure widget sitting below the existing evidence card on any fail or partial-fail question.

**Collapsed state:**
```
[ ✦ Suggested Policy Update ]  ›
```
Small, secondary text weight. Subtle amber or indigo left-border accent. Chevron rotates on expand.

**Expanded state:**
```
┌─ Current Policy Text ──────────────────────────┐
│ "Staff must complete annual training..."        │
└────────────────────────────────────────────────┘

┌─ Suggested Update ─────────────────────────────┐
│ "Staff must complete annual training and        │
│  quarterly refreshers, with completion          │
│  documented in the HR system within 5           │
│  business days of the session."                 │
│                                                 │
│  Why: The gap was missing documentation         │
│  timeline requirements.                         │
└────────────────────────────────────────────────┘

[ Accept Patch ]   [ Dismiss ]
```

- Neutral-50 background for current policy; green-50 for suggested update
- Natural before/after read without a formal diff viewer

**Accepted state** (replaces buttons):
```
✓ Patch accepted by Sarah Chen · Apr 20, 2026
  [ Rollback ]   ← admin only; hidden for compliance officers
```

### User Switcher

Placed top-right in the header, replacing/augmenting the existing `UserBadge`. Three avatar buttons in a row — clicking one activates that user. Active user gets a ring highlight; others are dimmed.

```
[ SC ]  [ MW ]  [ PN ]
  ↑ active (ring)
```

- Hover tooltip: full name + role
- No dropdown needed — three buttons is scannable and fast to click mid-demo
- When switching to Dr. Priya Nair (admin), a subtle `Admin` role badge appears
- Switcher should not be buried in a menu — visible at all times during the demo

### General UX Principles

- Patch generation shows a spinner inside the expanded panel, not a full-page block
- Accepted patches produce a brief success toast in addition to the inline state change
- Re-running the audit after a patch uses the same "Run Audit" button — no special UI needed; the improvement shows itself

---

## What to Cut / Deprioritize

**Cut entirely:**
- Patch version history log — complexity with no visual payoff in a live demo
- Email/notification system — no real auth, no real email
- Line-level diff viewer — prose paragraphs don't need it; colored blocks are enough
- Bulk accept ("accept all patches") — hides the individual review moment
- Full policy document text viewer — don't start now

**Deprioritize (build only if P1–P4 are solid):**
- Patch history tab in admin view (P8) — describe it verbally if not built
- Confetti on all-pass — still skip it; remediation is the story now

**Don't over-engineer re-indexing.** Re-chunking a single document synchronously on accept is fine for the demo. No queue, no background job.

---

## Open Questions

1. **Pre-generate vs. lazy?** Lazy means a ~3s wait on first expand. Pre-generating patches in the background after evaluation completes would make expand feel instant — worth it if the Gemini call is fast enough.

2. **Partial pass threshold.** What confidence score triggers a suggestion for a passing question? Suggested rule: confidence < 0.75 and verdict = pass → show suggestion; confidence ≥ 0.75 → no suggestion.

3. **Chunk-level patching caveat.** Accepted patches update the 800-token chunk text, not the original PDF. This is fine for the demo but should be called out during the presentation so it doesn't look like a bug.

4. **Marcus vs. Sarah differentiation.** Keep them identical — the CO↔Admin switch is the meaningful role demo. Marcus exists to show the switcher works, not to have distinct features.
