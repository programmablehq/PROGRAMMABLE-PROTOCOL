# 10. Canonical identifiers

- Status: Draft
- Classification: Normative
- Scope: Portable
- Spec ID: `programmable-protocol/0.1.0-draft.1`

## Purpose and boundary

This document fixes the portable canonicalization and Secure Hash Algorithm
256-bit (SHA-256) rules used by shared conformance vectors and the V1
Authorization Scope identity. It does not define a native signature message,
signature scheme, Application Binary Interface (ABI), instruction encoding, or
account representation.

**[ID-001]** A native binding MUST validate the native authorization fields and
construct the exact Scope Descriptor from those validated fields before it
accepts an Authorization Scope ID. A caller-supplied digest is not a substitute
for validation.

Native signature bytes are outside the Scope Descriptor and outside the shared
vectors. Native repositories own signature and wire-byte conformance vectors.

## Hashable portable values

A hashable portable value is a JSON string, Boolean, null, array of hashable
portable values, or object whose values are hashable portable values. Before
canonicalization, an implementation MUST verify all of the following:

1. the input is valid Internet JSON (I-JSON);
2. no object contains duplicate member names;
3. every object member name contains only ASCII characters;
4. every string contains only Unicode scalar values, so an unpaired UTF-16
   surrogate is invalid;
5. JSON number values are absent; and
6. any quantity is represented by its specification-defined canonical decimal
   string.

An implementation that materializes an object before checking duplicate member
names is non-conformant because a parser may already have discarded one value.
Unicode string values are not normalized. For example, a precomposed character
and a decomposed character remain different values. Because member names are
ASCII, the JSON Canonicalization Scheme (JCS) member order is also ASCII
lexicographic order for the permitted names.

**[ID-002]** Validation failure MUST occur before JCS or hashing. Replacing an
invalid value, normalizing Unicode, accepting a JSON number that happens to be
an integer, or selecting one duplicate member is prohibited.

## Canonical JSON test digest

The Canonical JSON Test Digest exists only to make parser, validation, JCS, and
SHA-256 behavior independently testable. It is not a Market, Scope, or
deployment identity.

For a valid hashable portable value `V`:

```text
CanonicalJsonTestDigest(V) =
  "sha256:" || lowercase_hex(
    SHA-256(
      UTF8("programmable:canonical-json-test:v1") || 0x00 || JCS(V)
    )
  )
```

The JCS output contributes its exact UTF-8 bytes. Whitespace and member order in
the parsed source do not contribute. Escapes contribute the Unicode scalar
value they encode, not the spelling of the source escape.

**[ID-003]** Implementations MUST produce the same Canonical JSON Test Digest
for source texts that parse to the same valid value and MUST reject every
invalid source before producing a digest.

## Authorization Scope Descriptor V1

An Authorization Scope Descriptor is the signature-free, computed-ID-free
semantic preimage for one Principal Authorization. V1 contains:

- the Protocol Spec ID and Constitution ID;
- the runtime, chain reference, Core Deployment ID, and binding Scope domain
  separator;
- the authorization profile, Principal ID, and Principal nonce;
- the ordered Execution Targets, including each Market, Engine Revision,
  participating Liquidity Domain Revisions, action-payload digest, and phase;
- the per-asset Asset Profile, native asset, gross debit, assessment,
  withholding, recipient, and minimum-credit bounds;
- when present, each exact sponsored-assessment authorization, binding the
  assessment Principal's Scope and identity, asset tuple, maximum gross
  assessment debit, and immutable Protocol Collector;
- the deadline; and
- the partial-fill and cancellation rules.

The exact shared vector shape is `scope_descriptor_v1` in
`schemas/canonical-identifiers-v1-vectors.schema.json`. Monetary quantities and
the Principal nonce are canonical non-negative decimal strings. Target order
and the order of Domain Revisions and asset authorizations are significant.
Object member order is not. A Domain Revision ID MUST NOT occur twice within
one Target, and the same Asset Profile and native asset tuple MUST NOT occur
twice within one descriptor. A sponsored-assessment tuple of assessment Scope,
Asset Profile, and native asset MUST NOT occur twice. Its asset tuple MUST have
a matching sponsor asset authorization whose assessment and total gross-debit
limits cover the sponsored maximum.

The V1 descriptor accepts only the Constitution-selected
`direct-one-shot-v1`, `signed-one-shot-v1`, and `stored-scope-v1` authorization
profiles. A profile name outside that vocabulary is not an extension point and
MUST be rejected before hashing.

`direct-one-shot-v1` authenticates the Principal through the binding's exact
current-call authority profile and carries no detached signature.
`signed-one-shot-v1` authenticates a detached native signature or contract-
wallet authorization over the exact descriptor. Each binding defines the
admitted native authority and signature bytes and hostile vectors. Both are
single-use and share the same descriptor grammar and ID algorithm; neither
lets a native caller, submitter, or router silently replace the Principal.

The action-payload digest commits arbitrary Engine-defined action data without
creating a finite action catalogue in Core. The recipient-policy digest commits
either exact recipients or an exact Core-enforceable recipient predicate.

**[ID-004]** Every authority-relevant Principal Authorization field MUST be
represented directly in the Scope Descriptor or by an exact commitment field
defined by the selected Core major. An omitted field cannot be inferred from a
submitter, transaction, mutable registry, display value, or Engine response.

The following values are not members of the Scope Descriptor and do not
contribute to the Scope ID:

- the computed Authorization Scope ID;
- any native signature, signature byte string, recovery identifier, or
  signature container; and
- transaction hashes, fee payers, relayers, routers, and submitters unless one
  is independently an authority-relevant field explicitly authorized by the
  Principal and therefore represented by a future Core-major descriptor.

**[ID-005]** A binding MUST reject a descriptor that contains a computed Scope
ID or signature material. Removing those fields only after hashing is not
equivalent to constructing the descriptor without them.

## Authorization Scope ID V1

For a valid Authorization Scope Descriptor V1 `D`:

```text
AuthorizationScopeIdV1(D) =
  "sha256:" || lowercase_hex(
    SHA-256(
      UTF8("programmable:authorization-scope:v1") || 0x00 || JCS(D)
    )
  )
```

The binding Scope domain separator is a field inside `D`; the fixed prefix above
separates this identifier type from every other Programmable identifier type.

The identity algorithm is shared by `direct-one-shot-v1`,
`signed-one-shot-v1`, and `stored-scope-v1`. The selected profile is inside the
descriptor and therefore changes the Scope ID. It defines lifecycle behavior;
it does not select a different hash function.

**[ID-006]** Core MUST authenticate the Principal and all descriptor fields,
verify the Principal nonce under the binding's replay rules, and consume, store,
or close the Scope exactly as required by the selected profile. A direct or
signed one-shot Scope is single-use. A stored Scope retains one identity across
authorized partial fills and MUST preserve its cumulative use, Protocol
Assessment basis, expiry, replay, and cancellation state. A Fill sequence or
transaction identity MUST NOT replace the stored Scope identity.

**[ID-007]** Changing the authorization profile, Principal, nonce, runtime,
chain, Core Deployment, Constitution, binding Scope domain separator, ordered
Target, Engine Revision, Domain Revision, asset authorization, deadline,
partial-fill rule, cancellation rule, or sponsored-assessment authorization
MUST change the Scope ID.

## Multiple Principals

An Envelope with multiple Principals does not have one shared authorization
Scope. Each Principal has a separate descriptor, nonce, authentication, limits,
and Scope ID. The same ordered Targets do not collapse those Scopes.

**[ID-008]** Core MUST derive, verify, record, and consume each Principal's
Scope independently. A valid Scope for one Principal cannot authorize another
Principal, including a fee-funding Principal.

## Conformance vectors

`vectors/canonical-identifiers-v1.json` provides exact source bytes, canonical
bytes, digests, rejection codes, and digest relations. Source JSON is encoded as
lowercase hexadecimal UTF-8 bytes so invalid JSON and lone-surrogate escapes can
be represented without making the vector document itself invalid.

Every case lists its required conformance profiles. A case with
`expected_digest` MUST complete successfully and match it exactly. A case with
`reject_code` MUST fail before producing a digest. Relation entries additionally
require the named accepted case digests to be equal or distinct.

Case IDs and relation IDs are unique within the vector set. Every relation
references exactly two accepted cases in that same vector set.

**[ID-009]** Passing the shared vectors proves only portable identity behavior.
It does not prove native message construction, signature verification, replay
state, authorization enforcement, deployment identity, or production safety.
