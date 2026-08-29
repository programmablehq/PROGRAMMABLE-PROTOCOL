# Native implementations

- Status: Draft
- Classification: Informative
- Scope: Cross-runtime
- Spec ID: `programmable-protocol/0.1.0-draft.1`

This file records repository relationships, not conformance or deployment
claims. The table inventories evidence committed to this Protocol repository;
it does not infer the current state of another repository or a chain.

| Binding | Repository | Evidence recorded in this repository | Production deployment recorded here |
| --- | --- | --- | --- |
| EVM | [`programmablehq/PROGRAMMABLE`](https://github.com/programmablehq/PROGRAMMABLE) | No binding release or conformance report | No deployment manifest |
| SVM | [`programmablehq/PROGRAMMABLE-DEX-SOLANA`](https://github.com/programmablehq/PROGRAMMABLE-DEX-SOLANA) | No binding release or conformance report | No deployment manifest |

Robinhood Chain is the first planned EVM target. That planning decision is not
a deployment claim. A native repository becomes a conforming implementation
only after it pins an exact Protocol release and commit, declares its portable,
binding-native, and Asset Profile claims, passes the corresponding vectors and
hostile tests, and publishes the required evidence.

## Required pin format

A native repository must record at least:

```text
protocol_spec_id: programmable-protocol/<exact-version>
protocol_commit: <40-character Git commit>
binding_id: programmable-evm/<exact-version> or programmable-svm/<exact-version>
portable_profiles:
  - <exact profile identifier>
portable_vector_set_digest: <exact portable VectorSetDigestV1>
binding_native_profile_claims:
  - claim_type: binding_native
    profile_id: <exact binding-owned native profile identifier>
    conformance:
      native_vector_set_path: <binding release package-relative path>
      native_vector_set_digest: <exact digest>
      native_test_report_path: <binding release package-relative path>
      native_test_report_digest: <exact digest>
asset_profile_claims:
  - claim_type: asset_profile
    asset_profile_id: <exact binding-owned Asset Profile identifier>
    conformance:
      native_vector_set_path: <binding release package-relative path>
      native_vector_set_digest: <exact digest>
      native_test_report_path: <binding release package-relative path>
      native_test_report_digest: <exact digest>
```

No repository may claim conformance to a branch name or `latest`.
