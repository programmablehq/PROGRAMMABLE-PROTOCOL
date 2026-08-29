# Glossary

- Status: Draft
- Classification: Normative
- Scope: Portable
- Spec ID: `programmable-protocol/0.1.0-draft.1`

Terms are capitalized when they refer to protocol entities.

## Core terms

### Assessment Principal

The authenticated Principal whose applicable protected gross debit creates a
Protocol Assessment basis. A separate fee-funding Principal does not replace
or reset this identity.

### Asset Profile

An immutable native definition of an asset standard, accepted behaviors,
authority assumptions, transfer accounting, failure behavior, and supported
protected operations. An asset address alone is not an Asset Profile.

### Binding-native profile

A versioned, binding-owned conformance profile for runtime-specific behavior
such as interfaces, encodings, state, calls, signatures, code identity, and
event transport. It is distinct from a portable conformance profile and an
Asset Profile.

### Binding Release

A content-addressed claim that binds one native implementation commit and its
artifacts to one Protocol commit, Constitution, portable vector set,
Conformance Report, binding-native profiles, and Asset Profiles.

### Conformance Report

A cross-runtime report envelope that records portable case results and pins the
binding-owned native vector sets and native test reports for every claimed
binding-native profile and Asset Profile.

### Authorization

An authenticated statement by one Principal that binds the selected Core,
Execution Targets or target selector, Authorization Scope, assets, recipients,
amount limits, assessment limits, nonce or replay state, and expiry. One
Envelope may carry multiple independently authenticated Principal
Authorizations.

### Authorization Scope

The immutable identity across which authorization use, cumulative fills, and
Protocol Assessment rounding are tracked. A one-shot Scope is single-use. A
stored Scope may be filled repeatedly until it is exhausted, expired, or
cancelled.

### Capability

A bounded authority that permits one exact class of protected effect against
named subjects and resources. A declaration is not a Capability; Core must
derive and enforce it from authenticated state and Authorization.

### Constitution ID

The immutable identifier for the Core-major rules that determine
authorization, protected effects, Protocol Assessment, settlement, evidence,
and authority. One Production Core Deployment binds exactly one Constitution
ID.

### Constitution

The machine-readable, immutable selection of the exact protected-effect,
authorization, assessment, evidence, and production-authority rules implemented
by one Core major. It narrows one Protocol release and cannot invent semantics.

### Core

The native authority and settlement kernel. Core verifies Authorization,
confines Capabilities, commits supported protected effects, applies Protocol
Assessment, and emits Core evidence. A Production Core is immutable; an
explicit disposable test deployment may not be. `Core` is the portable term;
`kernel` is not a separate protocol component.

### Core Deployment

One native Core identity on one chain. Deployments never share state, custody,
liquidity, fee accounting, or security evidence implicitly.

### Core major

One immutable protected-authority and settlement implementation family. A
change that alters valid protected behavior, assessment semantics, or authority
requires a new Core major deployed side by side.

### Deployment ID

The identity binding one runtime, chain reference, native Core identity,
Constitution ID, and Core major. It is not a source-code or brand identifier.

### Effect

A proposed or observed state or asset operation. An Engine-proposed Effect has
no protected authority until Core validates it against an exact Capability and
commits it.

### Engine

An independently deployed contract or program that defines market behavior.
An Engine can calculate or authorize arbitrary economics but is untrusted by
default and never receives ambient Core authority.

### Engine Revision

An exact native Engine code identity, interface version, immutable parameters,
immutable configuration, declared dependencies, and code or upgrade policy.
Mutable code changes the effective Engine Revision even if its address or
self-declared version does not change.

### Execution surface

One exact callable path classified as `CORE_ENFORCED`, `PARTIAL`, or `NONE`.
Coverage of one surface does not transfer to another entry point exposed by the
same Market or Engine.

### Execution Target

One exact Market, effective Engine Revision, participating Liquidity Domain
Revisions, action or payload digest, and execution phase selected inside an
Envelope.

### Envelope

One atomic Core-mediated execution attempt. An Envelope either commits all
required Core state and protected effects or commits none of them.

### Fee-funding Principal

A Principal that separately authorizes payment of the Protocol Assessment leg.
It may differ from the assessment Principal under the sponsored-assessment
profile and is not part of the canonical assessment group key.

### Fill

One committed use of an Authorization Scope. A stored Scope may have several
strictly ordered Fills across transactions and Envelopes while retaining its
cumulative limits, replay state, and assessment basis.

### Evidence Class

The primary provenance of a fact: `CORE_VERIFIED`, `PROFILE_VERIFIED`,
`ENGINE_ATTESTED`, or `OFFCHAIN_DERIVED`. Named external dependencies, support
status, and execution coverage are separate fields.

### Liquidity Domain

The smallest explicit custody, accounting, admission, Engine-risk, and liveness
boundary that can participate in a Market. Multiple Markets may share a Domain
only when the Domain's local rule admits them. Shared Core settlement does not
imply shared liquidity.

### Liquidity Domain Revision

One exact version of a Liquidity Domain descriptor, admission rule, custody and
exit profile, authority policy, and immutable configuration. A policy change
creates a new Revision even if the long-lived Domain ID remains the same.

### Market

A binding between one native Core Deployment, an Engine Revision, immutable
parameters, Domain and asset admission policies, and required Capability
profiles. Each Envelope resolves the exact participating Liquidity Domain
Revisions, native assets, and Asset Profiles. `Market` does not imply a
two-token pool or any particular pricing mechanism.

### Market Family ID

An optional author or indexer attestation relating Markets across deployments.
It conveys no shared state, custody, fungibility, migration, or security proof.

### Market Execution Gross Debit

A protected gross source debit authorized for market execution, excluding the
separate Protocol Assessment leg. The name does not imply that an Engine funds
the debit.

### Principal

An authenticated economic actor whose spend Capability, assets, claim, or
limits are consumed or changed. A transaction submitter, router, fee payer, and
Principal can be different actors.

### Protected profile component

An immutable native component selected by an Asset, custody, settlement, or
exit profile and pinned by one Core Deployment to an exact code identity,
interface, configuration, and authority grammar. Only such a component may
receive Core-conferred protected authority. `PROFILE_COMPONENT` is its bounded
session target kind. An arbitrary Engine dependency is not promoted by using
this label.

### PrincipalFundedGrossDebitV1

The objective Protocol Assessment V1 basis defined in
`03-protocol-assessment.md`. It is not an Engine-supplied trade-volume label.

### Native Asset ID

The binding-defined canonical identity of one native asset under an exact Asset
Profile. Collection, contract, mint, token-ID, denomination, and wrapper
granularity are defined by that profile rather than inferred from a display
symbol.

### Production Core

A Core Deployment that can accept real production assets and whose release
evidence proves the production gates. Every Production Core is immutable and
adminless at deployment.

### Protocol Assessment

The immutable Core-enforced five-basis-point debit defined by
ProtocolAssessmentV1. It is protocol accounting, not a tax classification.

### Protocol Collector

The immutable beneficiary identity for Protocol Assessment liabilities created
by one Core Deployment. A compromised non-rotatable claim authority can lose
accrued and future fees bound to it, but cannot rewrite Core policy or reach
user assets solely by being the Collector.

### Receipt

A canonical record of named facts associated with a committed Envelope. A
Receipt is not a safety certificate, legal title, or proof of fair economics.

### Refund

Only a Core-proven release of segregated unused origin debit or an exact
pre-use reversal uniquely allocated to one origin debit. An arbitrary credit,
rebate, or return from mixed inventory is not a Refund.

### Segment

One strictly ordered step of a bounded execution session. It commits a proposal,
the permitted caller, resource use, realized observations, protected effects,
and temporary-obligation transitions into the rolling transcript.

### Temporary Obligation

A Core-tracked requirement created by an exact temporary protected outflow in a
bounded session. Its exact key cannot net with another key, and its remainder
must be zero at the final checkpoint.

## Terms that require qualification

- `immutable` applies to one exact Production Core Deployment and its bound
  Constitution, not automatically to Engines, assets, interfaces, or chains.
- `permissionless` names an exact creation or execution surface; it does not
  mean every existing Domain must admit every Engine.
- `portable` means matching semantics and vectors, not identical bytes or code.
- `verified` MUST be qualified by its Evidence Class or by build, deployment,
  conformance, or independent-review evidence.
- `revenue` MUST distinguish assessed, funded, claimable, claimed, and
  offchain-valued amounts.
- `liability` in this specification means a Core accounting claim, not a legal
  conclusion.
- `hook` is runtime-specific. The portable abstraction is an Engine.
- `pool` MAY describe a particular Engine's mechanism but is not the universal
  protocol object.
