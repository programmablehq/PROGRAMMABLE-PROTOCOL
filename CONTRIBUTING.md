# Contributing

Programmable Protocol changes are reviewed as protocol changes, not ordinary
documentation edits. A small wording change can alter what a native Core is
expected to enforce.

## Before opening a change

1. Identify whether the change is explanatory, additive, or behavioral.
2. Read the relevant accepted decision records and numbered specification.
3. State the EVM and SVM consequences separately.
4. Add or update conformance vectors for every deterministic behavior.
5. Run `make check`.

## Change classes

### Explanatory

Clarifies existing meaning without changing valid or invalid behavior. It may
be released as an erratum after conformance artifacts prove there is no
semantic change.

### Additive

Adds optional metadata, a new non-authoritative evidence field, or a new
binding profile without changing existing interpretation. Unknown optional
fields must remain safely ignorable.

### Behavioral

Changes authorization, protected effects, fee basis or rounding, settlement,
evidence meaning, custody, exit behavior, or authority. It requires an accepted
decision record, new conformance vectors, and a new Core major where a
production implementation is affected.

## Decision records

Create `decisions/NNNN-short-title.md` for a material protocol decision. A
record must contain:

- status and date;
- context and the exact decision;
- alternatives considered;
- security consequences;
- compatibility consequences; and
- affected artifacts.

After an accepted record is first included in a tagged Protocol release, it is
append-only. Correct a factual mistake with a dated erratum, and record a
different decision in a new record that explicitly supersedes the old one.
Before first inclusion in a tagged release, maintainers may complete missing
required sections or clarify prose, but a semantic reversal still requires a
superseding record.

## Pull requests

A pull request must explain:

- the observable behavior before and after the change;
- whether a native Core major changes;
- which schemas and vectors cover the change;
- EVM-specific consequences;
- SVM-specific consequences; and
- security assumptions introduced or removed.

Use concise, imperative commits. Keep mechanical formatting separate from
semantic changes when doing so improves reviewability.

## Clean-room rule

Concepts may be studied from public protocols, but code, tests, prose, and
mathematical implementations must not be copied unless their exact license is
compatible and attribution obligations are satisfied. Record external design
sources in the relevant document.

## Security reports

Do not open a public issue for a vulnerability that could affect a deployed or
candidate implementation. Follow [`SECURITY.md`](SECURITY.md).
