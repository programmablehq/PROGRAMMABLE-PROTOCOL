# 07. Conformance

- Status: Draft
- Classification: Normative
- Scope: Cross-runtime
- Spec ID: `programmable-protocol/0.1.0-draft.1`

## Meaning of conformance

Conformance is an exact claim about one implementation commit, Binding Release,
portable profile set, portable vector set, binding-native profile set, Asset
Profile set, and their test reports. It is not a general quality or safety
rating.

**[CONF-001]** A binding MUST pin the exact Protocol release and commit, list
every claimed profile in its correct taxonomy, execute every required vector
for those profiles, and publish failures. It MUST NOT omit an applicable vector,
represent `not_applicable` as `pass`, or represent native coverage as portable
coverage.

## Profiles

The first conformance vocabulary contains:

- `portable-core-v1`: semantic entities, evidence classes, one-shot
  Authorization, Core-mediated protected effects, Domain isolation, atomicity,
  and ProtocolAssessmentV1;
- `stored-scope-v1`: persistent Scope, fill sequencing, cumulative limits,
  cancellation, and cumulative assessment;
- `bounded-session-v1`: ordered segments, exact temporary outflows, realized
  observations, and obligation closure inside one atomic Envelope;
- `sponsored-assessment-v1`: separately authenticated fee-funding Principal;
- `external-asset-tax-v1`: observed gross debit, withholding, spendable credit,
  and funded liability behavior;
- `engine-independent-exit-v1`: exact profile-defined exit without Engine or
  hosted-service authority.

`portable-core-v1` is required for any Core conformance claim. The other
profiles are optional until claimed. An implementation must reject unsupported
profile requests before protected movement.

The selected Constitution lists portable conformance profiles that a native
binding may implement; it does not enumerate or approve runtime-specific or
Asset Profile identifiers. A Binding Release and deployment state the exact
portable subset plus separately typed native claims.

The profile namespaces are distinct:

| Taxonomy | V1 identifiers | Meaning |
| --- | --- | --- |
| Execution | `ATOMIC_PLAN_V1`, `BOUNDED_SESSION_V1` | Core orchestration model selected for an Envelope |
| Authorization | `direct-one-shot-v1`, `signed-one-shot-v1`, `stored-scope-v1` | Principal authentication and Scope lifecycle selected by a Scope Descriptor |
| Portable conformance | the six lowercase identifiers above | Independently claimed shared semantic coverage |
| Binding-native conformance | binding-defined identifiers | Runtime-specific interface, encoding, identity, state, call, signature, and event behavior |
| Asset Profile conformance | binding-defined identifiers | Exact native asset behavior, authority, observation, and accounting rules |
| Native code policy | binding-defined identifiers | Machine-checkable rules for code identity, configuration, and dependencies; claimed through an applicable binding-native profile |

`bounded-session-v1` conformance covers the `BOUNDED_SESSION_V1` execution
profile. `stored-scope-v1` conformance covers the authorization profile of the
same name. The remaining execution and authorization identifiers are not
aliases for conformance profiles. A Constitution permits only the portable
conformance identifiers. A binding owns and versions its binding-native and
Asset Profile identifiers without inserting them into the Constitution.

**[CONF-006]** Every shared vector case MUST list the exact portable
conformance profiles that make it applicable. Every listed profile MUST be
permitted by the selected Constitution. A checker MUST fail closed on an
unknown profile or an unregistered vector schema.

## Shared versus native vectors

Shared vectors cover semantic inputs and outputs such as:

- stable portable document identity;
- Protocol Assessment grouping, arithmetic, fills, Refunds, and external tax;
- evidence-class preservation; and
- manifest relationships.

Native repositories own:

- Application Binary Interface (ABI), calldata, event-topic, storage, and
  signature vectors for the Ethereum Virtual Machine (EVM); and
- instruction, account, program-derived address (PDA), cross-program invocation
  (CPI), Interface Definition Language (IDL), and event-transport vectors for
  the Solana Virtual Machine (SVM).

Each binding-native or Asset Profile claim identifies one binding-owned native
vector-set document and one binding-owned native test report by repository path
and digest. The native vector set states the exact profile ID that makes each
case applicable. The native test report records the results for that exact set.
The claim applies both artifacts to the implementation commit named by the
enclosing Conformance Report and Binding Release; each digest independently
pins the artifact bytes.

**[CONF-007]** Portable profile claims, binding-native profile claims, and Asset
Profile claims MUST remain three disjoint identifier sets. Each binding-native
or Asset Profile claim MUST bind an exact native vector-set path and digest and
an exact native test-report path and digest. A claim with a missing, duplicate,
retyped, or mismatched profile ID or digest is non-conforming.

**[CONF-008]** A Binding Release verifier MUST resolve each claimed native
vector set and native test report from the exact implementation commit or
content-addressed release package, recompute both digests, and verify that the
report covers the exact claimed profile and vector set. Every native case
applicable to the claim MUST pass. Portable artifact-chain equality cannot
substitute for this binding-owned semantic verification.

**[CONF-002]** Shared semantic equality does not require identical wire bytes.
Native bytes cannot silently redefine shared meaning.

## Required report fields

A conformance report records:

- exact Protocol Spec ID, Constitution ID, and Protocol commit;
- portable vector-set identity;
- binding ID and implementation commit;
- native toolchain and test environment;
- claimed portable profiles;
- typed binding-native and Asset Profile claims, including their native
  vector-set and test-report identities;
- one result for every applicable portable case; and
- exact failure details for any non-pass result.

Allowed case statuses are `pass`, `fail`, and `not_applicable`.
`not_applicable` is valid only for an optional profile the implementation does
not claim.

**[CONF-005]** A report MUST contain each portable case applicable to its
claimed portable profiles exactly once. Every `fail` result includes non-empty
failure details. Every `not_applicable` result names the unclaimed optional
profile that makes the case inapplicable. The report validator MUST reject
duplicate case IDs, a `not_applicable` case required by a claimed profile, and
any omission relative to the exact pinned portable vector set; JSON Schema
validation alone does not prove case-set completeness.

The `results` array is only the shared portable result set. A native result is
not flattened into that array; it remains in the binding-owned native test
report whose exact digest is carried by the typed claim.

## Validation layers

**[CONF-003]** Reports MUST keep these results separate:

1. artifact syntax and schema validity;
2. shared semantic vector conformance;
3. native binding vector conformance;
4. hostile security-property tests;
5. source-to-artifact reproducibility;
6. live deployment identity and authority verification; and
7. production eligibility.

A pass at an earlier layer does not imply a pass at a later layer.

## Repository check

The command below validates the artifacts owned by this repository:

```bash
npm test
```

It checks:

- duplicate-key-safe JSON parsing and JSON Schema Draft 2020-12 validation;
- selected Constitution identity and cross-artifact consistency;
- canonical decimal and identifier formats;
- Market Template JSON Canonicalization Scheme (JCS) and SHA-256 vectors;
- every listed shared vector through a registered semantic validator;
- unique requirement and case identifiers;
- release inventory completeness;
- portable-layer runtime-leak checks; and
- local Markdown links.

**[CONF-004]** Passing this command proves only that the checked repository
artifacts are internally consistent. It does not prove either native
implementation, a deployment, or production safety.

## Graduation gates

Robinhood EVM architecture and private implementation may begin against this
Draft once its portable documents, schemas, and first vectors are internally
consistent and pinned.

A Robinhood production deployment additionally requires a Final Protocol
release, a complete EVM binding, exact ABI and state model, supported ERC Asset
Profiles, signature and allowance rules, reentrancy and malicious-contract
tests, gas and runtime measurements, reproducible artifacts, live deployment
evidence, and proof that every Production Core authority prohibited by
`05-versioning.md` is absent.
