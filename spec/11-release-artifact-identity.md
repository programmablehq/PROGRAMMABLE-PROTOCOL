# 11. Release artifact identity

- Status: Draft
- Classification: Normative
- Scope: Cross-runtime
- Spec ID: `programmable-protocol/0.1.0-draft.1`

## Purpose

Conformance and deployment records refer to exact bytes, not filenames or
self-declared version labels. This document defines portable JSON and vector-set
identities. Native executable, interface, and ledger identities remain binding
specific because their authoritative bytes differ by runtime.

## Portable JSON artifact digest

For a valid portable JSON document whose root `$schema` value is `schema_id`,
define:

```text
JsonArtifactDigestV1(document) =
  "sha256:" || lowercase_hex(
    SHA-256(
      UTF8("programmable:json-artifact:v1") || 0x00 ||
      UTF8(schema_id) || 0x00 ||
      JCS(document)
    )
  )
```

`JCS` is the JSON Canonicalization Scheme from RFC 8785. The input document
must first satisfy the I-JSON, duplicate-key, ASCII-key, and numeric-value rules
in [`01-semantic-model.md`](01-semantic-model.md). No field is excluded unless
the schema and the identifier-specific algorithm explicitly say so.

**[ARTIFACT-001]** A digest labeled `JsonArtifactDigestV1` MUST use the exact
domain prefix, separators, schema identifier, and canonical document above. It
MUST NOT hash a path, pretty-printed source, parsed object with inherited
properties, or document with duplicate keys.

## Vector-set digest

For one Protocol release, take the exact `conformance_vectors` paths listed in
`protocol-version.json`. Sort them by ascending Unicode code-point order. Paths
must be repository-relative ASCII strings with `/` separators, no empty
segment, no `.` or `..` segment, and no percent-encoded path segment.

For each path, parse and validate the vector document and construct:

```json
{
  "artifact_digest": "JsonArtifactDigestV1(vector_document)",
  "path": "vectors/example-v1.json",
  "schema_id": "the vector document's exact $schema value"
}
```

The vector-set manifest is the ordered JSON array of those records. Define:

```text
VectorSetDigestV1(manifest) =
  "sha256:" || lowercase_hex(
    SHA-256(
      UTF8("programmable:vector-set:v1") || 0x00 || JCS(manifest)
    )
  )
```

**[ARTIFACT-002]** A Conformance Report, Binding Release, and resolved deployment
claiming this Protocol release MUST bind the exact portable
`VectorSetDigestV1` result. Adding, removing, renaming, reordering, or changing
a listed vector changes the manifest or one of its entries and therefore
changes the digest.

## Native conformance artifact pins

A binding-native or Asset Profile claim carries two independent pins:

- `native_vector_set_path` and `native_vector_set_digest` identify the exact
  binding-owned vector-set document; and
- `native_test_report_path` and `native_test_report_digest` identify the exact
  binding-owned report produced for those vectors.

Each path is relative to the binding release evidence package. The binding
defines the authoritative byte representation and MUST use lowercase SHA-256
for each recorded digest. A native vector-set digest is not a substitute for
its test-report digest, and neither is a substitute for the portable
`VectorSetDigestV1`.

**[NATIVE-001]** Every native conformance pin MUST remain unchanged across the
Conformance Report, Binding Release, and deployment manifest. Artifact-chain
validation MUST compare the complete typed claim by profile ID and reject a
missing, additional, retyped, or digest-mismatched claim.

## Native artifact digest records

A native binding release may contain several artifacts. Every digest record
identifies:

- a stable record name;
- artifact kind;
- exact authoritative byte source or deterministic generation rule;
- digest algorithm;
- lowercase digest value; and
- where the artifact is found in the pinned source tree or release package.

Examples of different authoritative byte sources include deployed runtime
bytecode, creation bytecode, a Solana Bytecode Format artifact,
Application Binary Interface JSON, and Interface Definition Language JSON.
They are not interchangeable.

**[ARTIFACT-003]** A bare array of digest strings is non-conforming. A binding
MUST NOT use one source-file hash as proof of executable, interface, deployment,
or onchain identity unless the binding defines why those authoritative bytes
are exactly identical.

## Evidence boundary

Portable digest agreement proves deterministic identity only. It does not
prove semantic conformance, successful tests, reproducible compilation,
deployed code identity, authority state, or production eligibility.

**[ARTIFACT-004]** Tools and documentation MUST report each of those evidence
axes separately. A matching digest MUST NOT be summarized as a general
`verified` result.

## Release artifact chain

A Conformance Report is identified by `JsonArtifactDigestV1(report)`. A Binding
Release carries that digest and is itself identified by
`JsonArtifactDigestV1(binding_release)`. A deployment manifest carries the
Binding Release digest. Resolution means locating a document whose computed
digest equals the reference; copying the referenced digest into an unrelated
document does not establish the relation.

The Binding Release and its report agree exactly on:

- Binding ID;
- Protocol Spec ID and Protocol commit;
- Constitution ID;
- implementation/source commit;
- portable vector-set digest;
- claimed portable profile set;
- complete typed binding-native profile claim set;
- complete typed Asset Profile claim set; and
- toolchain.

All portable vector cases applicable to the exact claimed portable profile set
must pass. Cases requiring an unclaimed optional profile remain
`not_applicable` under the conformance rules and do not silently expand the
release claim.

**[ARTIFACT-005]** A Binding Release MUST resolve one exact Conformance Report
by `JsonArtifactDigestV1`, satisfy every relation above, and have a passing
result for every applicable case. A release with an unresolved, mismatched, or
failing report is non-conforming even when each document separately satisfies
its JSON Schema.

The Protocol commit is independently checked as a commit object in the Protocol
repository. Reading `protocol-version.json`, the selected Constitution, and all
listed conformance vectors from that commit must reproduce the claimed Protocol
Spec ID, Constitution ID, and `VectorSetDigestV1`. A Protocol repository may
contain zero Binding Releases and zero Conformance Reports before its first
commit; absence is not replaced with a synthetic commit or placeholder report.

A deployment claim resolves its Binding Release by exact digest and then agrees
with it on runtime family, Constitution, portable profiles and vector-set
digest, complete typed native claim sets, native source commit, interface
digest, and executable artifact digests. EVM deployments bind the
ABI, creation bytecode, and runtime bytecode independently. SVM deployments bind
the IDL and ELF independently.

**[ARTIFACT-006]** A deployment classified `testnet_candidate` or `production`
MUST resolve its exact Binding Release and satisfy the native artifact relation.
A document classified `example` is only a schema-shape fixture; its placeholder
digest is explicitly not a deployment or release claim.

**[ARTIFACT-007]** For `production` classification, artifact-chain resolution
MUST continue through the Binding Release's `protocol_commit` to the exact
`protocol-version.json` at that commit. That release inventory MUST have
`status` equal to `final` and `production_eligible` equal to `true`. The current
working tree, a repository branch, or a different Protocol commit cannot supply
either value for the deployment claim.
