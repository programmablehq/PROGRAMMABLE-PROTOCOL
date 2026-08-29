# 0004: Fix Protocol Assessment V1 at five basis points

- Status: Accepted
- Date: 2026-08-29

## Context

An arbitrary Engine label cannot objectively prove trade volume. A portable
Protocol Assessment must use Core-observed facts, exact user limits, deterministic
integer arithmetic, and an immutable Collector policy.

## Decision

ProtocolAssessmentV1 uses a fixed nominal rate of 5/10,000, reduced to exact
cumulative floor division by 2,000. It has no minimum, flat component, round-up,
oracle conversion, or mutable rate.

The basis is `PrincipalFundedGrossDebitV1`, grouped by Core Deployment,
Constitution, Authorization Scope, assessment Principal, Asset Profile, and
native asset. Valid origin-bound Refunds reduce the basis. Internal hops are not
reassessed. Unlike assets and Principals remain separate.

The formula result is the gross Protocol Assessment source debit. External
withholding can reduce funded credit; V1 does not inverse-gross-up. Liability is
created only from observed spendable credit.

## Alternatives

- Semantic swap volume was rejected because Engines can relabel or invent
  actions.
- Round-up and minimum fees were rejected because small groups could exceed
  five basis points.
- A global remainder was rejected because it creates shared writable state and
  unrelated ordering.
- Oracle-denominated fees were rejected because they add external price trust.
- Mutable governance fees were rejected by the Production Core authority rule.

## Security consequences

The observed ratio on a small group or individual fill need not equal five
basis points. Up to 1,999 basis-asset atomic units per independent group can
produce less than one fee-asset atomic unit and therefore floor to zero, so
independent Scope fragmentation can multiply undercollection. Ordinary
principal-funded capital movements are assessed under V1.

The Core must authenticate the assessment Principal, preserve the exact group
key, bind Refunds to their origin, and use checked integer arithmetic. Failure
in any of those controls can cause underassessment or an unauthorized debit.
The fixed native-asset basis avoids oracle and Engine-label authority.

## Compatibility consequences

Conforming V1 implementations must reproduce the exact grouping, exclusions,
refund treatment, floor behavior, and 5/10,000 rate. A different rate, basis,
rounding rule, exclusion set, or grouping identity is a different assessment
definition and cannot be reported as `PrincipalFundedGrossDebitV1`.

## Affected artifacts

- `spec/03-protocol-assessment.md`
- `spec/05-versioning.md`
- `constitution/programmable-constitution-v1.json`
- `vectors/protocol-assessment-v1.json` and its schema
- both native binding implementations and their assessment evidence
