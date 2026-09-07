![Programmable](https://raw.githubusercontent.com/programmablehq/PROGRAMMABLE/903b3741a6cd2981788cb09c039f0c47994c5d62/public/brand/programmable-cover.png)

# Programmable Protocol

This repository defines the runtime-neutral protocol semantics and conformance artifacts for Programmable. Native implementations live in separate repositories:

- [`PROGRAMMABLE`](https://github.com/programmablehq/PROGRAMMABLE) is the
  designated EVM implementation repository. No binding release or conformance
  report for it is recorded in this Protocol repository yet.
- [`PROGRAMMABLE-DEX-SOLANA`](https://github.com/programmablehq/PROGRAMMABLE-DEX-SOLANA)
  is the designated native SVM implementation repository. No binding release
  or conformance report for it is recorded in this Protocol repository yet.

The EVM binding targets Robinhood Chain. A binding release and its conformance evidence define implementation support; this specification does not define a production deployment.

The bindings share protocol meaning. They do not share bytecode, state, liquidity, custody, deployment identities, or security evidence.

## Current status

| Item | State |
| --- | --- |
| Protocol version | `0.1.0-draft.1` |
| Specification status | Draft implementation baseline |
| Production eligible | No |
| Production deployments defined here | None |

This repository is a specification and conformance suite. It is not a deployed decentralized exchange (DEX), an audit, or proof that either native binding is safe for production assets.

## Model

Programmable separates programmable economics from protected asset authority:

| Component | Responsibility |
| --- | --- |
| Principal | Authorizes the exact assets, recipients, limits and expiry. |
| Engine | Defines market behavior and supplies a bounded execution plan. |
| Core | Checks authorization, protected effects, conservation and assessment before settlement. |
| Receipt | Records the committed result and the authority behind each claim. |

An Engine can define curves, auctions, orders, lifecycle transitions, access rules, non-fungible selection, or a mechanism that has no existing product name. The Core does not contain a fixed list of market products or Engine-defined action identifiers.

The Core owns only the narrow authority envelope required to enforce exact authorizations, participating liquidity domains, supported protected effects, conservation, the Protocol Assessment, atomic commitment, and truthful evidence. Core grants arbitrary code no ambient protected authority over unrelated assets; authority an Engine already holds outside Core remains outside that containment claim.

## Execution flow

1. An Engine author deploys arbitrary market logic and publishes its exact
   native code or mutability policy.
2. A Market binds that Engine Revision, immutable policy, and the Capability
   profiles it may request. The Market does not grant access to existing
   liquidity.
3. Each participating Liquidity Domain Revision independently admits the
   Market, asset profiles, and bounded authority it accepts.
4. Each affected Principal authorizes exact Execution Targets, assets,
   recipients, gross limits, assessment limits, Scope, replay state, and
   expiry.
5. Core intersects those independent bounds. It rejects any unknown protected
   operation or wider authority before protected movement.
6. The Engine supplies an atomic plan or participates in a bounded session.
   Core observes actual asset behavior, settles only covered protected effects,
   applies Protocol Assessment V1, and atomically reverts on a required failure.
7. Core commits a Receipt whose provenance distinguishes Core facts, profile
   facts, Engine assertions, external dependencies, and offchain derivations.

An Engine can also expose its own entry points and custody outside Core. Those surfaces remain programmable, but they do not inherit Core enforcement or Protocol Assessment coverage.

## Protocol Assessment V1

Every applicable canonical assessment group uses a fixed nominal rate of five basis points, computed by the exact cumulative-floor formula:

```text
A(B)      = floor(B / 2,000)
fee_delta = A(B_after) - A(B_before)
```

`B` is `PrincipalFundedGrossDebitV1`, not a label supplied by an Engine and not all semantic DEX volume. The exact basis, grouping, refund, asset-tax, and reporting rules are normative in [`spec/03-protocol-assessment.md`](spec/03-protocol-assessment.md).

## Repository map

```text
spec/        normative runtime-neutral semantics
constitution/ selected machine-readable Core-major constitution
bindings/    required native EVM and SVM interpretations
schemas/     machine-readable artifact contracts
vectors/     cross-language conformance vectors
examples/    non-normative market templates and manifest shape fixtures
decisions/   accepted architecture decisions
tools/       deterministic repository validation
```

Start with [`spec/00-status-and-scope.md`](spec/00-status-and-scope.md), then read the numbered specification in order. Definitions are in [`spec/glossary.md`](spec/glossary.md).

## Validate the repository

Node.js 20 or newer and npm are required.

```bash
npm ci
make check
```

The check validates release inventory, JSON schemas, Constitution identity, example identifiers, every listed semantic vector suite, vector-set identity, portable Conformance Report coverage, typed binding-native and Asset Profile release-chain relations, portable-runtime boundaries, and local links.

## Change discipline

Normative changes require an explicit compatibility analysis. A production Core major is immutable and adminless at deployment; a behavioral change is a new side-by-side Core identity, never an in-place upgrade. See [`spec/05-versioning.md`](spec/05-versioning.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Product and community

The existing launch platform has separate interfaces and fee contracts documented in the [product docs](https://programmable.market/docs). Protocol Assessment V1 in this repository is not the Custom Launch or Module Mode trading fee.

[Platform](https://programmable.market) · [Discord](https://discord.com/invite/programmable) · [X](https://x.com/ProgrammableHQ) · [Dune](https://dune.com/programmablehq/analytics)

## License

The specification, schemas, vectors, examples, and tools in this repository are licensed under the Apache License 2.0. Native implementation repositories are licensed independently; consult each repository for its current terms.
