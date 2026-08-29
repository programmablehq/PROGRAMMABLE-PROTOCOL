# 09. Bounded Session V1 state machine

- Status: Draft
- Classification: Normative
- Scope: Portable
- Spec ID: `programmable-protocol/0.1.0-draft.1`

## Purpose

`BOUNDED_SESSION_V1` permits one atomic Envelope to use ordered Engine or
profile-component calls, realized observations, and temporary protected
obligations without granting a proposer ambient Core authority. This document
defines portable state-machine meaning. A native binding defines call bytes,
storage, signatures, gas or compute limits, and rollback mechanics.

**[SESSION-001]** A bounded session MUST remain inside one atomic Envelope. It
MUST NOT be paused, resumed, or completed by a later transaction, instruction,
or Envelope. Any required failure reverts every Core state transition,
protected movement, obligation update, assessment update, required Engine state
transition, and Receipt belonging to the session.

## Session descriptor and identifiers

Before the first protected movement, Core authenticates one immutable Session
Descriptor containing at least:

- Core Deployment and Constitution IDs;
- Envelope ID;
- one replay-safe native occurrence ID or nonce;
- the ordered list of distinct Authorization Scope IDs used by the Envelope;
- the ordered participant descriptors;
- the ordered target table; and
- the portable resource limits selected by the binding profile.

A participant descriptor binds one `participant_id`, Market ID, effective
Engine Revision ID, the exact participating Liquidity Domain Revision IDs, and
the exact protected profile component revision/profile tuples admitted for that
participant. It also binds zero or more temporary-obligation admission tuples.
Each such tuple fixes one Authorization Scope, Domain Revision, Asset Profile,
native asset, obligated actor, protected return recipient, and maximum amount.
An Engine target descriptor binds a call-slot `target_id` to that participant's
exact effective Engine Revision. A protected profile component target binds a
call-slot `target_id`, exact component revision, selected profile, and
`IMMUTABLE_CORE_DEPLOYMENT_PIN` authority source. The portable Constitution
selects this authority policy; the immutable Core deployment pins the native
component. Target kinds in V1 are `ENGINE` and
`PROTECTED_PROFILE_COMPONENT`. Every target also binds allowed proposers and
phases. A Session Context pairs the derived `session_id` with that Session
Descriptor; `session_id` is not a field of the descriptor it identifies.

**[SESSION-002]** The native binding MUST derive `session_id` from its canonical
encoding of the complete authenticated Session Descriptor, which already
includes the replay-safe native occurrence identity. It MUST NOT derive it from
an Engine-selected display identifier, transaction hash alone, or signature
bytes. Core MUST reject a Session Context whose supplied `session_id` does not
equal that derivation.

**[SESSION-003]** Participant, target, Scope, Liquidity Domain Revision, Market,
Engine Revision, Asset Profile, native asset, observation, protected Effect
occurrence, and obligation-key identities are distinct. A binding MUST NOT
substitute one for another or accept an unqualified address, account, or name
where an effective revision or profile-bound identity is required.

**[SESSION-004]** Every participant ID and target ID in one Session Descriptor
MUST be unique, and neither namespace may use the reserved
`programmable.core` identifier. Every Engine target MUST resolve to exactly one
authenticated participant and that participant's exact Engine Revision. Every
protected profile component target MUST resolve to one exact participant-listed
component revision/profile tuple and immutable Core-deployment-pinned authority
source. A temporary-obligation opening Effect MUST resolve to one exact
participant-listed temporary-obligation admission tuple. An
undeclared, wrong-revision, aliased, name-only-trusted, or caller-selected target
fails before its first call or protected movement.

## Proposers and ordered targets

A proposer supplies a Segment Proposal containing its claimed prior digest,
ordered targets, payload, and requested protected operations. Core authenticates
that proposal, executes admitted work, creates realized observations, and alone
constructs the normalized Segment Record that commits the result. A proposer can
be `programmable.core` or one authenticated participant named by the Session
Descriptor.

**[SESSION-005]** Core MUST accept an Engine-supplied Segment Proposal only as
the authenticated return of the exact proposer participant in the active session
and phase. A submitter, router, callback caller, forwarded return, or matching
identifier MUST NOT impersonate the proposer.

Each Segment Record contains an ordered `target_ids` array. In V1 each target ID
is a preauthenticated call slot and may be consumed once across the session.
Multiple calls to one Engine Revision use distinct target IDs. A future repeated
call profile would require an explicit profile ID, limits, and native vectors;
none is defined here.

**[SESSION-006]** Core MUST execute or account for targets in the exact committed
order. Every target call slot MUST be declared, previously unconsumed, permit
the authenticated proposer and current phase, and use the exact effective
Engine Revision or protected profile component selected by the Constitution,
immutable Core deployment, Market, Liquidity Domain Revision, and Authorization
intersection. A protected profile component admission binds the exact component
revision and selected component profile as one tuple; admitting the revision
alone does not admit another profile exposed by the same component. No segment
may introduce a generic call target, delegate, approval, signer, or vault
authority.

## Phases and transitions

The portable phases are:

- `AUTHENTICATED`: identities, Authorizations, admissions, and maxima are bound;
  no protected movement has occurred before the first admitted segment;
- `ACTIVE`: ordered segments may call admitted targets, create realized
  observations, and open or close temporary obligations;
- `RECONCILING`: no new target call, protected movement, observation, or
  obligation is permitted; Core verifies the already settled accounting,
  limits, assessment funding, and zero remaining obligations;
- `FINAL_CHECKPOINT`: all untrusted calls are complete and Core binds the final
  checkpoint record;
- `COMMITTED`: the Receipt and all required state have atomically committed; and
- `REVERTED`: the attempt failed and none of its required state committed.

The valid successful transition graph is:

```text
AUTHENTICATED -> ACTIVE
AUTHENTICATED -> RECONCILING
ACTIVE        -> ACTIVE
ACTIVE        -> RECONCILING
RECONCILING   -> FINAL_CHECKPOINT
FINAL_CHECKPOINT -> COMMITTED
```

`REVERTED` is a terminal failure result reachable from any non-committed phase.
It is not a partially committed session state.

**[SESSION-007]** A Segment Record MUST consume the next strictly increasing
zero-based segment ordinal and name the actual current and proposed next phase.
Core MUST reject a skipped, repeated, reordered, stale, or phase-incompatible
segment before applying its protected operations.

Segment work is evaluated under `phase_before`; the phase transition is the last
operation committed by that Segment Record. The final `ACTIVE` segment may
therefore perform its admitted calls and movements, close obligations, derive
and fund or otherwise settle the Protocol Assessment, and then transition to
`RECONCILING`. A direct `AUTHENTICATED -> RECONCILING` transition is valid only
for an empty session with no target call, protected Effect, Observation,
obligation operation, protected movement, observed bytes, or target-return
bytes.

**[SESSION-008]** Once `RECONCILING` begins, it and `FINAL_CHECKPOINT` MUST NOT
perform a new untrusted target call, protected asset movement, Effect,
Observation, or obligation operation. Transition to `RECONCILING` is valid only
after the final active work, assessment settlement, and zeroing of every
obligation. The final checkpoint verifies those settled digests; it does not
create the settlement it claims to verify.

## Segment Records and observations

A normalized Segment Record contains:

- session ID and segment ordinal;
- phase before and phase after;
- authenticated proposer ID;
- ordered target IDs;
- a `segment_payload_digest` for the authenticated proposer payload;
- a distinct `effect_proposal_digest` for the canonical proposed protected
  Effect fields before Core derives occurrence IDs;
- ordered protected Effect occurrence IDs;
- the complete normalized temporary-obligation opening Effect records used by
  this segment;
- ordered Core-created observations;
- ordered obligation operations;
- exact portable resource use; and
- a Core-derived statement of whether any protected movement occurs.

A Segment Record that enters `RECONCILING` also contains one terminal settlement
record. It states that assessment funding is `SETTLED` and binds the final
obligation-state, protected-accounting, and assessment-state digests. The Final
Checkpoint Record must repeat those three digests exactly.

**[SESSION-009]** A Segment Record MUST bind normalized Core-observed facts, not
only proposer-supplied nominal values. Its order is semantic: reordering targets,
Effects, observations, or obligation operations produces a different record and
transcript digest. `segment_payload_digest` and `effect_proposal_digest` are
different commitment roles and MUST NOT be substituted. Protected Effect
occurrence IDs are unique across the whole session. `protected_movement` is true
exactly when the normalized record contains a protected Effect occurrence,
protected Observation, or obligation operation. If Observations exist,
`observed_bytes` MUST be positive.

Every temporary-obligation opening Effect record binds its Effect occurrence
ID, the `programmable.effect.temporary_obligation_open.v1` type, exact called
Execution Target and participant, Authorization Scope, Domain Revision, Asset
Profile, native asset, obligated actor, protected return recipient, and realized
gross debit. It is not a second proposer assertion: Core constructs it from the
already validated protected Effect occurrence and realized protected movement.

Every Observation binds one observation ID, producing Core, source target,
observation kind, Evidence Class, and value digest. Protected observations also
bind the exact source actor, destination, participating Liquidity Domain
Revision, Asset Profile, native asset, and amount. An opaque result may bind
authenticated external dependency IDs. V1 observation kinds are:

- `PROTECTED_GROSS_OUTFLOW`;
- `PROTECTED_GROSS_RETURN`;
- `PROTECTED_SPENDABLE_RETURN`;
- `OPAQUE_TARGET_RESULT`; and
- `STATE_CHECKPOINT`.

The field sets are closed by kind. A protected observation has
`PROFILE_VERIFIED` evidence and all protected provenance fields. An opaque
target result has `ENGINE_ATTESTED` evidence and has no protected amount or
asset fields. A state checkpoint has only checkpoint fields and one supported
Evidence Class. V1 has no `UNSUPPORTED` Evidence Class.

**[SESSION-010]** Only Core may create a session Observation after authenticating
the native source and destination and applying the selected profile. Its source
target must be one call slot consumed in the same segment, and a protected
Observation Domain Revision must be admitted for that target's participant. A
proposer-supplied amount, return value, event, or pre-call balance is not a
realized Observation. An opaque result remains `ENGINE_ATTESTED`; naming an
external dependency does not create a provenance or verification class.

**[SESSION-011]** Observation IDs MUST be unique inside the session. A protected
return amount allocated to obligation closure MUST be backed by an exact
profile-verified Observation and MUST NOT be allocated more than once.

## Rolling transcript digest

Portable vectors use JSON Canonicalization Scheme (RFC 8785), SHA-256, UTF-8,
and raw 32-byte prior digests. Identifier strings inside the records remain
opaque semantic values; this digest does not replace native identity validation.

The initial digest is:

```text
H0 = SHA-256(
  UTF8("programmable:bounded-session:v1:init") || 0x00 ||
  JCS(session_context)
)
```

For normalized Segment Record `Si`, in strictly increasing ordinal order:

```text
H(i+1) = SHA-256(
  UTF8("programmable:bounded-session:v1:segment") || 0x00 ||
  RAW32(H(i)) || 0x00 || JCS(Si)
)
```

For Final Checkpoint Record `F`:

```text
Hfinal = SHA-256(
  UTF8("programmable:bounded-session:v1:final") || 0x00 ||
  RAW32(Hlast) || 0x00 || JCS(F)
)
```

Digests are rendered as `sha256:` followed by 64 lowercase hexadecimal
characters.

**[SESSION-012]** Before executing a Segment Proposal or constructing a Final
Checkpoint Record, Core MUST compare its claimed prior digest with the current
rolling digest. A stale, skipped, substituted, or replayed proposal fails before
its target call or protected movement. After successful segment execution, Core
constructs the Segment Record and advances the digest. The final Receipt binds
`Hfinal`.

**[SESSION-013]** Native authorization and settlement MUST bind native canonical
bytes defined by the binding. The portable JSON transcript algorithm is a
cross-runtime conformance artifact and normalized evidence format; Core MUST NOT
trust portable JSON supplied by an Engine as native authorization.

## Temporary obligations

An Obligation Key Descriptor contains:

- session ID;
- unique obligation-key ID;
- the exact opening protected Effect occurrence ID;
- Authorization Scope ID;
- Liquidity Domain Revision ID;
- Asset Profile ID and native asset ID;
- obligated actor ID;
- authenticated return recipient ID;
- return condition, either `GROSS_AT_LEAST` or `SPENDABLE_AT_LEAST`; and
- a close-by segment ordinal.

The obligation state is `UNSEEN`, `OPEN`, `PARTIALLY_CLOSED`, or `CLOSED`, with
non-negative `opened_amount`, `closed_amount`, and `remaining_amount`.

**[SESSION-014]** `OPEN` creates one previously unseen Obligation Key from one
fresh protected temporary-outflow Effect occurrence listed in the same segment.
The occurrence MUST resolve to exactly one complete opening Effect record, and
that record MUST resolve to the called target's participant and one exact
temporary-obligation admission tuple. Its Scope, Domain Revision, Asset Profile,
native asset, obligated actor, return recipient, and gross debit MUST equal the
Obligation Key and opened amount field for field. The gross debit MUST NOT exceed
the admission's maximum amount.
The opening Observation must bind an outflow from the exact protected return
recipient to the exact obligated actor, under the key's admitted Domain
Revision, Asset Profile, and native asset. The opened amount equals the
profile-observed gross outflow. The key's Scope and Domain Revision must be in
the Session Descriptor and source participant. Every opening Effect record MUST
be consumed by exactly one `OPEN`; an omitted, orphaned, substituted, or reused
record rejects, including after closure.

**[SESSION-015]** `CLOSE` names one exact open Obligation Key, one exact
profile-verified return Observation, and one positive allocated amount. That
Observation must bind a return from the obligated actor to the return recipient
and match the key's Domain Revision, Asset Profile, native asset, and gross or
spendable condition. A valid partial closure updates:

```text
closed_amount    = closed_amount + allocated_amount
remaining_amount = opened_amount - closed_amount
```

An over-closure, unsigned underflow, zero allocation, duplicate allocation, or
closure after the key's deadline fails the complete session.

**[SESSION-016]** Value observed for one Obligation Key MUST NOT net, cancel, or
close another key implicitly, even when Liquidity Domain Revision, asset,
actor, or recipient are equal. One observed return may be divided across keys
only through explicit, non-overlapping allocations whose sum does not exceed
that Observation and each of whose key predicates independently matches.

**[SESSION-017]** Every Obligation Key MUST be `CLOSED` with zero remaining
amount before transition to `RECONCILING`. An obligation cannot become a
persistent liability, cross-Envelope debt, reusable approval, delegate, signer,
or vault authority.

## Resource limits

Portable Resource Limits contain maxima for segments, target calls, protected
Effects, distinct obligation keys created, observations, total observed bytes,
and copied target return bytes. Native bindings may add stricter limits for
calldata, accounts, gas, compute, memory, or other runtime resources.

**[SESSION-018]** Before the first protected movement, Core MUST validate the
Session Descriptor, target table, declared maxima, and statically known work
against the selected binding profile. An unsupported maximum or unbounded list
fails before movement.

**[SESSION-019]** Before each segment's first target call or protected movement,
Core MUST prove that cumulative use plus a binding-validated upper bound for the
proposed segment plus the binding-defined terminal validation reserve fits every
limit. Dynamically sized input, observation, or return data MUST be bounded
before it is copied or used. A target cannot consume the reserve needed to
reconcile balances, close the phase safely, compute the assessment, write
required state, and revert consistently.

The declared `target_calls`, `protected_effects`, `obligation_keys_created`, and
`observations` values equal the corresponding normalized record counts.
`observed_bytes` and `return_bytes` are exact Core-runtime-measured copied byte
counts. Core MUST derive them from the bytes actually copied and MUST NOT accept
a proposer-declared approximation or merely test that they are nonzero. A record
without Observations has zero `observed_bytes`; a record with one or more
Observations has a positive value.

The portable conformance schema supplies `measured_copied_bytes` beside each
Segment Record as an independent test oracle with measurement source
`CORE_RUNTIME`. It is not part of the rolling transcript. A conforming evaluator
MUST require the record's `observed_bytes` and `return_bytes` to equal those
independent measurements exactly before applying cumulative limits.

## Final checkpoint and commitment

The Final Checkpoint Record contains the session ID, transition from
`RECONCILING` to `FINAL_CHECKPOINT`, final participant checkpoint rows,
obligation-state digest, protected-accounting digest, Protocol Assessment state
digest, and a pre-final Receipt-payload digest. That Receipt preimage excludes
the computed final transcript digest and any Receipt ID derived from it, so the
checkpoint is not circular. Every participant checkpoint states its Evidence
Class.

**[SESSION-020]** Core MUST construct the Final Checkpoint Record only after the
last untrusted target call, every protected movement, and the terminal
assessment settlement have completed in the final active segment, or in the
empty direct transition. The terminal settlement and Final Checkpoint
obligation, protected-accounting, and assessment digests MUST match exactly.
Reconciliation and final checkpoint construction are movement-free. No later
untrusted call or protected movement may occur before commit.

**[SESSION-021]** A participant-supplied state digest remains
`ENGINE_ATTESTED` unless Core or an exact accepted profile independently proves
the represented state. Recording it after callbacks proves checkpoint order,
not arbitrary Engine-state truth. The portable bounded-session vector schema
therefore admits only `ENGINE_ATTESTED` participant checkpoints. A native
binding may test a stronger Evidence Class only in a binding-owned profile that
represents and independently verifies the exact Core or profile proof.

**[SESSION-022]** Commit is valid only when the final transcript digest, Receipt
payload, replay and fill state, cumulative assessment state, participant and
Liquidity Domain Revision state bound by the protected-accounting digest, and
all required native postconditions agree. Otherwise the session result is
`REVERTED`.

## Failure codes and vectors

The portable vector set uses these stable failure codes:

- `invalid_phase_transition`;
- `invalid_segment_ordinal`;
- `unauthorized_proposer`;
- `unknown_or_unauthorized_target`;
- `target_revision_mismatch`;
- `target_component_admission_mismatch`;
- `target_call_reused`;
- `transcript_mismatch`;
- `resource_limit_exceeded`;
- `invalid_observation`;
- `domain_or_scope_outside_session`;
- `protected_movement_mismatch`;
- `effect_occurrence_reused`;
- `obligation_key_reused`;
- `obligation_key_mismatch`;
- `obligation_overclose`;
- `obligation_deadline_exceeded`;
- `obligation_remaining`;
- `terminal_settlement_invalid`; and
- `final_checkpoint_invalid`.

**[SESSION-023]** A conforming implementation claiming `bounded-session-v1`
MUST reproduce every applicable result in
[`../vectors/bounded-session-v1.json`](../vectors/bounded-session-v1.json) and
MUST reject every negative vector before the vector's prohibited movement or
commit point. Every case in that suite has the exact ordered profile set
`[portable-core-v1, bounded-session-v1]`; the suite is not part of a
`portable-core-v1`-only conformance claim.
