# 0002: Core-mediated protected effects

- Status: Accepted
- Date: 2026-08-29

## Context

An arbitrary Engine must be able to define market economics without receiving
ambient authority over users, Core custody, Protocol Assessment state, or
unrelated Liquidity Domains. A manifest cannot sandbox arbitrary code.

## Decision

Use two effect planes:

- a closed, product-neutral protected plane committed only by Core under exact
  Capabilities; and
- an arbitrary opaque plane owned by Engines and external systems whose meaning
  is not promoted above its evidence class.

Core derives authority from authenticated Authorization, Market policy, Domain
admission, Asset Profiles, Engine Revision, and Constitution. An Engine plan
cannot grant itself authority.

## Alternatives

- A universal Engine delegate or vault signer was rejected because one Engine
  defect could become a protocol-wide custody defect.
- A fixed product or action enum was rejected because it would limit future
  market mechanisms.
- Treating all Engine effects as Core-verified was rejected because arbitrary
  economic meaning is not objectively provable.

## Security consequences

The guarantee is containment, not Engine safety. A malicious Engine can still
harm participating Principals and Domains within their admitted rules. It
cannot receive protected authority over non-participating Domains.

## Compatibility consequences

An Engine that requires ambient Core authority is not compatible with this
model. Engines remain free to emit opaque effects in their own namespace, but
only the closed protected-effect vocabulary can request Core-mediated custody,
authorization, accounting, or Domain changes. Adding a protected effect changes
the Core authority surface and follows the Protocol versioning rules.

## Affected artifacts

- `spec/01-semantic-model.md`
- `spec/02-execution-and-authority.md`
- `spec/06-security-properties.md`
- `spec/08-protected-effect-algebra.md`
- both native binding specifications and their conformance evidence
