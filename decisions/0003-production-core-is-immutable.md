# 0003: Every Production Core is immutable and adminless

- Status: Accepted
- Date: 2026-08-29

## Context

An upgrade, fee, configuration, pause, quarantine, sweep, or migration authority
can replace or bypass code-level guarantees. A mutable production deployment
cannot truthfully be owner-compromise-safe.

## Decision

Every Core major that can receive real production assets is immutable and
adminless at deployment. It has no proxy or code replacement path, mutable
protocol policy, privileged pause, admin sweep, or forced migration.

New functionality uses a new native Core identity and runs side by side. Any
migration is an explicit user action already permitted by the original profile.

## Alternatives

- A multisig or timelocked Production Core was rejected because it still
  retains authority over users.
- A funded mutable production beta was rejected because its risk cannot be
  reconciled with the intended compromise boundary.
- Automatic migration was rejected because it lets a later authority rewrite
  old user and fee rights.

## Security consequences

Removing privileged mutation prevents an administrator or compromised operator
from replacing policy or sweeping custody. It does not make code defect-free: a
Core bug can still be systemic for that exact deployment, and immutability
prevents an in-place patch. Production release therefore requires live proof
that all prohibited authorities are absent and evidence for the deployed code.

## Compatibility consequences

New behavior is deployed under a new Core identity. Existing Markets, positions,
Authorizations, and assets remain with the Core they selected unless an action
already authorized by that Core moves them. Replaceable test deployments are
not production-compatible and must not accept real assets.

## Affected artifacts

- `spec/05-versioning.md`
- `spec/06-security-properties.md`
- EVM and SVM binding release and deployment manifests
- native deployment procedures and authority evidence
