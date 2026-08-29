# Informative market challenge cases

Every example in this directory is an architecture challenge case. It is not
an availability claim, production recommendation, audit result, or statement
that the mechanism is economically safe.

The JSON files validate the Market Template schema and identifier rules. They
are metadata descriptions, not executable Engine code. Native support exists
only when a binding implements the required profiles and publishes conformance
evidence.

Each action separates three lists: closed Core-recognized
`required_protected_capabilities`, Core-recognized
`proposed_protected_effects`, and unrestricted namespaced
`opaque_engine_effects`. An opaque Engine identifier cannot acquire protected
meaning, and the protected lists do not limit Engine-owned state or actions.

| Case | What it challenges | What Core still does not prove |
| --- | --- | --- |
| Constant-product market | Ordinary fungible settlement, capital provision, withdrawals, and rounding | Fair price or profitable liquidity |
| Bonding-curve lifecycle | Supply-dependent pricing, phases, and a migration-availability transition | Fair launch, anti-bot behavior, or future-market quality |
| Batch auction | Multiple Principals, stored Scopes, cancellation, partial fills, and one clearing Envelope | Fair clearing price or solver availability |
| NFT bid pool | Non-fungible selection, receiver behavior, collection conditions, and fungible payment | Metadata truth, collection legitimacy, or royalty correctness |
| Multi-asset basket | Dynamic asset sets, per-asset conservation, issuance, redemption, and no cross-asset fee sum | Component solvency or rebalance quality |
| Conditional outcome market | External resolution, terminal claims, and exit classification | Oracle truth or legal status of the outcome |
| Signed request for quote (RFQ) with just-in-time inventory | Independent maker and taker Scopes, expiry, temporary inventory, and bounded-session closure | Maker availability, competitive pricing, or quote privacy |
| Shared-Domain composition | Separate Market identities, Domain-local admission, and intentionally shared inventory and risk | Independent liquidity, liveness, or Engine risk between admitted Markets |

An example action name never becomes a Core product enum. Core sees only exact
Authorization, protected Capabilities and Effects, obligations, assessment, and
evidence.
