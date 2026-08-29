# Conformance vectors

This directory contains deterministic inputs and expected results shared by
native Programmable implementations.

- `protocol-assessment-v1.json` covers accepted and rejected assessment
  arithmetic, grouping, fills, refunds, sponsorship, external withholding,
  overflow, ceilings, and rollback.
- `identifiers-v1.json` locks the RFC 8785 JSON Canonicalization Scheme and
  SHA-256 identities of the example Market Templates.
- `canonical-identifiers-v1.json` covers portable canonicalization and
  Authorization Scope identity, including replay-sensitive and stored-Scope
  inputs.
- `protected-effects-v1.json` covers the closed protected-effect vocabulary,
  Capability intersections, resource bounds, and temporary obligations.
- `bounded-session-v1.json` covers ordered session transitions, transcript
  commitments, exact Core-measured byte accounting, resolved temporary-opening
  Effect provenance, participant admissions, reconciliation, and atomic failure.
- `evidence-v1.json` covers provenance, producer authentication, terminal
  checkpoints, normalized Receipts, dependency disclosure, and coverage
  claims.

Amounts are unsigned base-unit integers encoded as canonical decimal strings.
The repository check treats every expected rejection as a required result, not
as an optional negative test. It dispatches every listed suite through a
registered semantic evaluator and fails closed for an unknown suite.
