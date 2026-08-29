# 00. Status and scope

- Status: Draft
- Classification: Normative
- Scope: Portable
- Spec ID: `programmable-protocol/0.1.0-draft.1`

## Purpose

Programmable Protocol specifies a permissionless decentralized exchange (DEX)
architecture whose market state machines are defined by independent Engines.
It standardizes the narrow shared semantics needed for authorization,
protected capabilities, settlement, Protocol Assessment, evidence, isolation,
and versioning. It does not standardize a fixed list of market products.

**[SCOPE-001]** A conforming native binding MUST preserve the normative
semantics and shared vectors in this repository while implementing its own
runtime-specific authority, asset, call, storage, and deployment rules.

**[SCOPE-002]** Ethereum Virtual Machine (EVM) and Solana Virtual Machine (SVM)
conformance MUST NOT be inferred from shared source code, a common brand, a
matching version label, or a review of the other binding.

## Normative language

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT,
RECOMMENDED, MAY, and OPTIONAL are to be interpreted as described by RFC 2119
and RFC 8174 when, and only when, they appear in uppercase.

Text without a requirement identifier can still be normative. Requirement
identifiers provide stable references for tests and review; they do not create
a second specification.

## Specification authority

The current released artifacts have this precedence:

1. `protocol-version.json` identifies the selected release artifacts.
2. The numbered documents in `spec/` define protocol meaning.
3. The selected Constitution document chooses the exact Core-major subset and
   MUST NOT invent or override numbered semantics. Its embedded status records
   semantic maturity when selected and is part of its immutable identity. A
   later release-level deprecation or withdrawal does not rewrite that field.
4. A JSON schema defines exact machine shape only where the specification
   delegates that shape to the schema.
5. Golden vectors define deterministic expected results without introducing
   new semantics.
6. Binding documents map portable meaning to a runtime and cannot weaken it.
7. Decision records explain accepted choices but do not override the current
   released specification.
8. Examples are informative challenge cases only.

**[SCOPE-003]** A native implementation MUST pin an exact protocol release and
repository commit. It MUST NOT claim conformance to `latest`, an unqualified
major, or a mutable branch.

## Separate status axes

The following statements are independent and MUST be reported separately:

- specification maturity: Draft, Candidate, Final, Deprecated, or Withdrawn;
- binding coverage: which exact portable requirements and typed native profiles
  are mapped;
- implementation conformance: which exact portable vectors, binding-native
  vectors, Asset Profile vectors, and hostile tests pass;
- deployment evidence: which source, artifact, address or Program ID, chain,
  transaction, and authority state are proven; and
- production classification: whether the immutable production release gates
  are satisfied.

The current portable specification is a Draft implementation baseline. It is
sufficient to begin native architecture and private prototype work. It is not
a production release.

## In scope

- Core, Engine, Market, Liquidity Domain, Asset Profile, Principal,
  Authorization Scope, Effect, Capability, Receipt, and evidence semantics;
- exact user-bound execution and capability confinement;
- Protocol Assessment V1;
- runtime-neutral isolation, conservation, atomicity, and failure rules;
- cross-runtime conformance artifacts;
- immutable production-major and side-by-side versioning rules; and
- minimum discovery and release-evidence semantics.

## Out of scope

**[SCOPE-004]** The portable Core MUST NOT require a fixed product enum such as
automated market maker (AMM), swap, bonding curve, auction, non-fungible token
(NFT) sale, game, or launchpad.

The portable specification does not define:

- a canonical pricing curve or liquidity-provider (LP) accounting model;
- an official launchpad, router, frontend, indexer, oracle, bridge, or scanner;
- cross-chain shared state, custody, or liquidity;
- an allowlist of safe Engines, assets, or market types;
- fair-price, profitability, solvency, legality, or asset-legitimacy claims;
- runtime wire bytes, storage layouts, contract addresses, Program IDs, gas,
  compute, account locks, finality, or reorg handling; or
- a governance token or company governance model.

## Permissionless surface

**[SCOPE-005]** A conforming binding MUST permit any party, without a
Programmable signature, private API key, or listing vote, to deploy a compatible
Engine, create a new Market and new Liquidity Domain under public deterministic
rules, submit execution directly to Core, and operate independent interfaces,
routers, indexers, and scanners.

Permissionless creation does not grant access to an existing Liquidity Domain.
A Domain may bind an immutable or explicitly controlled local admission rule.
Permissionless also does not require an official interface or router to display
or route every Market.

## Repository boundary

This repository owns portable meaning, the selected Constitution, schemas,
vectors, and normative binding requirements. Solidity code, ABI, Foundry tests,
and EVM deployments belong in
`PROGRAMMABLE`. Solana program code, Interface Definition Language (IDL),
generated clients, Solana Bytecode Format (SBF) artifacts, and SVM
deployments belong in `PROGRAMMABLE-DEX-SOLANA`.

**[SCOPE-006]** Native interface artifacts MUST be generated from or checked
against the native implementation. A handwritten Application Binary Interface
(ABI) or IDL MUST NOT be treated as proof of implementation behavior.
