# 08. Protected effect algebra

- Status: Draft
- Classification: Normative
- Scope: Portable
- Spec ID: `programmable-protocol/0.1.0-draft.1`
- Profile ID: `programmable.protected-effects.v1`

## Purpose

The protected effect algebra is the closed authority interface of Core major
V1. It describes product-neutral authority atoms, not market products. Engines
may define arbitrary actions and state machines by proposing combinations of
these atoms and by using their own opaque state and authority.

**[EFFECT-001]** An identifier in the `programmable.capability.*` or
`programmable.effect.*` namespace is valid only when an exact Protocol release
defines it and the selected Constitution and Core major implement it. Unknown
required protected identifiers MUST reject before movement. An Engine-defined
identifier never gains protected meaning because its bytes resemble a built-in
identifier.

## Common effect envelope

Every proposed protected Effect is associated with:

- one canonical Effect type ID;
- one Core-derived occurrence ID;
- one Principal Authorization Scope where Principal authority is consumed;
- one Execution Target, segment sequence, and ordinal;
- exact affected Principal, Liquidity Domain Revision, native asset, Asset
  Profile, right, or obligation identities as applicable; and
- exact amounts and recipient constraints in the native canonical encoding.

**[EFFECT-002]** Core first computes a proposal digest over canonical proposed
Effect fields excluding occurrence IDs and every Core-derived field. It then
derives each occurrence ID from the Core Deployment, Constitution,
Authorization Scope, Envelope or session identity, that proposal digest,
segment sequence, effect ordinal, type ID, and affected native identities.
Engine display IDs are metadata only. The later transcript may include the
derived occurrence IDs. Duplicate or aliased occurrences reject.

Native bindings define field bytes and hashing. They MUST preserve the semantic
fields above and publish native vectors.

An opaque Engine effect is not a protected Effect. Engines may return arbitrary
opaque outputs and commit them to Engine state or Receipt evidence, but those
bytes never select Core authority or enter this closed list. Product freedom is
outside the protected plane; authority closure is inside it.

## Engine-proposable protected Effects

### Asset move

Identifiers:

- Capability: `programmable.capability.asset_move.v1`
- Effect: `programmable.effect.asset_move.v1`

An Asset Move transfers one exact native asset under one Asset Profile from an
authenticated source to an authorized destination. The source class is
`PRINCIPAL`, `LIQUIDITY_DOMAIN`, or `SESSION_ESCROW`. The destination class is
`PRINCIPAL`, `LIQUIDITY_DOMAIN`, `EXECUTION_RECIPIENT`, `SESSION_ESCROW`, or an
exact profile-defined sink.

The proposal binds source and destination identities, gross source debit,
minimum spendable destination credit, profile operation, and external
withholding ceiling. Core derives assessment classification and accounting; an
Engine cannot set them.

**[EFFECT-003]** An Asset Move is valid only when one exact type-specific
Capability covers its native source, source and destination Domain Revisions,
recipient, native asset, Asset Profile, maximum gross debit, minimum spendable
credit floor, external withholding ceiling, Target, phase, and Scope. A higher
minimum credit is a stricter proposal; a lower minimum or higher withholding is
not covered. Core verifies actual debit and spendable credit under the Asset
Profile. A move does not grant an allowance, operator, signer, delegate, vault
role, or reusable authority to its destination.

### Core rights delta

Identifiers:

- Capability: `programmable.capability.core_rights.v1`
- Effect: `programmable.effect.core_rights_delta.v1`

A Core Rights Delta increases, decreases, or transfers a profile-defined
Core-native claim. It binds the rights profile, right identity, authenticated
subject and recipient, direction, amount, backing Domain Revisions, and exact
custody and exit profile.

**[EFFECT-004]** A Core Rights Delta requires one type-specific Capability that
binds its rights profile, right, authenticated subject, recipient, direction,
maximum amount, exact ordered backing Domain Revisions, custody profile, and
exit profile. It MUST NOT create an unbacked asset claim, change another rights
profile, infer entitlement from Engine state, or promise an engine-independent
exit that Core cannot execute from canonical state. An Engine-owned position
remains opaque and does not use this Effect.

### Profile operation

Identifiers:

- Capability: `programmable.capability.profile_operation.v1`
- Effect: `programmable.effect.profile_operation.v1`

A Profile Operation invokes one finite operation defined by an exact Asset,
rights, custody, settlement, or exit profile. Examples include a supported
native mint, burn, freeze-state check, or receiver acceptance operation. The
profile defines the complete target class, parameters, preconditions,
postconditions, protected profile component revision, authority, and evidence.

A **protected profile component** is the exact native component revision that
implements such a finite operation with Core-conferred authority. The portable
Constitution selects the component policy and interface class; an immutable
Core Deployment pins the native component identity and revision. A contract,
program, callback, dependency, or target does not become protected merely by
using a profile-shaped name.

**[EFFECT-005]** A Profile Operation is not arbitrary calldata. Its
type-specific Capability binds the exact profile, operation ID, operation
target, immutable Core-Deployment-pinned protected profile component revision,
and canonical
parameters digest. Core MUST reject an unknown or changed field, target,
parameter shape, component revision, authority source, or postcondition. A new operation
that requires authority absent from the deployed Core requires a new Core
major.

### Temporary obligation open

Identifiers:

- Capability: `programmable.capability.temporary_obligation.v1`
- Effect: `programmable.effect.temporary_obligation_open.v1`

This Effect is available only in `BOUNDED_SESSION_V1`. It follows and pairs one
exact Asset Move occurrence out of protected custody in the same segment. The
obligation binds that opening Effect occurrence, session, opening segment and
ordinal, close-by segment ordinal, source Domain Revision, asset and profile,
obligated actor, return destination, gross or spendable return condition, and
the phase before which closure is mandatory. Its Capability binds every one of
those fields and a maximum amount. The value
`must_be_closed_before_phase: RECONCILING` is a boundary condition: it never
permits an obligation operation inside `RECONCILING`.

**[EFFECT-006]** The paired Asset Move MUST precede the obligation occurrence,
deliver the same profile and asset amount to the obligated actor, and debit the
exact return destination. Temporary obligations cannot net across unlike keys.
A profile may permit partial closure, but every closure binds the obligated
source actor, return destination, Domain Revision, Asset Profile, native asset,
return condition, observed amount, and segment. Core records each observed part
and exact remainder. A closure before opening or after the close-by segment
rejects. Every remainder MUST be zero before reconciliation.

## Core-derived and observed Effects

The following Effects cannot be made authoritative by an Engine proposal:

| Effect ID | Meaning |
| --- | --- |
| `programmable.effect.temporary_obligation_close.v1` | Core-observed closure of a named temporary obligation |
| `programmable.effect.authorization_state_advance.v1` | replay, fill, cancellation, expiry, and cumulative-limit state committed by Core |
| `programmable.effect.domain_revision_commit.v1` | authenticated creation or transition to one exact Liquidity Domain Revision |
| `programmable.effect.domain_accounting_commit.v1` | Domain-local accounting reconciled to protected physical effects |
| `programmable.effect.protocol_assessment.v1` | ProtocolAssessmentV1 basis, debit, funding, and liability derived by Core |
| `programmable.effect.receipt_checkpoint.v1` | final canonical evidence checkpoint for a committed Envelope |

**[EFFECT-007]** Core derives these Effects from authenticated input, canonical
state, and observed settlement. An Engine may request behavior that causes one,
but cannot choose its authoritative amount, classification, sequence, evidence
class, or recipient.

## Capability intersection

The V1 Capability identifiers are:

- `programmable.capability.asset_move.v1`;
- `programmable.capability.core_rights.v1`;
- `programmable.capability.profile_operation.v1`;
- `programmable.capability.temporary_obligation.v1`;
- `programmable.capability.authorization_state.v1`; and
- `programmable.capability.domain_revision.v1`.

The last two authorize exact Core-managed lifecycle changes; they do not grant
an Engine writable canonical state.

**[EFFECT-008]** A Capability is the most restrictive intersection of its
Constitution type, native binding support, Market policy, effective Engine
Revision, Domain Revision admission, selected profiles, and every affected
Principal Authorization. Its V1 representation is type-specific rather than a
generic recipient-and-amount grant: every authority-bearing Effect field is
either bound exactly or bounded in the documented restrictive direction. Empty
intersection rejects. Capability bounds are cumulative and consumed by gross
effects before any external call that could use them.

## Plan and transcript rules

An `ATOMIC_PLAN_V1` Engine returns a bounded ordered list of proposed Effects.
A `BOUNDED_SESSION_V1` Engine returns one bounded segment proposal at a time;
Core appends proposed Effects, actual observations, obligation changes, and
checkpoints to the ordered session transcript.

**[EFFECT-009]** Core MUST reject duplicate Effect occurrences across the whole
Envelope or session, duplicate segment-and-ordinal positions, non-canonical
ordering, unknown required types, invalid aliases, conflicting source use,
uncovered fields or recipients, arithmetic overflow, and any plan or segment
exceeding its preauthenticated resource maxima.

Effects are evaluated gross. Core does not first net unrelated debits and
credits to hide authority use, external taxes, intermediate obligations, or
Protocol Assessment basis. A profile may define one exact aggregate operation
before occurrence identity is assigned.

## Validation and commitment order

For each Effect set, Core performs the following semantic order:

1. authenticate identities, revisions, profiles, Scope, Target, phase, and
   transcript position;
2. derive Capability intersection and resource maxima;
3. validate occurrence uniqueness, aliases, amounts, recipients, and
   preconditions;
4. derive assessment and state-transition ceilings from authorized gross
   amounts, then reserve the maximum permitted accounting and obligation state;
5. reject any reservation or resource bound that cannot be satisfied before
   the first protected external movement;
6. execute exact profile operations and observe actual results;
7. derive the final Protocol Assessment from Core-verified gross debits and
   valid Refunds, fund or otherwise settle it, and reconcile physical custody,
   accounting, rights, assessment funding, and obligations against the
   reservation while execution is still active;
8. enter reconciliation only after every movement and assessment settlement is
   complete, then verify the movement-free terminal state;
9. authenticate any required final Engine checkpoint; and
10. emit the final Receipt checkpoint and atomically commit.

**[EFFECT-010]** A required failure at any step rejects the complete Envelope.
No Engine or binding may reorder a protected external effect before the
authorization, Capability, alias, amount, recipient, assessment, and resource
checks that make that effect safe.

## Explicit exclusions

The protected algebra contains no `swap`, automated market maker (AMM), curve,
auction, order, launch, game, non-fungible token (NFT) sale, oracle-price,
bridge, or strategy Effect. Those meanings belong to Engines, profiles, or
named external dependencies.

**[EFFECT-011]** Core evidence may state which protected atoms committed. It
MUST NOT infer an Engine's product meaning from their combination.

The algebra also contains no generic external call, generic cross-program
invocation, arbitrary storage write, reusable approval, or universal signer.

**[EFFECT-012]** Adding such a primitive is not a compatible extension. It would
change the protected authority model and requires a new Constitution and Core
major with its own security evidence.
