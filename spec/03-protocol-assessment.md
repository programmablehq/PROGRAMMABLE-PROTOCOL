# 03. Protocol Assessment V1

- Status: Draft
- Classification: Normative
- Scope: Portable
- Spec ID: `programmable-protocol/0.1.0-draft.1`

## Fixed economics

ProtocolAssessmentV1 has a fixed nominal rate of five basis points:

```text
rate numerator        = 5
rate denominator      = 10,000
reduced denominator   = 2,000
flat component        = 0
minimum               = 0
rounding              = cumulative floor
fee asset             = basis asset
funding               = additive
assessment amount     = gross source debit
```

**[FEE-001]** For cumulative basis `B`, the assessed amount is exactly:

```text
A(B) = B div 2,000
```

For one fill:

```text
fee_delta = A(B_after) - A(B_before)
```

There is no multiplication in the canonical algorithm. All values are
non-negative mathematical integers expressed in atomic asset units.

**[FEE-002]** ProtocolAssessmentV1 uses the exact unsigned 128-bit domain for
cumulative-basis and assessment arithmetic. Every binding MUST reject an input
or result above `2^128 - 1` before movement, even when its native runtime can
represent a wider integer. Arithmetic MUST NOT wrap, saturate, truncate, or use
floating-point values.

## Canonical assessment group

One rounding group is identified by the exact tuple:

```text
(
  core_deployment_id,
  constitution_id,
  authorization_scope_id,
  assessment_principal_id,
  asset_profile_id,
  native_asset_id
)
```

The fee-funding Principal is not part of the group key and cannot reset its
cumulative basis.

One Authorization Scope is authenticated for exactly one assessment Principal.
Reusing the same Scope ID under the same Core Deployment and Constitution with
a different assessment Principal is invalid rather than a second group.

**[FEE-003]** Core MUST aggregate all applicable debits and valid Refunds for
one group before rounding. Source account, route, hop, submitter, router,
recipient, Engine label, and fee sponsor MUST NOT split that group.

Unlike assets, Asset Profiles, assessment Principals, Scopes, Constitutions, or
Core Deployments form different groups. Unlike asset units are never added
onchain.

## PrincipalFundedGrossDebitV1

For a fill of one canonical group:

```text
B_fill  = sum(applicable gross debits) - sum(valid origin-bound Refunds)
B_after = B_before + B_fill
```

`PrincipalFundedGrossDebitV1` is the inclusive aggregate of exact
Core-verified protected gross debits that consume the assessment Principal's
spend Capability in a successful `CORE_ENFORCED` Envelope, except for a closed
objective exemption defined by that Core major.

**[FEE-004]** Engine-supplied names such as swap, deposit, builder fee, LP fee,
maker payment, integrator fee, referral, interface fee, royalty, cleanup,
rebate, sponsor, claim, or external tax MUST NOT create or remove basis.

If a principal-funded protected debit cannot be objectively classified in a
`CORE_ENFORCED` Envelope, Core rejects the Envelope before movement. `PARTIAL`
and `NONE` surfaces cannot claim universal ProtocolAssessmentV1 coverage.

### Closed V1 exclusions

The following do not create basis when Core proves the exact condition without
trusting an Engine label:

- the Protocol Assessment leg itself and its asset-program behavior;
- base-chain transaction fees;
- failed or pre-settlement-cancelled Envelopes;
- output credits and unsolicited donations that consume no Principal spend;
- internal inventory movement that consumes no new Principal spend;
- a one-for-one movement of the same asset between Core-authenticated custody
  endpoints bound to the same authenticated Principal ID, with no changed
  recipient, delegate, claim, entitlement, or new protected right;
- an exact fee or entitlement claim that only credits the already entitled
  Principal and consumes no new Principal-funded spend Capability;
- an exact engine-independent withdrawal or exit under a closed Core profile.

This list is exhaustive for `PrincipalFundedGrossDebitV1`. Changing an
exclusion or adding another exclusion requires a new basis identifier and a new
Constitution; it cannot retain the V1 basis name.

Ordinary LP deposits, staking, collateral funding, bonding-curve purchases, or
other capital movements are not exempt merely because an Engine uses those
names. A later Core major may select a new explicitly versioned basis with a
narrow objective custody or deposit exemption.

## Refund rules

Every basis-reducing Refund has one stable `refund_id`, one stable
`origin_debit_id`, and one amount. Its origin debit is in the same atomic Fill
and Envelope. Debit and Refund identifiers are unique within the Authorization
Scope and cannot be reused across stored fills.

The binding derives an effect occurrence identity from the Scope, Envelope or
fill sequence, authenticated plan digest, canonical effect ordinal, Principal,
asset, and profile. Semantically identical rows at different ordinals remain
distinct unless Core first creates one explicit aggregate effect with its own
identity. An Engine-selected display ID is not sufficient.

Core accepts a basis-reducing Refund only when all conditions hold:

1. the origin debit exists in the same Fill and group;
2. exactly one origin is assigned;
3. the sum of all Refunds assigned to that origin does not exceed it;
4. the value comes from segregated unused origin debit or exactly reverses the
   origin movement before use; and
5. the Refund is applied exactly once.

**[FEE-005]** A duplicate, cyclic, over-allocated, unknown-origin, mixed-
inventory, or otherwise malformed claimed Refund MUST cause a
`CORE_ENFORCED` Envelope to reject before movement. A credit not claimed as a
Refund MAY commit under its ordinary profile but MUST NOT reduce basis.
A later compensating credit is not a basis-reducing Refund and does not
retroactively change a committed Fill.

For each fill and group, `0 <= B_fill <= sum(applicable gross debits)`.

If applicable debits exist and valid Refunds reduce the fill basis to zero, the
Receipt contains a zero-amount assessment record for that group. If no
applicable group exists, no assessment record is created.

## Partial fills and independent Scopes

**[FEE-006]** A stored Scope MUST retain `B_before` as canonical state. An
implementation MAY cache `A(B_before)`, but the cache MUST equal
`B_before div 2,000`. No independent fee remainder is normative state.

Splitting one Scope into fills cannot change its final cumulative assessment.
Creating a new independent Authorization Scope creates a new rounding group.
Each independent group can leave up to 1,999 basis-asset atomic units whose
nominal assessment is less than one fee-asset atomic unit and is therefore
floored to zero. V1 accepts that transparent boundary instead of a minimum,
ceiling, round-up, or global mutable remainder.

A fill can realize rounding accumulated by earlier fills. For example,
`B_before = 1,999` and `B_fill = 1` produces `fee_delta = 1`. The nominal rate
is defined over cumulative Scope basis, not the isolated fill or a daily USD
total.

## Multi-hop and multi-asset execution

Internal routing legs are not reassessed when they consume no new external
Principal spend Capability. Each external Principal and asset group is assessed
independently.

**[FEE-007]** Core MUST NOT convert unlike assets through an oracle to compute
ProtocolAssessmentV1. Any quote-currency or USD aggregation is
`OFFCHAIN_DERIVED` and must identify its price source, observation time, and
method.

## Additive funding and user limits

The Protocol Assessment is additive to the market-execution gross debit. For
each asset, Core enforces separate maximums for market-execution gross debit,
Protocol Assessment gross debit, and total gross debit.

**[FEE-008]** The assessment cannot consume output, silently reduce a promised
minimum credit, or exceed either the assessment Principal's limits or a
different fee-funding Principal's separate authorization.

A sponsored assessment is authorized by the fee-funding Principal's own
Authorization Scope, not by an inline sponsor tuple supplied by an Engine or
submitter. The `fee_funding_scope_id` MUST equal `AuthorizationScopeIdV1` of
the exact sponsor Scope Descriptor. That descriptor MUST name the same
fee-funding Principal and MUST contain the exact sponsored-assessment tuple for
the assessment Scope, assessment Principal, Asset Profile, native asset,
maximum gross assessment debit, and immutable Protocol Collector.

Core MUST resolve `fee_funding_authorization_evidence_ref` to authenticated
Principal evidence with `CORE_VERIFIED` provenance and `CORE_ENFORCED`
coverage. The evidence's Scope ID and Principal ID MUST equal the fill's
`fee_funding_scope_id` and `fee_funding_principal_id`. Core rejects before
movement when the evidence is missing, the descriptor hash differs, the
Principal or Core context differs, the exact sponsored tuple is absent, or the
cumulative debit exceeds its descriptor-bound maximum. An Engine-selected
Principal label, Scope label, registry row, or copied inline authorization is
not authentication.

## External asset tax

The formula result is the exact gross source debit of the Protocol Assessment
leg. If an Asset Profile withholds an external transfer fee, the spendable fee
vault credit can be smaller:

```text
gross_assessment_debit = fee_delta
funded_credit          = observed spendable credit
external_tax_withheld  = gross_assessment_debit - funded_credit
```

V1 does not inverse-gross-up the debit to target a net credit.

**[FEE-009]** The Authorization's gross-debit limits include the complete gross
Protocol Assessment debit. An Asset Profile that can debit the source by more
than the requested gross amount is unsupported unless a later exact profile
defines and separately bounds that behavior.

Where withholding is supported, Authorization also binds its maximum for the
market-execution and Protocol Assessment legs. Withholding on a later Collector
claim belongs to that separately authorized claim, not the original Principal's
source-debit ceiling.

External tax contained in an applicable market-execution gross debit is an
overlapping reported component. It is neither subtracted from nor added again
to the basis.

## Collector, funding, and claims

One immutable `protocol_collector_id` is bound to the Core Deployment.
Settlement funds Core-authenticated, asset- and profile-bound fee accounting;
the caller cannot select or redirect the Collector.

**[FEE-010]** Protocol liability is created only from observed spendable funded
credit. Assessed, funded, claimable, and claimed amounts MUST be recorded as
different facts. Donations, nominal transfer amounts, and Engine assertions do
not create liability.

If `fee_delta = 0`, Core performs no Protocol Assessment transfer and creates no
liability. If `fee_delta > 0` but observed spendable funded credit is zero, the
complete Envelope rejects. A positive but smaller funded credit is recorded
exactly and creates only that amount of liability.

A claim cannot exceed the bound liability and can pay only a destination
authenticated by the bound Collector policy. Old liabilities remain bound to
their original Collector after any new Core major or user migration.

## Reporting

`CoreAssessedGrossDebitByAsset` is the reporting aggregate of committed group
bases for the same native asset and Asset Profile after independent group
assessment. It is not a second fee basis.

`OffchainValuedCoreAssessedGrossDebit` is an explicit offchain valuation of
those separate asset rows. It is not all Engine activity, all DEX volume, or a
Core-enforced amount.

**[FEE-011]** A public revenue statement MUST distinguish at least assessed,
funded, claimable, claimed, and offchain-valued figures. It MUST NOT infer
Protocol revenue from semantic trade labels or off-Core volume.

## Exact examples

| Cumulative basis before | Fill basis | Cumulative basis after | Fee delta |
| ---: | ---: | ---: | ---: |
| 0 | 1,999 | 1,999 | 0 |
| 0 | 2,000 | 2,000 | 1 |
| 1,999 | 1 | 2,000 | 1 |
| 2,000 | 1,999 | 3,999 | 0 |
| 3,999 | 1 | 4,000 | 1 |
| 0 | 10,000,000 | 10,000,000 | 5,000 |

Machine-readable positive and negative cases are normative in
[`../vectors/protocol-assessment-v1.json`](../vectors/protocol-assessment-v1.json).
