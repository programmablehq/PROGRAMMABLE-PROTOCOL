# 01. Semantic model

- Status: Draft
- Classification: Normative
- Scope: Portable
- Spec ID: `programmable-protocol/0.1.0-draft.1`

## Design rule

**[MODEL-001]** The portable model MUST standardize authority and observable
meaning without standardizing a finite catalogue of market products.

The model therefore has two different extension surfaces:

- Engines may define arbitrary namespaced actions, state, economics, and opaque
  effects.
- A Core major exposes a closed set of product-neutral protected Capability and
  Effect types. A profile may select or narrow primitives already implemented
  by that Core. A new protected authority primitive requires a new Core major.

The closed authority surface is not a closed market surface. It prevents an
unknown Engine operation from silently becoming a vault signer.

## Entities

### Protocol release and Constitution

A Protocol release is the exact portable specification, schemas, and vectors.
A Constitution is the immutable subset selected by a native Core major,
including authorization, protected-effect, assessment, settlement, evidence,
and production-authority rules.

**[MODEL-002]** One Core Deployment MUST bind exactly one Constitution ID. It
MUST NOT select or mutate the Constitution per Market or Envelope.

### Core Deployment

A Core Deployment is identified by one runtime, one chain reference, and one
native Core identity. Two deployments with identical source are distinct.

**[MODEL-003]** A Deployment ID MUST bind the runtime, chain reference, native
Core identity, Constitution ID, and Core major. It MUST NOT imply shared state,
liquidity, custody, accounting, or security evidence with any other Deployment.

### Engine and Engine Revision

An Engine defines market behavior. Its effective revision binds:

- native code identity;
- callable interface revision;
- immutable parameters;
- declared dependency and upgrade policy; and
- immutable Engine configuration.

The binding declares a finite native code-policy profile that states which of
those facts Core can authenticate. Engine-owned external calls and
unauthenticated dependency behavior remain opaque; a dependency inventory is
not a claim that Core enumerated the Engine's reachable call graph.

**[MODEL-004]** An Engine's self-declared version MUST NOT be accepted as code
identity. A mutable implementation MUST be classified as mutable, and any code
change MUST produce a new effective Engine Revision for authorization and
evidence purposes. A surface whose effective revision cannot be authenticated
under a finite native code-policy profile cannot claim `CORE_ENFORCED`
revision evidence.

Effective protected Capabilities are not part of Engine Revision identity.
They are derived for each execution from the complete authorization and policy
intersection.

### Liquidity Domain

A Liquidity Domain is the explicit economic and authority risk boundary for
custody, accounting, admission, Engine dependence, and exit behavior.

A Liquidity Domain Revision binds one exact Domain descriptor, admission rule,
custody and exit profile, authority policy, and immutable configuration. Any
authority-relevant change creates a new Domain Revision ID even when the
long-lived Domain ID is retained.

**[MODEL-005]** A namespace or user-supplied identifier alone MUST NOT grant
access to a Domain. Core MUST authenticate the exact Domain Revision and its
local admission relation to the Market, Engine Revision, asset and custody
profiles, and requested capabilities.

A new Domain may choose an open admission rule. An existing Domain is not
required to accept a new Market. Markets that share a Domain intentionally
share the risks named by its profile. Non-participating Domains remain outside
the execution authority closure.

### Market

A Market binds one native Core Deployment, one Engine Revision, immutable
parameters, Domain and asset admission policies, and required Capability
profiles. A policy may name a fixed set or admit a dynamically selected set,
such as solver-selected assets, NFT collections, or basket components. Every
Envelope still binds the exact participating Domain Revisions, native assets,
and Asset Profiles that it uses.

**[MODEL-006]** A Market identity MUST change when any authority-relevant
binding or admission policy changes. Adding an instance that already satisfies
an immutable selector does not itself change Market identity. Display metadata
MAY change without changing Market identity only when no Core, client, or
indexer is permitted to use that metadata for authorization or settlement.

### Asset Profile

An Asset Profile describes exact native behavior rather than assuming that all
assets with the same interface behave alike.

**[MODEL-007]** A Core-supported Asset Profile MUST define the native asset
identity rule, amount domain, debit and credit observation, accepted external
tax or callback behavior, authority assumptions, failure behavior, and every
protected operation it permits.

Unsupported behavior can remain available on an opaque or Engine-owned
surface, but it cannot inherit Core-verified custody claims.

### Execution Target

An Execution Target binds one Market, effective Engine Revision, exact
participating Domain Revisions, requested action or payload digest, and
execution phase. One Envelope may contain one or more ordered Execution
Targets. Each Principal Authorization binds the exact Targets or one exact
Core-enforceable selector that resolves to them before protected movement.

### Principal and submitter

A Principal authorizes an economic effect. A submitter only transports an
Envelope. A router, relayer, fee payer, Engine, and Principal can be different
actors.

**[MODEL-008]** Native authorization MUST bind the Principal explicitly. It
MUST NOT infer end-user identity from a callback caller, transaction origin,
fee payer, or submitter unless the exact binding profile proves those actors
are identical.

### Authorization Scope

An Authorization Scope is the stable unit for replay control, cumulative
fills, limits, cancellation, and Protocol Assessment rounding.

**[MODEL-009]** Every Scope MUST be derived from the canonical Principal
Authorization fields excluding the Scope ID and signature, plus that
Principal's nonce and the binding's Scope domain separator. It MUST NOT be
derived from a transaction hash, signature bytes, or submitter-selected
identifier. A one-shot Scope is single-use; a stored Scope retains its exact
fill, limit, expiry, cancellation, and assessment state across uses. An
Envelope with multiple Principals carries one independently authenticated Scope
per Principal Authorization.

Cancellation permanently closes that Scope. A replacement authorization uses
a new Scope; it cannot reset or reuse the cancelled Scope's state.

### Effect and Capability

An Effect describes an operation. A Capability is the authenticated bounded
authority to commit one protected Effect.

**[MODEL-010]** Core MUST derive the effective Capability closure from the
intersection of the Constitution, Market descriptor, Liquidity Domain Revision
admission rules, Asset Profiles, Engine Revision, and Principal Authorization. An Engine
manifest or plan cannot grant authority by declaration.

### Receipt

A Receipt binds the committed Envelope to exact identities, plan digest,
participating Domains, supported protected effects, Protocol Assessment groups,
and evidence classes. Receipt meaning is defined in
[`04-evidence-and-discovery.md`](04-evidence-and-discovery.md).

## Semantic identifiers

The following identities are distinct and MUST NOT be substituted for one
another:

- Protocol Spec ID;
- Constitution ID;
- Core Deployment ID;
- Engine Revision ID;
- Liquidity Domain ID;
- Liquidity Domain Revision ID;
- Market ID;
- Authorization Scope ID;
- Asset Profile ID and native Asset ID;
- Protocol Collector ID; and
- Receipt ID.

**[MODEL-011]** Stable semantic identifiers MUST NOT be derived from filenames,
display names, source-language function names, mutable URLs, or an unqualified
contract or program address.

Portable built-in identifiers use the `programmable.` namespace. Engine-defined
identifiers MUST use a namespace controlled by the Engine author. Unknown
optional namespaced metadata may be ignored. Unknown required protected
Capability or Effect identifiers fail closed.

## Portable document identity

Portable template identity is metadata and conformance identity, not native
settlement authority.

A hashable portable JSON document:

- MUST be valid Internet JSON (I-JSON) as defined by RFC 7493;
- MUST contain no duplicate object keys;
- MUST use ASCII object keys;
- MUST represent every numeric quantity as a canonical decimal string; JSON
  number values are not permitted in portable hashable documents;
- MUST contain its schema identifier; and
- MUST exclude any computed identifier field from the hashed document.

The document is serialized with JSON Canonicalization Scheme (RFC 8785). A
Market Template V1 identifier is:

```text
"sha256:" || lowercase_hex(
  SHA-256(
    UTF8("programmable:market-template:v1") || 0x00 || JCS(document)
  )
)
```

**[MODEL-012]** Native Core authorization MUST bind native canonical bytes and
identities defined by its binding. It MUST NOT trust a portable JSON hash as a
substitute for validating native state.

## Market families

An optional Market Family ID can relate similar Markets across deployments.
It is an author or indexer attestation only.

**[MODEL-013]** A Market Family ID MUST NOT imply shared state, liquidity,
custody, fungibility, price parity, migration, or transferred security evidence.

## Constitution identity

A Constitution V1 document follows the portable JSON rules above. Its
`constitution_id` field is excluded from its hash preimage and is then set to:

```text
"sha256:" || lowercase_hex(
  SHA-256(
    UTF8("programmable:constitution:v1") || 0x00 ||
    JCS(document_without_constitution_id)
  )
)
```

**[MODEL-014]** Core, Authorization, Protocol Assessment groups, Receipts,
binding releases, and deployment manifests MUST bind this computed Constitution
ID. A readable label or Core-major number is not a substitute for the content
identity.
