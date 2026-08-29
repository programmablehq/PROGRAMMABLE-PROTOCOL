# 04. Evidence and discovery

- Status: Draft
- Classification: Normative
- Scope: Portable
- Spec ID: `programmable-protocol/0.1.0-draft.1`

## Evidence model

Every factual field exposed by Core, an Engine, a binding, or an offchain
system has one primary provenance class, may name zero or more external
dependencies, and has a separate support status where support is relevant.

| Class | Meaning |
| --- | --- |
| `CORE_VERIFIED` | The exact deployed Core directly authenticated and enforced the fact. |
| `PROFILE_VERIFIED` | The fact follows only under an exact supported asset, custody, settlement, or exit profile. |
| `ENGINE_ATTESTED` | The selected Engine supplied the claim; Core binds its bytes but does not prove its economic meaning. |
| `OFFCHAIN_DERIVED` | An indexer, router, interface, or analytics system computed the claim. |

An external dependency qualifier names the oracle, issuer, bridge, external
contract or program, sequencer, or other system on which correctness or
availability depends. Support status is `SUPPORTED` or `UNSUPPORTED` for the
exact Core major and profile. Execution coverage remains the separate
`CORE_ENFORCED`, `PARTIAL`, or `NONE` axis.

**[EVID-001]** A client, indexer, Engine, binding, or interface MUST NOT relabel
a fact with a different provenance class without the exact proof required by
that class. The classes are not a total trust ranking. Transaction success
alone is not `CORE_VERIFIED` evidence.

Examples:

- Core can verify the gross source debit it committed.
- An Asset Profile can verify the spendable credit it observed under its exact
  token behavior.
- An Engine can attest that an opaque state value is a price.
- Core may verify the exact oracle identity and bytes it observed while the
  truth of the oracle's claim remains separately qualified by that named
  external dependency.
- USD volume is offchain-derived.

## Canonical Receipt model

A normalized Receipt for a committed Envelope contains:

- a binding-derived Receipt ID and the exact Receipt-identity inputs: Envelope
  ID, Core Deployment ID, plan or final transcript digest, and a
  binding-specific ledger evidence reference;
- exact Protocol release, Constitution, and Core Deployment identities;
- ordered Execution Target, Market, and effective Engine Revision identities;
- execution coverage: `CORE_ENFORCED`, `PARTIAL`, or `NONE`;
- each affected Principal, its Authorization Scope, authenticated evidence
  reference, replay mode, replay state, and fill sequence;
- participating Liquidity Domain Revisions;
- exactly one atomic-plan or bounded-session commitment;
- each segment's proposed-effect commitment and realized-observation
  commitment when a bounded session was used;
- each supported protected Effect occurrence, its type and transcript
  position, provenance class, named dependencies, support status, execution
  coverage, and evidence reference;
- each Protocol Assessment group's full six-field key;
- `basis_before`, `fill_basis`, and `basis_after`;
- `assessment_before`, `assessment_delta`, and `assessment_after`;
- `remainder_before` and `remainder_after` as derived reporting fields;
- assessed gross debit, observed external asset withholding, funded credit, and
  liability delta;
- opaque Engine output digest labeled `ENGINE_ATTESTED`;
- the final zero temporary-obligation checkpoint for a bounded session.

The reusable strict V1 shape is
`urn:programmable:schema:evidence-vectors:v1#/$defs/normalized_receipt` in
[`../schemas/evidence-v1-vectors.schema.json`](../schemas/evidence-v1-vectors.schema.json).
The conformance harness supplies a `committed_context` beside the Receipt as
the authenticated reference facts against which reconstruction is checked.
That test context is not a Receipt field and is not a native authorization
encoding.

`committed_context.protected_effect_occurrences` contains the complete ordered
authenticated rows, including Effect type, Target, Scope, commitment position,
provenance, dependencies, support, execution coverage, and evidence reference.
An occurrence-ID-only list is not sufficient reference evidence for Receipt
reconstruction.

The `receipt_identity_inputs` object makes Receipt-ID reconstruction explicit.
Its `execution_commitment_digest` is the atomic `plan_digest` or the bounded
session's `final_transcript_digest`, according to the selected profile. A
bounded commitment additionally contains Session ID, every ordered segment's
proposed-Effect and realized-Observation digests, and the final zero-obligation
checkpoint. An atomic commitment contains no Session fields.

Each `principal_authorization_states` row binds one affected Principal to one
Scope, authorization evidence reference, replay mode and state, and fill
sequence. Each `protected_effect_occurrences` row binds one typed Effect
occurrence to its Target, Scope, atomic or session position, and all four
evidence axes. The fact that Core committed that occurrence is
`CORE_VERIFIED`; any profile-derived debit, credit, or postcondition fact named
by its evidence reference retains its own separate provenance. Each
`opaque_engine_outputs` row binds arbitrary Engine return bytes only by digest
and evidence reference. Empty or application-defined return bytes remain
valid; their meaning remains `ENGINE_ATTESTED` even when Core authenticates
which Engine returned the bytes.

Envelope, Session, and Receipt identities are distinct. An Envelope ID binds
the complete authenticated execution request, ordered Targets, execution
profile, and Principal Scopes. A Session ID additionally binds the bounded
session state machine and its initial transcript commitment. A Receipt ID binds
the exact committed Envelope, final transcript or plan digest, Core Deployment,
and binding-defined ledger position. Native bindings define the canonical bytes
and publish vectors for all three identities.

**[EVID-002]** Receipt fields MUST distinguish a zero-valued applicable
assessment from the absence of an applicable assessment group.

**[EVID-009]** Receipt reconstruction MUST preserve the exact ordered
Execution Target, Market, and Engine Revision tuple and the exact Principal,
Scope, replay, fill, participating Domain Revision, protected Effect,
assessment-group, and opaque-output relationships committed by the Envelope.
Omission, substitution, duplication, or re-association of one identity under
another valid identity invalidates the Receipt.

**[EVID-010]** The execution profile, execution commitment kind, and
Receipt-identity commitment digest MUST agree. For `ATOMIC_PLAN_V1`, the
identity digest is the plan digest. For `BOUNDED_SESSION_V1`, it is the final
ordered transcript digest and the Receipt MUST also reproduce the exact Session
ID, segment commitments, and final checkpoint.

**[EVID-011]** Every protected Effect occurrence in a Receipt MUST name its
defined protected Effect type, Core-derived occurrence ID, Target, Scope,
commitment position, provenance, named dependencies, support status, execution
coverage, and evidence reference. Every opaque Engine output MUST remain
`ENGINE_ATTESTED`; a digest, authenticated producer, named dependency, or
support label MUST NOT promote its economic meaning.

**[EVID-012]** Every applicable Protocol Assessment group MUST appear exactly
once with its complete six-field key and internally consistent cumulative
basis, assessment, remainder, gross debit, external withholding, funded-credit,
and liability values. The Receipt's group-key set MUST equal the set of
applicable groups derived by Core. A group whose applicable debit floors to
zero is present; a group with no applicable debit is absent.

**[EVID-003]** Native events may be smaller than the normalized Receipt, but a
binding claiming receipt conformance MUST define how authenticated native events
and Core state reconstruct every required field without trusting an indexer's
interpretation.

**[EVID-004]** A pre-settlement Engine response or plan digest MUST NOT be
reported as final Engine state when a later token, NFT, driver, or other
untrusted callback can mutate the Engine. Final Engine-state evidence requires a
post-callback checkpoint or a binding proof that later calls cannot reach that
state.

**[EVID-008]** A bounded-session Receipt MUST commit to every ordered segment,
observation, effect occurrence, obligation transition, participating Domain
Revision, and final checkpoint. An omitted segment, reordered transcript, or
nonzero final obligation invalidates receipt reconstruction.

**[EVID-013]** A bounded-session normalized Receipt MUST report zero remaining
temporary obligations, assert that all obligations are zero, and reproduce the
exact final checkpoint and obligation-state digests committed by Core. A
schema-complete but mismatched checkpoint is not valid evidence.

## Authenticity

An indexer must validate more than a transaction identifier. The binding must
define:

- the exact emitting Core identity and invocation context;
- event or state discriminator and schema revision;
- Execution Target, Market, Engine Revision, Domain Revision, and Scope
  identity derivation;
- plan digest binding;
- state checkpoint or liability relationship; and
- chain-specific finality and reorganization handling.

**[EVID-005]** An Engine-emitted event, matching event signature, copied
discriminator, or success log MUST NOT be accepted as a Core Receipt.

No trade requires one global writable sequence or analytics counter. Bindings
may use Domain-sharded or Scope-local ordering and deterministic receipt
identity.

## Discovery

Onchain creation and execution are permissionless. Discovery is evidence-based,
not authority-based.

A registry, interface, or indexer may publish:

- known Core Deployments and release evidence;
- Markets, Domains, Engine Revisions, and Asset Profiles;
- conformance and review records;
- routeability and simulation support; and
- risk or curation opinions.

**[DISC-001]** Registry inclusion, omission, labels, or signatures MUST NOT
change Core settlement authority or be required for direct onchain use.

## Quote and routing profiles

Quote and distribution support is classified independently from safety:

- `DETERMINISTIC_ROUTEABLE`: a public deterministic quote and execution
  profile is implemented;
- `SIMULATED_DIRECT`: direct execution can be simulated, but general routing is
  not guaranteed; or
- `INDEX_ONLY`: the surface can be discovered but has no standard quote route.

**[DISC-002]** A quote profile MUST NOT be represented as evidence of Engine
safety, liquidity quality, aggregator acceptance, or Core coverage.

## Reporting

Offchain systems may aggregate or value facts only when the source rows remain
recoverable.

**[EVID-006]** An offchain valuation MUST name the source assets and profiles,
price source, observation time, and method. It MUST remain labeled
`OFFCHAIN_DERIVED` and MUST NOT alter onchain Protocol Assessment state.

Builder, creator, LP, maker, integrator, asset-external, and interface economics
are separate reporting buckets. A disclosure component already contained in a
gross Principal debit is not added again.

## Release evidence

Binding release evidence and deployment evidence are separate artifacts:

- a Binding Release manifest binds source, commit, toolchain, native interface,
  artifacts, hashes, claimed portable profiles, typed binding-native and Asset
  Profile claims, their separate vector and test-report digests, and the
  cross-runtime Conformance Report;
- a deployment manifest binds a release to one chain, Core identity,
  deployment transaction and ledger position, actual code identity,
  Constitution, Collector, and runtime authority state.

Portable JSON artifact and vector-set digest algorithms are defined in
[`11-release-artifact-identity.md`](11-release-artifact-identity.md). Native
executable and interface digests use the authoritative byte sources defined by
their binding.

**[EVID-007]** Schema-valid, source-conformant, artifact-matched,
onchain-verified, independently reviewed, and production-eligible MUST remain
separate statuses. A single `verified` boolean is non-conforming.
