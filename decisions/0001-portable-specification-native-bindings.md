# 0001: Portable specification with native bindings

- Status: Accepted
- Date: 2026-08-29

## Context

Programmable targets EVM and SVM. Treating one implementation as the universal
source would either force its runtime model into the other runtime or permit
semantic drift behind the same product name.

## Decision

`PROGRAMMABLE-PROTOCOL` owns portable entities, invariants, Protocol Assessment,
evidence classes, versioning, schemas, and semantic vectors.

`PROGRAMMABLE` owns the native EVM contracts, ABI, clients, tests, artifacts,
and deployments. `PROGRAMMABLE-DEX-SOLANA` owns the native Solana program, IDL,
clients, tests, artifacts, and deployments.

Bindings share semantic results, not wire bytes, code, state, liquidity,
custody, addresses, or security evidence.

## Alternatives

- One cross-runtime implementation repository was rejected because release and
  review boundaries are native.
- Making the SVM or EVM repository canonical for portable meaning was rejected
  because it hides the other runtime's authority model.
- Independent undocumented implementations were rejected because equal names
  would not prove equal behavior.

## Security consequences

Every native release pins an exact Protocol release and commit. Portable
changes assess both bindings, but each binding maintains separate implementation
and deployment evidence.

A defect in portable semantics can affect every conforming binding. A defect or
compromise in one native deployment does not establish authority over another
deployment, because bindings do not share custody, administrators, or runtime
identities.

## Compatibility consequences

Portable semantic results can be compared across bindings, but native calldata,
accounts, addresses, state, receipts, and deployment evidence are not mutually
interchangeable. Each binding qualifies against a Protocol release independently
and declares the profiles it implements.

## Affected artifacts

- `protocol-version.json` and the numbered documents under `spec/`
- `bindings/evm.md`
- `bindings/svm.md`
- native release and deployment manifests published by the EVM and SVM
  implementation repositories
