# Repository instructions

These rules apply to human contributors and automated coding agents.

## Language and tone

- Write all repository content in English.
- Use factual, testable language. Do not add marketing claims.
- Expand a term at first use and use the glossary spelling afterwards.
- Distinguish a specification decision, an implementation, a test result, a
  deployment, and production evidence. None proves the others.

## Source-of-truth order

When artifacts disagree, resolve them in this order:

1. `protocol-version.json` identifies the selected release artifacts;
2. numbered normative documents in `spec/`;
3. the selected Constitution document, which selects but cannot invent or
   override numbered semantics;
4. JSON schemas where the specification delegates exact machine shape;
5. conformance vectors;
6. binding documents;
7. decision records, which explain history but do not override the current
   released specification; and
8. examples and explanatory README content.

Do not leave the conflict in place. Update every affected lower-level artifact
in the same change.

## Architecture boundaries

- Keep runtime-neutral meaning in `spec/`.
- Keep EVM calls, signatures, contract identity, token behavior, gas, and
  reentrancy in `bindings/evm.md` or the EVM implementation repository.
- Keep Solana accounts, program-derived addresses, cross-program invocations,
  token programs, compute, and account locks in `bindings/svm.md` or the SVM
  implementation repository.
- Do not create a fixed enum of market products or user actions.
- Do not give an Engine, adapter, router, or callback ambient Core authority.
- Unknown required protected capabilities fail closed. Unknown opaque Engine
  semantics remain non-Core-verified.

## Compatibility discipline

- Monetary quantities in portable JSON are canonical non-negative decimal
  strings, not JSON numbers or floating-point values.
- Object keys in hashable portable JSON are ASCII.
- Final identifiers are never reused for different semantics.
- A change to authorization, protected effects, assessment economics,
  settlement, evidence meaning, or production authority requires a new Core
  major.
- Examples are non-normative and are not evidence that a native binding
  supports or safely implements the mechanism.

## Required checks

Run `make check` before committing. If a normative document changes, inspect
the schemas, vectors, examples, both binding documents, and
`protocol-version.json` for corresponding changes.

Use small, imperative commit subjects that describe the protocol change. Do
not mention an assistant, model, or generated content in commit messages.

## Safety

Do not add secrets, deployer material, private RPC URLs, or production
addresses without verified release evidence. Do not copy code or tests from
another protocol without a component-level license review.
