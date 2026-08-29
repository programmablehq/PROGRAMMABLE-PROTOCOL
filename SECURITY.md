# Security policy

## Current scope

This repository currently contains a draft specification, schemas, examples,
and conformance tooling. It contains no production Core implementation and
defines no production deployment.

A specification defect can still become a systemic implementation defect.
Treat ambiguity in authorization, accounting, custody, fees, failure behavior,
or evidence as security-sensitive.

## Reporting

Use GitHub private vulnerability reporting for this repository. Do not publish
an exploitable issue, transaction, proof of concept, or affected address before
maintainers have had an opportunity to assess it. If private reporting is not
available, contact an organization maintainer privately and disclose only the
minimum information needed to establish a secure channel.

Include:

- the affected specification section, schema, vector, or implementation;
- the violated invariant;
- the attacker capabilities and required preconditions;
- the maximum affected scope;
- a minimal reproduction when safe; and
- whether any public deployment may be affected.

## Security claims

Conformance with this repository does not prove that an implementation is
secure. Each native binding requires its own hostile tests, reproducible build,
artifact identity, and deployment evidence before it can make the corresponding
claims. Independent review is a separate evidence axis: when performed, its
scope, revision, findings, and unresolved limitations must be reported without
being implied by conformance.

An Engine can be malicious while conforming to its declared interface. Core
conformance limits authority and blast radius; it does not certify fair prices,
economic safety, asset solvency, oracle correctness, or Engine quality.
