# 06. Security properties

- Status: Draft
- Classification: Normative
- Scope: Portable
- Spec ID: `programmable-protocol/0.1.0-draft.1`

## Security objective

Programmable does not make arbitrary code safe. It confines protected authority
and makes the remaining trust explicit.

**[SEC-001]** The primary guarantee of a conforming `CORE_ENFORCED` surface is
containment of Core-conferred protected authority: a compromised Engine can use
that authority only against the Principals and Liquidity Domain Revisions that
selected it and only through their exact admitted Capabilities and signed
limits. External actions performed with authority the Engine already owns are
outside this guarantee and retain their own evidence class.

This is not a shared runtime sandbox. EVM and SVM enforce the boundary through
different native mechanisms described in their binding documents.

## Required portable invariants

### Exact authorization

**[SEC-002]** No protected debit, credit destination, assessment, Domain,
Engine Revision, persistent right, or migration may exceed or escape the exact
authenticated Authorization and profile intersection.

### No ambient authority

**[SEC-003]** Engines, routers, adapters, callbacks, indexers, and submitters
MUST NOT receive a universal Principal, vault, Domain, Protocol Assessment,
Collector, migration, or Core-administration authority.

### Domain isolation

**[SEC-004]** An Engine compromise MUST NOT permit protected access to a
non-participating Liquidity Domain. Shared Domains intentionally share the
Engine, accounting, locking, economic, and liveness risk declared by their
profile.

### Per-asset conservation

**[SEC-005]** Core MUST enforce the exact debit, credit, retained balance,
Protocol Assessment, liability, and exit relationships defined by each
supported Asset Profile. Unlike assets MUST NOT be conserved or valued through
an implicit oracle conversion.

### Atomicity

**[SEC-006]** Any required postcondition failure MUST revert the complete
Envelope, including cumulative basis, replay state, Engine state changes that
are required by the Envelope, transfers, fee funding, liabilities, and Receipt.

### Replay safety

**[SEC-007]** Authorization replay protection MUST bind the runtime and chain,
Core Deployment, Constitution, authorized Execution Targets or target selector,
effective Engine Revisions, participating Domain Revisions, Authorization
Scope, Principal, nonce or fill state, and expiry.

### Honest evidence

**[SEC-008]** Core facts, profile facts, Engine assertions, external
dependencies, and offchain derivations MUST remain distinguishable. No Receipt
or registry signature is a general safety certificate.

### Offchain independence

**[SEC-009]** A Production Core's valid settlement and exact profile-defined
exit behavior MUST NOT require the Programmable website, DNS, GitHub, hosted
API, hosted indexer, private RPC, or company signer.

### Physical and accounted state

**[SEC-010]** Before an Envelope commits, Core MUST reconcile every protected
physical balance change with its canonical debit, credit, retained balance,
obligation, and liability accounting under the selected Asset Profile. Cached
pre-call state, requested transfer amounts, and Engine reports are not
post-settlement evidence.

For every persistent `(Core Deployment, Liquidity Domain Revision, Asset
Profile, native asset)` state, the selected profile defines an exact committed
relation between observed spendable custody, accounted assets, and liabilities.
Unsolicited surplus creates no claim. A deficit is never hidden by another
Domain Revision or a later unrelated Principal inflow; Core applies the
selected Revision's immutable deficit policy before accepting new protected
value.

### Resource boundedness

**[SEC-011]** Every Core-controlled loop, effect list, callback, return-data
copy, account set, and settlement phase MUST have a binding-defined maximum or
a proof that work is independent of untrusted input size. Limits are checked
before protected movement whenever later exhaustion could strand an obligation.

## Threat classes

Every binding threat model and hostile test corpus must cover:

- Principal-intent substitution, replay, nonce collision, and signature-domain
  confusion;
- malicious or mutable Engines, forwarded callback authority, reentrancy or
  nested invocation, stale output, and plan substitution;
- protected aliases, duplicate effects, confused deputies, privilege widening,
  and cross-Domain access;
- compromised Liquidity Domain controllers, admission changes, custody roles,
  exit-policy changes, and stale-revision authorization;
- malformed, fee-on-transfer, rebasing, callback-capable, paused, blocklisted,
  frozen, upgradeable, or otherwise hostile assets;
- Refund forgery, rounding fragmentation, accounting desynchronization,
  donation manipulation, and liability overclaim;
- denial of service through unbounded work, state contention, gas or compute
  exhaustion, oversized return data, and hostile external calls;
- compiler, dependency, generated-interface, artifact, deployment, and manifest
  substitution; and
- compromised frontend, RPC, indexer, deployment, Collector, and organization
  accounts.

## Blast-radius statements

| Failure | Maximum architectural scope |
| --- | --- |
| Core defect | Potentially systemic within that exact Core Deployment and supported profiles |
| Engine defect | Core-conferred authority is limited to participating Principals and Domain Revisions; independently held Engine authority remains external |
| Liquidity Domain controller compromise | Actions granted to that authority by each exact current Domain Revision, plus any new Domain Revisions and admission, custody, or exit decisions it is authorized to create; no implicit authority over a Revision that does not name it |
| Asset or issuer authority | Assets and operations exposed by the exact Asset Profile |
| Oracle or bridge failure | Markets and Effects that explicitly depend on it |
| Interface, RPC, or indexer compromise | Can deceive, censor, or construct malicious requests; has no independent Core settlement authority |
| Collector claim-key compromise | Accrued and future fees bound to that immutable Collector claim policy; not user or Domain assets solely from that role |
| Principal key compromise | Authority already held by that Principal |
| Base-chain or runtime failure | Outside the Protocol's control |

**[SEC-012]** Documentation and interfaces MUST state the exact affected scope.
They MUST NOT use `unhackable`, `risk-free`, or owner-compromise-safe without
naming the component and proof.

## Explicit non-guarantees

Even a conforming Core does not guarantee:

- a fair exchange rate or positive liquidity-provider (LP) return;
- rational, non-manipulative, or lawful Engine economics;
- correct or available external oracles, bridges, issuers, or assets;
- token legitimacy, metadata truth, collection membership, or legal title;
- recovery from a stolen Principal key;
- an exit through an issuer freeze or failed base chain; or
- safety of `PARTIAL`, `NONE`, opaque, or Engine-owned custody surfaces.

## Production evidence

**[SEC-013]** Open source, immutability, adminlessness, unit tests, conformance
vectors, reproducible builds, formal properties, independent review, deployment
verification, and monitoring are separate controls. No one control substitutes
for the others.

Before a native implementation can be production-classified, its tests must
name the hostile actor, authority it controls, protected asset or state,
expected rejection or containment, and observable postcondition.
