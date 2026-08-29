# 02. Execution and authority

- Status: Draft
- Classification: Normative
- Scope: Portable
- Spec ID: `programmable-protocol/0.1.0-draft.1`

## Two effect planes

Programmable does not claim to sandbox arbitrary code. It separates two effect
planes.

### Protected effect plane

Core understands a closed, product-neutral set of authority atoms for its
major. Examples include a bounded Principal debit, a Domain debit or credit, a
supported mint or burn, an accounting commit, a Protocol Assessment, and an
exact profile-defined claim or exit.

**[EXEC-001]** Only Core may commit a protected effect against Core custody,
Principal spend authority, Protocol Assessment vaults, or Core-native
liabilities. No Engine, router, adapter, callback, or external program receives
ambient authority over them.

### Opaque effect plane

An Engine may maintain arbitrary state, call arbitrary external systems with
its own authority, and return arbitrary bytes. Core can bind those bytes to a
Receipt without proving their economic meaning.

**[EXEC-002]** Opaque effects MUST NOT be labeled `CORE_VERIFIED` or be used to
create a Core-native asset, liability, Refund, exit right, or Protocol
Assessment exemption unless an exact accepted profile promotes the effect into
the protected plane.

This separation preserves arbitrary programmability without treating arbitrary
authority as safe.

## Authorization contents

For every affected Principal and asset, a Core-enforced Authorization MUST bind
at least:

- runtime, chain, Core Deployment, and Constitution;
- exact Execution Targets or one exact Core-enforceable target selector,
  including Market and effective Engine Revision bounds;
- the Principal's Authorization Scope and replay nonce or state;
- allowed participating Liquidity Domain Revisions;
- native asset and Asset Profile;
- maximum market-execution gross debit, excluding the Protocol Assessment leg;
- maximum gross Protocol Assessment debit;
- maximum total gross debit;
- maximum external asset withholding for market-execution and assessment legs,
  where a supported profile permits withholding;
- exact credit recipients or a Principal-authorized recipient-selection
  predicate whenever a protected credit can occur;
- required minimum credits where applicable;
- action or Engine payload digest, or an exact bounded authorization for it;
- deadline or non-expiring intent declaration; and
- cancellation and partial-fill rules.

**[AUTH-001]** Core MUST enforce the most restrictive intersection of Principal
Authorization, Domain policy, Market descriptor, Engine Revision, Asset
Profile, and Constitution. A wider Engine plan cannot widen that intersection.

**[AUTH-002]** A submitter MAY be permissionless. Submission authority MUST NOT
become spend, recipient-selection, Domain, fee, or migration authority.

### Sponsored assessment funding

The assessment Principal is the Principal whose protected gross debit creates
the assessment basis. A different fee-funding Principal MAY pay the Protocol
Assessment only when it separately authorizes the exact asset, gross assessment
debit, assessment Principal's Scope, Core, deadline, and immutable Protocol
Collector. The sponsor's own Scope remains independently authenticated and
binds one or more exact sponsored-assessment authorization records. A submitter,
fee payer, or sponsor label is not that authorization.

**[AUTH-003]** Changing a fee-funding Principal MUST NOT change or reset the
assessment group's cumulative basis. The assessment Principal's own debit and
total limits remain enforced even when a sponsor pays the assessment leg.

**[AUTH-004]** Before sponsored movement, Core MUST match the fee-funding
Principal's exact sponsored-assessment record to the assessment Scope,
assessment Principal, Asset Profile, native asset, gross assessment ceiling,
and deployment-pinned Protocol Collector. Sponsor authority for one tuple MUST
NOT fund another tuple or a later assessment above its remaining ceiling.

A binding MAY initially support only self-funded assessment. It must declare
that narrower profile and reject unsupported sponsorship before movement.

## Envelope lifecycle

A Core-mediated Envelope has the following semantic phases. A binding may
combine phases internally but cannot remove their checks.

1. authenticate Core, ordered Execution Targets, effective Engine Revisions,
   participating Domain Revisions, assets, profiles, and all Principal
   Authorizations;
2. derive the exact effective Capability closure;
3. obtain or evaluate the Engine plan or open a bounded execution session in
   the binding-defined callback model;
4. bind the plan or session digest and reject undeclared protected aliases or
   authorities;
5. validate every protected Effect, temporary obligation, user limit, Domain
   rule, conservation rule, and Protocol Assessment group;
6. commit supported protected settlement and only those Engine state
   commitments whose final checkpoint is actually proven;
7. observe funded credits and create only supported liabilities; and
8. emit or persist a canonical Receipt.

**[EXEC-003]** A binding MUST guarantee atomic commit for the Envelope: failure
at any phase commits none of its required Core state, protected asset effects,
Protocol Assessment liabilities, or required Engine state transitions.

Catchable external-call failures, callback return data, and multi-call behavior
are binding-specific. A binding cannot weaken atomicity by treating a required
failed effect as optional after authorization.

## Execution profiles and temporary obligations

The portable model supports two session profiles without prescribing one
shared callback ABI:

- `ATOMIC_PLAN_V1`: the Engine returns a complete protected Effect plan before
  Core settlement; and
- `BOUNDED_SESSION_V1`: one Envelope contains ordered segments, realized
  observations, and temporary protected obligations that all close before
  commit.

`BOUNDED_SESSION_V1` exists for flash or just-in-time liquidity, gross
intermediate paths, multi-segment routing, and Engine state that depends on
realized transfer behavior. A temporary obligation records the exact Liquidity
Domain Revision, asset and profile, gross outflow, obligated actor, deadline
phase, and required gross or spendable return condition.

**[EXEC-004]** Temporary value may leave Core custody only under an exact
Capability and amount bound by every affected Principal and Liquidity Domain
Revision. The recipient receives value, never a reusable approval, delegate,
signer, or vault authority. Every obligation MUST close inside the same atomic
Envelope or the complete Envelope reverts.

**[EXEC-005]** Segments, Markets, routes, callbacks, internal hops, transaction
boundaries, and Envelope identities MUST NOT split one canonical Protocol
Assessment group. Group identity remains the exact tuple defined by
ProtocolAssessmentV1, including Core Deployment, Constitution, Authorization
Scope, assessment Principal, Asset Profile, and native asset. Every stored Fill
using the same tuple resumes its committed cumulative basis. Only a different
Authorization Scope or another field in that tuple creates a different group.

## Engine plan

The Engine plan is product-neutral. It MAY contain arbitrary namespaced action
and opaque-effect identifiers, but each requested protected Effect MUST map to
one exact Core-supported Capability type.

**[EXEC-006]** Core MUST validate the actual native resources and
Core-conferred protected authority it exposes, not only a declared call graph
or manifest. Any protected account, address, token, allowance, signer, writable
state, delegate, callback authority, or alias outside that closure MUST cause
rejection before movement. This does not claim to enumerate external actions an
Engine can perform with authority it owns independently of Core.

**[EXEC-007]** Malformed, missing, stale, forwarded, replayed, or
wrong-revision Engine output MUST fail closed. The binding MUST authenticate the
selected Engine and callback phase before accepting output.

A pre-settlement plan digest proves only the exact Engine response received at
that phase. It is not evidence of final Engine state if a later token, NFT,
driver, or other untrusted callback can mutate the Engine.

**[EXEC-008]** Core may attest a final Engine-state commitment only from a
checkpoint taken after every later untrusted account-bearing call, or when the
binding proves those calls cannot reach or mutate that Engine state. Otherwise
the state claim remains `ENGINE_ATTESTED` and may be stale.

## Conservation and economic meaning

**[SETTLE-001]** For every supported Asset Profile, Core MUST enforce that all
committed protected debits, credits, assessment legs, liabilities, and retained
balances satisfy the profile's exact conservation and observation rules.

Conservation does not prove a fair price. A malicious Engine can conserve value
while proposing an economically destructive exchange that still falls within a
Principal's signed limits.

**[SETTLE-002]** Core MUST enforce limits against gross source debits and
observed spendable credits, not Engine-reported nominal amounts.

## Domain isolation

**[SETTLE-003]** An Envelope MUST name every participating Liquidity Domain
Revision. Core MUST reject any protected effect or alias that can reach a
non-participating Domain Revision.

The guarantee is containment, not safety of participating Domains. A selected
Engine is the economic authorization oracle for each participating Domain
Revision and can harm those Domains within their admitted rules.

## Stored and asynchronous state

An Engine may define orders, auctions, delayed settlement, staged lifecycle
transitions, or other persistent state. Core does not require synchronous swap
semantics.

**[EXEC-009]** Any stored Authorization Scope MUST preserve cumulative use,
cumulative Protocol Assessment basis, replay state, expiry, and cancellation
across fills. A fill, router change, submitter change, Engine callback, or
transaction boundary MUST NOT reset that state.

Core custody that survives an Envelope must bind an exact custody and exit
profile before funds enter it. Profiles are:

- `NO_PERSISTENT_CORE_CUSTODY`;
- `CORE_VERIFIED_ENGINE_INDEPENDENT_EXIT`; or
- `DISCLOSED_ENGINE_DEPENDENT_EXIT`.

**[EXEC-010]** An engine-independent exit claim is valid only for the exact
assets, accounting, authorities, and Asset Profiles that Core can execute
without the Engine or an offchain service. Issuer freezes, token callbacks,
bridges, chain failure, and other disclosed external dependencies can still
block the underlying asset.

## Execution coverage

Every execution surface is classified independently:

- `CORE_ENFORCED`: all claimed protected effects pass through the selected
  Core and exact supported profiles;
- `PARTIAL`: some effects are Core-mediated and others depend on opaque or
  external authority; or
- `NONE`: the surface is Engine-owned, external, or index-only.

**[EXEC-011]** A Market with one `CORE_ENFORCED` surface MUST NOT cause another
surface to inherit its assessment, custody, or security claims. Receipts and
interfaces must identify the exact surface used.

## Cancellation, replacement, and migration

Cancellation before protected movement creates no assessment basis. A
cancelled Scope cannot be reopened. A replacement is a new Authorization Scope
and therefore a new assessment group.

**[EXEC-012]** Migration to another Core, Market, Engine Revision, or custody
profile MUST be an explicit opt-in action authorized under the original rules.
It MUST conserve each asset and claim, and it MUST NOT rewrite or redirect an
existing Protocol Assessment liability.
