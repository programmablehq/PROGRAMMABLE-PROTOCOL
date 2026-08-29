# Ethereum Virtual Machine binding

- Status: Draft
- Classification: Normative
- Scope: EVM
- Spec ID: `programmable-protocol/0.1.0-draft.1`

## Portability target

The Ethereum Virtual Machine (EVM) binding targets the Ethereum-compatible
common denominator. Robinhood Chain is the first planned deployment, but
Robinhood-specific precompiles, system contracts, contract-size allowances,
ordering, or finality behavior are not portable Core prerequisites.

Each chain has a separate Deployment ID, address, state, custody, liquidity,
Collector accounting, and deployment evidence.

## Native identity

**[EVM-001]** Authorization and Receipt identity MUST bind at least the EIP-155
chain ID, Core contract address, Constitution ID, Core major, and native Market
and Engine Revision identities.

A Production manifest additionally records the genesis or network anchor,
deployer, deployment transaction and block, constructor inputs, initcode and
runtime bytecode hashes, source commit, compiler settings, Application Binary
Interface (ABI) hash, and proxy or upgrade-path evidence.

**[EVM-002]** A Production Core MUST be a directly deployed immutable contract.
It MUST NOT execute implementation code through a proxy, beacon, diamond,
`delegatecall`, mutable module pointer, or another replaceable code indirection.
It MUST contain no `SELFDESTRUCT` or equivalent intentional code-removal path.

The binding must verify runtime code identity against live chain state. Address
equality alone is insufficient.

## Principal authorization

The standard externally signed profile uses EIP-712 typed structured data whose
domain binds the exact chain ID, verifying Core contract, and major version.
The signed structure binds all portable Authorization fields, including the
effective Engine Revision and Authorization Scope.

**[EVM-003]** Externally owned account (EOA) signatures MUST enforce canonical
recovery and nonces.
Contract-wallet authorization, when supported, MUST use an exact ERC-1271
profile and treat wallet calls as hostile external calls. ERC-1271 validation
uses a gas-bounded `STATICCALL`, copies only bounded return data, and accepts
only the exact profile result. Neither `tx.origin` nor the router's
`msg.sender` is end-user identity.

Permit, Permit2, account-abstraction, and relayer flows are optional native
profiles. They cannot weaken Core limits or replay binding and remain named
external dependencies where applicable.

## Call and reentrancy boundary

The EVM has no enumerable account-meta capability closure. An Engine can call
any address reachable by EVM execution. Containment therefore comes from what
Core and its custody contracts authorize, not from pretending to sandbox the
Engine call graph.

**[EVM-004]** Core may call only exact target classes admitted by its
Constitution and selected profile: the authenticated Engine interface,
authorization wallet or verifier, protected profile components, and exact named
external dependencies. It MUST NOT expose a generic arbitrary-call,
generic delegate, generic approval, or caller-selected call-target primitive.
Core MUST NEVER `delegatecall` an Engine.

The initial EVM binding is return-only. Core invokes an authenticated Engine or
protected profile component and receives one bounded proposal in return data.
Core orchestrates any later segment as another outbound call after validating
the previous return. An Engine-to-Core mutating callback is not a session
operation in this profile.

**[EVM-005]** The initial binding MUST reject every Engine-to-Core mutating
callback and every other nested mutating Core entry. Each outbound session call
MUST authenticate the selected Engine, Market, Scope, session digest, segment,
and exact phase against Core-owned transient execution state before the call
and before accepting its return. `msg.sender == engine` alone is never phase or
replay proof. A future callback-enabled profile requires a distinct binding
release, explicit selector and phase exceptions, a non-alias proof, and native
hostile vectors.

Core and custody contracts use phase-specific reentrancy locks. The lock is
active before the first hostile external call, including an ERC-1271
`STATICCALL`. All token, wallet, Engine, oracle, and profile-component calls are
treated as potentially reentrant. A nested entry claiming to open an unrelated
Envelope is rejected.

Externally callable reads used as protocol evidence MUST either expose the last
committed checkpoint or fail while an Envelope is active. They MUST NOT expose
partially updated canonical accounting to a reentrant observer.

**[EVM-006]** Every hostile external call MUST have an explicit gas policy and
bounded return- and revert-data copying. Oversized data, malformed ABI, or
insufficient remaining gas for Core postconditions fails the Envelope. The
caller cannot choose a gas-forwarding or returndata limit that prevents Core
from completing validation and rollback-safe accounting.

## Engine code policy

An EVM Engine Revision is the binding-defined digest of a machine-readable
descriptor. The initial descriptor binds the EIP-155 chain ID, Engine address,
entry runtime code hash, exact interface profile and selector set, native code
policy ID, immutable-configuration commitment, dependency-policy commitment,
and the evidence class of every claimed fact.

The initial `CORE_ENFORCED` code-policy profile is direct-entry and forbids
`DELEGATECALL`, proxy, beacon, mutable implementation-pointer, and metamorphic
indirection for behavior claimed by that profile. Entry code hash authenticates
only the entry code. Storage, external dependencies, and a dynamic call graph
are not immutable merely because the entry hash is unchanged. A fact outside
the finite authenticated descriptor remains a disclosed Engine assumption and
MUST NOT inherit exact-revision evidence. A later binding release may add a
finite indirection profile only when it defines the exact family, storage
slots, implementation and admin identities, transition rules, and native
vectors.

**[EVM-007]** Before every Engine invocation and again before accepting its
result, Core MUST authenticate the effective Engine Revision required by the
Authorization and Liquidity Domain Revision policy. A proxy retaining the same
address and proxy bytecode after an implementation change is a new effective
revision. A multi-call session that cannot reauthenticate every mutable code
boundary claimed by its finite code-policy profile is not `CORE_ENFORCED` under
that revision policy.

Any change to a fact authenticated by the selected descriptor creates a new
Engine Revision. The EVM implementation repository MUST freeze the descriptor
encoding, revision-ID derivation, and native vectors before freezing Market IDs,
signature types, public Core interfaces, or persistent Core storage.

Core immutability does not imply Engine immutability.

## Custody isolation

The recommended and default custody topology is one immutable authority and
balance boundary per `(Core Deployment, Liquidity Domain Revision, Asset
Profile, native Asset)` tuple.
It may be a dedicated minimal vault contract or another design that proves
equivalent native isolation.

**[EVM-008]** A single token balance with only an unverified internal label is
not sufficient evidence of cross-Domain isolation. An implementation must prove
that an Engine, malicious token callback, admitted asset behavior, or
Domain-local state failure cannot consume another Domain's balance. A shared
Core defect can remain systemic to that Core Deployment. Profiles that cannot
prove the Domain isolation property are `PARTIAL` or unsupported.

Each protected operation reconciles observed token balances with Core
accounting before commitment. Duplicate or aliased asset endpoints are either
handled by a profile with an explicit net-delta rule or rejected before the
first external call.

Vaults never approve Engines, routers, or arbitrary dependencies. Temporary session
outflows transfer only the exact authorized amount and create a Core-tracked
obligation that must close before the Envelope commits.

## EVM execution sessions

The binding supports two portable execution profiles:

- `ATOMIC_PLAN_V1`: Engine returns a complete plan; Core validates and commits
  it.
- `BOUNDED_SESSION_V1`: Core executes an ordered set of segments, may release
  exact bounded temporary assets, invokes the selected Engine or protected
  profile component pinned by the immutable Core Deployment,
  records actual balance deltas, and requires every protected obligation and
  cumulative user limit to close before commit.

**[EVM-009]** A temporary outflow MUST be limited by exact Principal and
Liquidity Domain Revision authorization, asset, recipient, amount, phase, and
session digest. The recipient receives assets, never a Core approval or vault
authority. Any unpaid or unclassifiable obligation reverts the complete
Envelope.

The exact ABI and storage layout belong to the EVM implementation repository.
Segments must preserve the canonical six-field assessment-group identity
defined by ProtocolAssessmentV1; routing must not create an extra grouping
dimension or erase an existing one. A later transaction or Envelope using the
same stored Scope and remaining group tuple resumes its committed cumulative
basis.

## Asset Profiles

Every token call is hostile. A profile defines return-data handling, balance
observation, callbacks, and gross debit versus spendable credit.

Initial profile families may include:

- native ETH or a wrapped-native profile;
- exact-balance ERC-20;
- measured fee-on-transfer ERC-20;
- ERC-721;
- ERC-1155; and
- later exact profiles for rebasing, callback, permissioned, or other assets.

**[EVM-010]** The binding MUST NOT claim generic support for all ERC-20,
ERC-721, or ERC-1155 contracts. Upgradeability, blocklists, pauses, transfer
taxes, rebases, receiver callbacks, malicious return data, nonstandard balance
changes, and issuer authority must be measured or disclosed by the exact
profile.

For a measured transfer, Core compares pre- and post-call balances and verifies
the source debit and destination spendable credit required by the selected
profile. A token capable of debiting more than the requested gross amount is
unsupported unless an exact profile bounds it.

## Errors and atomicity

EVM low-level calls can return failure and Solidity can catch a revert. The
binding may classify optional opaque calls, but it cannot catch and ignore a
failed required protected effect.

**[EVM-011]** A failed required Engine phase, asset transfer, obligation,
postcondition, Protocol Assessment funding, or Receipt checkpoint MUST revert
the complete Envelope.

## Events and discovery

Factory or Core logs identify Market creation and revision. A normalized
Receipt may be reconstructed from authenticated Core logs plus state. The
binding defines exact event topics, ordering, and reorganization handling.

No offchain registry signature is required for creation or execution.

## Protected profile components

**[EVM-012]** A protected profile component that receives Core-conferred
authority MUST be an immutable native code identity pinned by the Core
Deployment, with an exact interface, selector set, configuration, gas policy,
and Capability grammar. The Constitution selects the portable policy; it does
not contain a chain-specific address. Core reauthenticates the deployment-pinned
identity before each call. A proxy, mutable component, or caller-selected
dependency receives no Core-conferred protected authority and remains an
Engine-owned or named external-dependency surface with the corresponding
evidence classification.

## Native conformance claims

The implementation repository owns versioned binding-native profiles for the
exact ABI, calldata, storage, signature, call, code-policy, and event semantics
it implements. Asset behavior remains in separately typed Asset Profile claims.

**[EVM-013]** Every EVM Binding Release MUST publish at least one
binding-native profile and one Asset Profile. Each claim MUST pin its exact
binding-owned vector set and native test report. The cross-runtime Conformance
Report, Binding Release, and deployment manifest MUST carry identical typed
claim records; an EVM profile MUST NOT be inserted into the portable
Constitution profile list.

## Robinhood deployment profile

Robinhood Chain deployment configuration and live addresses belong to the EVM
repository, not this portable repository. Before production, its profile must
record chain ID, genesis or network anchor, ETH gas behavior, RPC and sequencer
assumptions, finality and reorganization policy, explorer verification, and the
complete deployment evidence required by `05-versioning.md`.

The current official Robinhood documentation describes the network as an
EVM-compatible Arbitrum Layer 2. The binding must re-verify current network
facts at release time rather than freezing mutable operational values into the
portable Constitution.

## Primary references

- [EIP-712 typed structured data](https://eips.ethereum.org/EIPS/eip-712)
- [ERC-1271 contract signatures](https://eips.ethereum.org/EIPS/eip-1271)
- [Robinhood Chain documentation](https://docs.robinhood.com/chain/)
- [Robinhood Chain contract deployment](https://docs.robinhood.com/chain/deploy-smart-contracts/)
- [Uniswap v4 Core architecture](https://github.com/Uniswap/v4-core)
