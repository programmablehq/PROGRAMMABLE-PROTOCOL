# 05. Versioning and production identity

- Status: Draft
- Classification: Normative
- Scope: Portable
- Spec ID: `programmable-protocol/0.1.0-draft.1`

## Version axes

Programmable uses separate versions for:

- portable Protocol release;
- machine schema revision;
- native binding release;
- Core major;
- Engine interface and effective Engine Revision;
- Asset, custody, settlement, and exit profiles; and
- deployment release.

**[VER-001]** A single version string MUST NOT be used as evidence for more
than one of these axes. Every conformance or deployment claim must name the
exact relevant versions and repository commits.

The portable Protocol release uses Semantic Versioning:

- a major increment changes or removes previously valid portable behavior,
  identifier meaning, mandatory artifact shape, or conformance result;
- a minor increment adds backward-compatible optional semantics, profiles, or
  evidence fields without changing existing results;
- a patch increment contains factual errata, tooling fixes, or clarification
  that does not change valid behavior or a golden result; and
- a pre-release suffix records maturity and iteration before a stable release.

**[VER-008]** Protocol versioning, Core-major versioning, schema revision, and
binding versioning remain separate. A Protocol major does not silently replace
a deployed Core. Any change to the protected authority or settlement behavior
implemented by a Core still requires a new side-by-side Core major, regardless
of the Protocol version number that documents it.

## Protocol lifecycle

Protocol work moves through:

```text
Idea -> Draft -> Candidate -> Final -> Deprecated
                           \-> Withdrawn
```

- Draft may change incompatibly and is suitable for architecture and prototype
  work only.
- Candidate has complete normative text, schemas, vectors, and at least one
  native implementation exercising every required behavior.
- Final has no unresolved semantic contradictions and has completed the
  declared portability, compatibility, and security review gates. Final
  Protocol status does not make an unimplemented or untested native binding
  conformant.
- Deprecated remains immutable and readable but is not recommended for new
  deployments.
- Withdrawn never becomes a production standard.

Deprecation and withdrawal are release-catalogue lifecycle metadata. They do
not mutate a selected Constitution or any artifact already identified by its
content digest. The Constitution's embedded `status` records the semantic
maturity at which that Constitution identity was selected.

**[VER-002]** A Final release may receive clearly marked factual errata and
non-normative clarification only. A change to valid behavior, an identifier,
an invariant, or a golden result requires a new Protocol release.

An Ethereum Virtual Machine (EVM) implementation, Solana Virtual Machine (SVM)
implementation, and each deployment qualify independently. Production
eligibility for one native binding does not depend on deploying another
binding and cannot be inferred from it.

## Production Core rule

**[VER-003]** Every Core major that may receive real production assets MUST be
immutable and adminless at deployment. There is no funded mutable Production
Alpha.

A Production Core has no:

- proxy, beacon, implementation pointer, `delegatecall` upgrade route, mutable
  ProgramData authority, or equivalent code replacement path;
- authority that can change authorization, assessment rate or basis,
  Collector, supported protected profiles, settlement, evidence, user rights,
  or exit behavior;
- privileged Core pause, quarantine, or censor switch;
- admin sweep or asset-redirection path; or
- automatic or administrator-forced migration path.

Testnets and explicitly disposable release candidates may be replaceable. They
must not accept real production assets and must not be described as immutable,
adminless, or owner-compromise-safe.

## Side-by-side majors

**[VER-004]** New protected authority semantics require a new Core major and
new native Core identity. Old and new majors run side by side; the new major
cannot mutate old state or sign for old custody.

An EVM Core major receives a new contract address with no proxy migration. An
SVM Core major receives a new Program ID. A deployment on another EVM chain is
a new Core Deployment even when source and runtime bytecode are the same.

## Market and Engine revisions

Any authority-relevant change to an Engine, adapter, dependency, Market
parameter, Domain admission policy, Asset Profile, or exit profile produces a
new effective revision or Market identity as defined by the binding.

**[VER-005]** An Authorization MUST bind the exact effective Engine Revision.
If a mutable Engine changes code, old authorizations cannot silently authorize
the new code.

## Migration

Migration is an execution under explicit original rules, not administration.

**[VER-006]** A migration MUST be opt-in, bind the old and new Core and Market
identities, enforce per-asset conservation and recipient constraints, preserve
or explicitly close claims, and leave old Protocol Assessment liabilities
bound to their original Collector.

No later Core can retroactively add an exit or migration right to old custody.
Cross-chain expansion is not a native state migration and creates no implicit
fungibility or shared liquidity.

## Release manifests

A binding release manifest must record:

- exact Protocol release and commit;
- source repository and implementation commit;
- toolchain and reproducible build command;
- named native interface and artifact digest records, each stating its
  authoritative byte source, algorithm, digest, and pinned source path;
- claimed portable profiles and portable vector-set identity;
- typed binding-native and Asset Profile claims, each with exact native
  vector-set and test-report paths and digests;
- conformance report; and
- known runtime and Asset Profile limits.

The `conformance_report_digest` is the exact
`JsonArtifactDigestV1` of a Conformance Report stored with the release claim.
The report and Binding Release must agree on the Binding ID, Protocol Spec ID,
Protocol commit, Constitution ID, implementation/source commit, portable
vector-set digest, portable profile set, complete typed native claim sets, and
toolchain. Every portable case applicable to that exact portable profile set
must pass. A failed or unresolved report may be retained as test
output, but it cannot support a Binding Release.

**[VER-009]** A Binding Release MUST NOT be counted or published as a release
claim unless its Conformance Report resolves by exact content digest and the
complete release-to-report relation above holds. The Protocol commit must be a
commit object in the Protocol repository whose `protocol-version.json`,
Constitution, and conformance-vector bytes reproduce the claimed Protocol Spec
ID, Constitution ID, and portable vector-set digest.

A deployment manifest must additionally record:

- exact runtime and network identity;
- Core native identity;
- deployment transaction and ledger position;
- actual runtime code or program artifact identity;
- exact constructor or initialization inputs and every immutable configuration
  state commitment;
- Constitution and Protocol Collector identities;
- Core-reachable fixed code dependencies, their capability-scope digests, code
  identities, trust classes, and replacement-authority observations;
- the digest of the policy that admits dynamic profile-bound targets;
- proxy, loader, configuration, assessment, pause, sweep, and migration
  authority conclusions, each backed by one or more evidence references; and
- predecessor identity, if any.

The `binding_release_digest` is the exact `JsonArtifactDigestV1` of the Binding
Release used to build the deployment. The deployment and Binding Release must
agree on runtime family, Constitution, portable profiles and vector-set digest,
complete binding-native and Asset Profile claim sets, source commit, native
interface digest, and executable artifact digests. Schema-shape examples marked
with classification `example` deliberately use unresolved placeholders and are
not deployment claims.

**[VER-010]** A testnet-candidate or Production deployment manifest MUST resolve
its Binding Release by exact content digest. A filename, version string,
repository branch, or explorer label is not a release identity.

**[VER-011]** A Production deployment manifest MUST resolve through that exact
Binding Release to its `protocol_commit`. The `protocol-version.json` stored at
that commit MUST have `status` equal to `final` and `production_eligible` equal
to `true`. A Final label, production-eligible flag, passing Conformance Report,
or Production deployment classification on any other commit does not satisfy
this gate. Testnet-candidate classification does not imply Protocol production
eligibility.

Evidence references form a catalog of content-addressed source artifacts,
builds, transactions, ledger observations, runtime queries, explorer records,
or independent attestations. Every referenced evidence identifier MUST resolve
to exactly one catalog record. Duplicate evidence identifiers, unresolved
references, mutable locators without a captured digest, or evidence observed on
a different network or ledger position invalidate the claim.

The EVM evidence branch records the chain ID, transaction sender, exact creation
input and constructor arguments, direct or indirect deployment model, source
commit, compiler and settings digest, creation-bytecode, init-code,
runtime-bytecode and Application Binary Interface (ABI) digests,
reproducible-build evidence, live-code evidence, dependency evidence, and
dynamic-target policy digest. A Production EVM Core uses the `direct` deployment
model; evidence for proxy slots does not make a proxy Production-eligible.

Creation mechanism and deployment model are separate axes. Creation evidence
records `CREATE` or `CREATE2`, the native identity that executed the creation
opcode, the salt or its required absence, the SHA-256 init-code digest, the
derived contract address, and evidence references. The transaction sender and
creator are separate facts: a factory may be the creator even when an externally
owned account submitted the transaction; for a direct `CREATE` transaction they
may have the same value. The creation input is the exact init code, constructor
arguments are its exact suffix, and creation bytecode is the remaining prefix.
For `CREATE2`, verification derives the address from the creator, salt, and
Keccak-256 init-code digest according to the EVM rule and compares it with both
the claimed derived identity and Core native identity.

For an EVM manifest, `core.artifact_digest` is the SHA-256 digest of compiler
creation-bytecode bytes before constructor arguments, while
`core.runtime_code_digest` is the SHA-256 digest of the exact live runtime-code
byte string. They are deliberately different evidence axes.

The SVM evidence branch records the genesis identity, Program ID, loader and
ProgramData identities, loader model, exact initialization instructions or an
evidenced declaration that none exist, Executable and Linkable Format (ELF),
Interface Definition Language (IDL), and build-environment digests,
reproducible-build and live-program evidence, immutable state-account
commitments or an evidenced code-only declaration, dependency evidence, and
dynamic-target policy digest. Production classification requires evidenced
absence of both upgrade and close authority.

For an SVM manifest, `core.artifact_digest` is the SHA-256 digest of the exact
ELF byte string named by the Binding Release and deployment evidence. An SVM
manifest has no `core.runtime_code_digest`: loader, ProgramData, ELF, and live
program evidence together describe the native executable identity, and an
EVM-style runtime-code byte string would be ambiguous.

Dependencies are classified as Core-Deployment-pinned immutable, runtime
dependencies, or profile-bound external dependencies. An immutable dependency
claim requires evidence that replacement authority is absent. Runtime and
profile-bound dependencies remain named assumptions; listing them does not
promote their behavior to Core evidence.

**[VER-007]** A static manifest is evidence metadata, not settlement authority.
Schema validation proves only that the evidence claim has the required shape.
Production classification requires an independent verifier to resolve every
reference, reproduce artifacts, compare the claimed identities with live chain
state, and confirm that every prohibited Production Core authority is absent.
That verifier also resolves every claimed binding-native and Asset Profile
vector set and test report and confirms the exact-profile coverage and passing
native-case condition required by `CONF-008`.

## Offchain roles

Maintainers may publish standards, interfaces, registries, routing policy,
warnings, and new deployments. Those roles have no authority over an existing
Production Core.

Loss of a website, DNS, GitHub, RPC, indexer, or organization account cannot
change onchain rules. Loss of an immutable Collector claim authority can lose
that Collector's accrued and future claimable fees, but it cannot by itself
move user or Domain assets or redirect other liabilities.
