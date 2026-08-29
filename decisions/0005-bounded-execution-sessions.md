# 0005: Support plans and bounded execution sessions

- Status: Accepted
- Date: 2026-08-29

## Context

A single pre-settlement plan is small and reviewable, but it cannot express
temporary protected outflows, flash or just-in-time composition, gross
intermediate paths, or Engine state finalized from realized transfer behavior.
Ignoring this limit would freeze a narrow Core behind a broad programmability
claim.

## Decision

Define two native execution profiles under the same portable authority model:

- `ATOMIC_PLAN_V1` for a complete pre-settlement Effect plan; and
- `BOUNDED_SESSION_V1` for ordered segments and exact temporary obligations
  that must close inside one atomic Envelope.

A temporary recipient receives a bounded asset amount, never a reusable
approval, signer, delegate, or vault authority. Every segment remains inside
the same Principal limits, Domain admission, canonical assessment-group rules,
and Receipt.

## Alternatives

- Supporting only complete plans was rejected as an unnecessary long-term
  expressiveness limit.
- A generic Core arbitrary-call facility was rejected as a confused-deputy and
  custody risk.
- Leaving obligations open across independent transactions was rejected because
  neither runtime provides a safe universal transaction-end settlement hook.

## Security consequences

Bounded sessions add callback, reentrancy, temporary-balance, and denial-of-
service risk. Each binding must implement a native phase lock and exact
obligation ledger, prohibit ambient authority, and revert the complete Envelope
when any obligation or postcondition remains open.

## Compatibility consequences

`ATOMIC_PLAN_V1` and `BOUNDED_SESSION_V1` are explicit execution-profile
claims. Supporting atomic plans does not imply support for bounded sessions. A
Market may require only profiles implemented by its selected Core and binding;
receipts and conformance evidence must identify the profile actually used.

## Affected artifacts

- `spec/01-semantic-model.md`
- `spec/02-execution-and-authority.md`
- `spec/06-security-properties.md`
- `spec/09-bounded-session-state-machine.md`
- EVM and SVM binding specifications
- execution-profile conformance vectors, receipts, and native hostile tests
