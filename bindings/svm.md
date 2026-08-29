# Solana Virtual Machine binding

- Status: Draft
- Classification: Normative
- Scope: SVM
- Spec ID: `programmable-protocol/0.1.0-draft.1`

## Native model

The Solana Virtual Machine (SVM) executes stateless program accounts; mutable
state lives in separate accounts passed to instructions. Native authority is
defined by Program IDs, account ownership and data, transaction signers,
writable privileges, program-derived addresses, invoked programs, and
token-program rules. These are SVM binding semantics, not portable Core
abstractions.

## Native identity

**[SVM-001]** Authorization and Receipt identity MUST bind at least the cluster
genesis identity, Core Program ID, Constitution ID, Core major, and exact native
Market and effective Engine Revision identities.

A Production manifest records the Program ID, loader and loader-specific
program-data identity where applicable, Executable and Linkable Format (ELF)
hash, source commit, pinned build environment, deployment signature and slot,
Interface Definition Language (IDL) hash, and live upgrade- and close-authority
state.

**[SVM-002]** A Production Core Program MUST have no upgrade or close authority.
The release verifier must prove the exact deployed artifact and immutable
loader state. A new Core major receives a new Program ID.

## Accounts and privilege closure

Every instruction profile defines exact ordered account roles, expected owners,
data lengths and discriminators, executable programs, signer status, writable
status, and permitted aliases.

**[SVM-003]** Core MUST validate the effective account privilege closure,
including duplicate-account privilege union. It MUST reject unexpected
protected aliases, wrong owners, wrong executables, unsafe writable accounts,
and any signer or writable privilege not required by the selected profile.

An Engine receives only the accounts needed for its exact phase. Core-controlled
vaults, Protocol Assessment vaults, liability state, non-participating Domains,
and writable Principal token accounts are not passed to an Engine unless an
exact protected profile requires and confines the access.

**[SVM-004]** A Principal's transaction-signer privilege MUST NOT be forwarded
to an Engine in a `CORE_ENFORCED` CPI. If Core forwards `is_signer = true`, the
Engine can use that signer authority throughout its reachable CPI closure. The
Engine instead receives authenticated identity data or a read-only Core-owned
context. A flow that requires the Principal signer inside Engine execution is
an independently authorized opaque surface.

## Program-derived addresses

Program-derived addresses (PDAs) are native custody and identity tools. Seed
order, domain separators, bump derivation, owners, and allocated layouts are
binding artifacts.

**[SVM-005]** No Engine receives a universal Core, Domain-vault, Protocol
Assessment, Collector, migration, or administration signer. Engine-owned PDA
signers are ambient Engine authority and never Core evidence.

The recommended execution-authentication pattern is a Domain-sharded,
Core-owned Execution Context account containing the active session digest,
Engine, Market, phase, Scope, and nonce. Core writes it before CPI, passes it
read-only to the Engine, and clears or closes it after return.

**[SVM-006]** A Core callback signer SHOULD NOT exist in the initial binding. If
a later profile introduces one, it must be non-value-bearing and scoped to the
exact Core major, Engine, Market or Domain, session digest, phase, and nonce. No
Core asset, custody, assessment, administration, or migration path may
recognize it as authority.

## Cross-program invocation

Cross-program invocation (CPI) is the SVM mechanism by which one program calls
another.

Core authenticates the selected executable Engine Program ID and effective
revision policy before every invocation and again before accepting its result.
The finite code-policy profile identifies the loader, ProgramData relation,
deployed artifact identity, deployment slot or equivalent revision fact, and
upgrade-authority state it claims to authenticate. An Engine may invoke
arbitrary programs with its own accounts and PDA authorities; those effects
remain Engine-attested or external unless a protected profile covers them.

**[SVM-007]** A manifest or declared nested CPI graph is not a sandbox. Core
must protect assets through the accounts and privileges actually exposed and
must bind any accepted return data to the authenticated Engine and exact phase.

Core checks the return-data Program ID and byte-length bound before decoding.
After CPI, Core reloads every mutable account whose state contributes to a
postcondition; a pre-CPI deserialized copy is not evidence of post-CPI state.
Missing, oversized, malformed, stale, forwarded, or wrong-program return data
fails closed for a required phase.

## SVM execution sessions

The binding supports:

- `ATOMIC_PLAN_V1`: Engine returns a complete plan to Core; and
- `BOUNDED_SESSION_V1`: Core may release exact bounded temporary assets before
  invoking a selected Engine or protected profile component and verifies actual balances
  and every obligation immediately after the CPI returns.

**[SVM-008]** Temporary outflow never grants a vault PDA signer. It transfers
only the exact authorized amount to an authenticated account, binds the CPI
program and ordered accounts, and requires every protected obligation to close
before the Core instruction returns. Failure reverts the entire transaction.

Before the first temporary outflow, Core validates fixed maxima for segments,
effects, accounts, return data, and compute-consuming loops. An Engine cannot
select an unbounded list whose exhaustion would occur after protected movement.

The binding does not depend on a future transaction-end hook. A later top-level
instruction cannot be trusted to close an obligation left by an earlier
successful Core instruction.

## Custody isolation

The default custody identity is unique per `(Core Deployment, Liquidity Domain
Revision, Asset Profile, native Asset)` tuple. Vault token accounts are owned
by the expected token program and controlled only by the exact Core PDA policy.

**[SVM-009]** A Market or Engine cannot select a user-supplied vault, authority,
mint, token program, or assessment account without exact derivation, owner,
profile, and alias validation.

Every protected operation reconciles reloaded token-account or lamport balances
with Core accounting before commitment. Duplicate account metas and permitted
aliases follow one explicit net-delta rule; all other protected aliases reject.

## Asset Profiles

Solana Program Library (SPL) Token, native SOL, Token-2022, Metaplex assets,
compressed assets, and custom programs are distinct native families. Interface
similarity does not make them one protected profile.

**[SVM-010]** The binding MUST NOT claim blanket Token-2022 support. Transfer
fees, transfer hooks and their extra accounts, permanent delegates, freeze or
close authorities, CPI Guard, confidential behavior, and other extensions must
be admitted or rejected by an exact machine-readable profile.

The initial Core implementation may support only a narrow Classic SPL Token
profile. Unsupported assets remain available to opaque Engine logic without
Core custody guarantees.

## Runtime limits

The implementation pins the active runtime and measures transaction size,
account count, instruction depth, return data, compute, heap, writable-account
contention, and rent or allocation costs.

**[SVM-011]** A production profile MUST use active cluster behavior and retain
measured headroom. A proposal, feature gate, or future transaction format is not
current capacity.

No ordinary execution requires one global writable registry, fee counter, or
volume account. Assessment state is keyed by the complete canonical group tuple
and may be deterministically sharded by that tuple; Domain identity MUST NOT
split a Scope-spanning group. Other state and receipt checkpoints remain
Domain- or Scope-local so unrelated Markets can execute in parallel.

**[SVM-012]** A protected profile component that receives Core-conferred
authority MUST be pinned by the immutable Core Deployment to its exact Program
ID, loader, program-data relation where applicable, interface, configuration,
and required immutable authority state. The Constitution selects the portable
policy; it does not contain a cluster-specific Program ID. Core reauthenticates
those facts before every cross-program invocation (CPI). A mutable or
caller-selected program receives no protected signer or writable protected
account and remains an Engine-owned or named external-dependency surface.

## Native conformance claims

The implementation repository owns versioned binding-native profiles for exact
instruction data, account layouts and privileges, PDA derivations, CPI behavior,
code identity, and event transport. Asset behavior remains in separately typed
Asset Profile claims.

**[SVM-013]** Every SVM Binding Release MUST publish at least one
binding-native profile and one Asset Profile. Each claim MUST pin its exact
binding-owned vector set and native test report. The cross-runtime Conformance
Report, Binding Release, and deployment manifest MUST carry identical typed
claim records; an SVM profile MUST NOT be inserted into the portable
Constitution profile list.

## Events and discovery

Market and Domain descriptors are authenticated Core-owned accounts or exact
state relations. Indexers validate Program ID, invocation context, event
discriminator, identities, and a state-bound checkpoint. Logs from another
program cannot impersonate a Core Receipt.

## Primary references

- [Solana core concepts](https://solana.com/docs/core)
- [Solana instructions](https://solana.com/docs/core/instructions)
- [Solana cross-program invocation](https://solana.com/docs/core/cpi)
- [Solana program deployment and immutability](https://solana.com/docs/programs/deploying)
- [Solana Token Extensions](https://solana.com/docs/tokens/extensions)
