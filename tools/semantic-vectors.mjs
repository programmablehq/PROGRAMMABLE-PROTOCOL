import crypto from "node:crypto";

import canonicalize from "canonicalize";
import duplicateKeyValidator from "json-dup-key-validator";

const ZERO_BYTE = Buffer.from([0]);
const CORE_PROFILE_ID = "portable-core-v1";

const PROTECTED_EFFECTS_SCHEMA = "urn:programmable:schema:protected-effects-vectors:v1";
const EVIDENCE_SCHEMA = "urn:programmable:schema:evidence-vectors:v1";
const BOUNDED_SESSION_SCHEMA = "urn:programmable:schema:bounded-session-vectors:v1";
const CANONICAL_IDENTIFIERS_SCHEMA = "urn:programmable:schema:canonical-identifiers-vectors:v1";

const PROTECTED_EFFECT_TYPES = new Map([
  [
    "programmable.effect.asset_move.v1",
    {
      kind: "asset_move",
      capabilityId: "programmable.capability.asset_move.v1",
    },
  ],
  [
    "programmable.effect.core_rights_delta.v1",
    {
      kind: "core_rights_delta",
      capabilityId: "programmable.capability.core_rights.v1",
    },
  ],
  [
    "programmable.effect.profile_operation.v1",
    {
      kind: "profile_operation",
      capabilityId: "programmable.capability.profile_operation.v1",
    },
  ],
  [
    "programmable.effect.temporary_obligation_open.v1",
    {
      kind: "temporary_obligation_open",
      capabilityId: "programmable.capability.temporary_obligation.v1",
    },
  ],
]);

const CORE_DERIVED_EFFECT_IDS = new Set([
  "programmable.effect.temporary_obligation_close.v1",
  "programmable.effect.authorization_state_advance.v1",
  "programmable.effect.domain_revision_commit.v1",
  "programmable.effect.domain_accounting_commit.v1",
  "programmable.effect.protocol_assessment.v1",
  "programmable.effect.receipt_checkpoint.v1",
]);

const PHASE_TRANSITIONS = new Set([
  "AUTHENTICATED->ACTIVE",
  "AUTHENTICATED->RECONCILING",
  "ACTIVE->ACTIVE",
  "ACTIVE->RECONCILING",
]);

const SESSION_RESOURCE_FIELDS = [
  ["target_calls", "max_target_calls"],
  ["protected_effects", "max_protected_effects"],
  ["obligation_keys_created", "max_obligation_keys"],
  ["observations", "max_observations"],
  ["observed_bytes", "max_observed_bytes"],
  ["return_bytes", "max_return_bytes"],
];

export class SemanticVectorError extends Error {
  constructor(message, code = "semantic_vector_failure") {
    super(message);
    this.name = "SemanticVectorError";
    this.code = code;
  }
}

class CaseRejection extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CaseRejection";
    this.code = code;
  }
}

function fail(message, code) {
  throw new SemanticVectorError(message, code);
}

function requireCondition(condition, message, code) {
  if (!condition) {
    fail(message, code);
  }
}

function rejectUnless(condition, code, message) {
  if (!condition) {
    throw new CaseRejection(code, message);
  }
}

function requireSchema(document, expectedSchema) {
  requireCondition(
    document && typeof document === "object" && !Array.isArray(document),
    `${expectedSchema}: vector document must be an object`,
  );
  requireCondition(
    document.$schema === expectedSchema,
    `Expected vector schema ${expectedSchema}, got ${String(document.$schema)}`,
  );
  requireCondition(Array.isArray(document.cases), `${expectedSchema}: cases must be an array`);
}

function requireUniqueCaseIds(document) {
  const ids = new Set();
  for (const testCase of document.cases) {
    requireCondition(
      typeof testCase.case_id === "string" && testCase.case_id.length > 0,
      `${document.$schema}: case_id must be a non-empty string`,
    );
    requireCondition(!ids.has(testCase.case_id), `${document.$schema}: duplicate case ID ${testCase.case_id}`);
    ids.add(testCase.case_id);
  }
}

function requireCoreProfile(testCase) {
  requireCondition(
    Array.isArray(testCase.required_profiles) && testCase.required_profiles.includes(CORE_PROFILE_ID),
    `${testCase.case_id}: required_profiles omits ${CORE_PROFILE_ID}`,
  );
}

function decimal(value, location) {
  rejectUnless(
    typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value),
    "invalid_decimal",
    `${location}: invalid canonical decimal`,
  );
  return BigInt(value);
}

function canonicalJson(value, location) {
  const result = canonicalize(value);
  requireCondition(typeof result === "string", `${location}: JCS canonicalization failed`);
  return result;
}

function rawDigest(domain, ...parts) {
  const hash = crypto.createHash("sha256");
  hash.update(domain, "utf8");
  for (const part of parts) {
    hash.update(ZERO_BYTE);
    hash.update(part);
  }
  return `sha256:${hash.digest("hex")}`;
}

function jcsDigest(domain, value, location) {
  return rawDigest(domain, Buffer.from(canonicalJson(value, location), "utf8"));
}

function digestBytes(digest, location) {
  const match = /^sha256:([0-9a-f]{64})$/.exec(digest);
  rejectUnless(Boolean(match), "invalid_digest", `${location}: invalid SHA-256 digest`);
  return Buffer.from(match[1], "hex");
}

function runDeclaredCases(document, declaration, evaluator) {
  requireUniqueCaseIds(document);
  const results = [];
  let accepted = 0;
  let rejected = 0;

  for (const testCase of document.cases) {
    if (testCase.required_profiles !== undefined) {
      requireCoreProfile(testCase);
    }
    const expected = declaration(testCase);
    requireCondition(
      expected.status === "accept" || expected.status === "reject",
      `${testCase.case_id}: invalid declared status ${String(expected.status)}`,
    );
    if (expected.status === "reject") {
      requireCondition(
        typeof expected.code === "string" && expected.code.length > 0,
        `${testCase.case_id}: declared rejection omits its exact code`,
      );
    }

    let actual = { status: "accept" };
    let value;
    try {
      value = evaluator(testCase);
    } catch (error) {
      if (!(error instanceof CaseRejection)) {
        throw error;
      }
      actual = { status: "reject", code: error.code };
    }

    requireCondition(
      actual.status === expected.status,
      `${testCase.case_id}: expected ${expected.status}${expected.code ? ` (${expected.code})` : ""}, got ${actual.status}${actual.code ? ` (${actual.code})` : ""}`,
    );
    if (expected.status === "reject") {
      requireCondition(
        actual.code === expected.code,
        `${testCase.case_id}: expected rejection ${expected.code}, got ${actual.code}`,
      );
      rejected += 1;
    } else {
      accepted += 1;
    }

    results.push({
      caseId: testCase.case_id,
      requiredProfiles: [...(testCase.required_profiles ?? [CORE_PROFILE_ID])],
      status: actual.status,
      ...(actual.code ? { rejectCode: actual.code } : {}),
      ...(value === undefined ? {} : { value }),
    });
  }

  return {
    total: results.length,
    accepted,
    rejected,
    cases: results.map(({ caseId, requiredProfiles }) => ({ caseId, requiredProfiles })),
    results,
  };
}

function effectAmount(effect) {
  if (effect.effect_kind === "asset_move") {
    return decimal(effect.payload.gross_debit, `${effect.occurrence_id}.gross_debit`);
  }
  if (effect.effect_kind === "core_rights_delta") {
    return decimal(effect.payload.amount, `${effect.occurrence_id}.amount`);
  }
  if (effect.effect_kind === "temporary_obligation_open") {
    return decimal(effect.payload.amount, `${effect.occurrence_id}.amount`);
  }
  return 0n;
}

function effectPosition(effect, location) {
  return {
    segment: decimal(effect.segment_sequence, `${location}.segment_sequence`),
    ordinal: decimal(effect.ordinal, `${location}.ordinal`),
  };
}

function positionPrecedes(left, right) {
  return left.segment < right.segment || (left.segment === right.segment && left.ordinal < right.ordinal);
}

function validateCapabilityConstraint(testCase, effect, capability) {
  const constraint = capability.constraint;
  const payload = effect.payload;
  switch (effect.effect_kind) {
    case "asset_move": {
      rejectUnless(
        payload.native_source_id === constraint.native_source_id,
        "native_source_outside_capability",
        `${testCase.case_id}: Asset Move native source is outside the capability`,
      );
      rejectUnless(
        payload.source_domain_revision_id === constraint.source_domain_revision_id &&
          payload.destination_domain_revision_id === constraint.destination_domain_revision_id,
        "domain_revision_outside_capability",
        `${testCase.case_id}: Asset Move Domain Revision is outside the capability`,
      );
      rejectUnless(
        payload.asset_profile_id === constraint.asset_profile_id &&
          payload.native_asset_id === constraint.native_asset_id,
        "asset_identity_outside_capability",
        `${testCase.case_id}: Asset Move asset or profile is outside the capability`,
      );
      rejectUnless(
        payload.recipient_id === constraint.recipient_id,
        "recipient_outside_capability",
        `${testCase.case_id}: Asset Move recipient is outside the capability`,
      );
      const grossDebit = decimal(payload.gross_debit, `${effect.occurrence_id}.gross_debit`);
      const minimumCredit = decimal(payload.minimum_spendable_credit, `${effect.occurrence_id}.minimum_spendable_credit`);
      const withholding = decimal(payload.external_withholding_ceiling, `${effect.occurrence_id}.external_withholding_ceiling`);
      rejectUnless(
        grossDebit <= decimal(constraint.max_gross_debit, `${capability.capability_instance_id}.max_gross_debit`),
        "capability_gross_exceeded",
        `${testCase.case_id}: Asset Move gross debit exceeds the capability`,
      );
      rejectUnless(
        minimumCredit >= decimal(
          constraint.minimum_spendable_credit_floor,
          `${capability.capability_instance_id}.minimum_spendable_credit_floor`,
        ) && minimumCredit <= grossDebit,
        "minimum_credit_outside_capability",
        `${testCase.case_id}: Asset Move minimum spendable credit is outside the capability`,
      );
      rejectUnless(
        withholding <= decimal(
          constraint.external_withholding_ceiling,
          `${capability.capability_instance_id}.external_withholding_ceiling`,
        ) && withholding <= grossDebit,
        "withholding_outside_capability",
        `${testCase.case_id}: Asset Move withholding ceiling is outside the capability`,
      );
      return;
    }
    case "core_rights_delta": {
      rejectUnless(
        payload.rights_profile_id === constraint.rights_profile_id && payload.right_id === constraint.right_id,
        "rights_identity_outside_capability",
        `${testCase.case_id}: rights profile or right is outside the capability`,
      );
      rejectUnless(
        payload.subject_id === constraint.subject_id,
        "rights_subject_outside_capability",
        `${testCase.case_id}: rights subject is outside the capability`,
      );
      rejectUnless(
        payload.recipient_id === constraint.recipient_id,
        "recipient_outside_capability",
        `${testCase.case_id}: rights recipient is outside the capability`,
      );
      rejectUnless(
        payload.direction === constraint.direction,
        "rights_direction_outside_capability",
        `${testCase.case_id}: rights direction is outside the capability`,
      );
      rejectUnless(
        sameJson(payload.backing_domain_revision_ids, constraint.backing_domain_revision_ids),
        "domain_revision_outside_capability",
        `${testCase.case_id}: rights backing Domain Revisions differ from the capability`,
      );
      rejectUnless(
        payload.custody_profile_id === constraint.custody_profile_id &&
          payload.exit_profile_id === constraint.exit_profile_id,
        "rights_profile_outside_capability",
        `${testCase.case_id}: rights custody or exit profile is outside the capability`,
      );
      rejectUnless(
        decimal(payload.amount, `${effect.occurrence_id}.amount`) <=
          decimal(constraint.max_amount, `${capability.capability_instance_id}.max_amount`),
        "capability_gross_exceeded",
        `${testCase.case_id}: rights amount exceeds the capability`,
      );
      return;
    }
    case "profile_operation":
      rejectUnless(
        payload.profile_id === constraint.profile_id &&
          payload.operation_id === constraint.operation_id &&
          payload.operation_target_id === constraint.operation_target_id &&
          payload.protected_profile_component_revision_id === constraint.protected_profile_component_revision_id &&
          payload.parameters_digest === constraint.parameters_digest,
        "profile_operation_outside_capability",
        `${testCase.case_id}: Profile Operation is not the exact capability-authorized operation`,
      );
      return;
    case "temporary_obligation_open":
      rejectUnless(
        payload.paired_asset_move_occurrence_id === constraint.paired_asset_move_occurrence_id &&
          payload.session_id === constraint.session_id &&
          payload.opening_segment === constraint.opening_segment &&
          payload.opening_ordinal === constraint.opening_ordinal &&
          payload.close_by_segment_ordinal === constraint.close_by_segment_ordinal &&
          payload.source_domain_revision_id === constraint.source_domain_revision_id &&
          payload.native_asset_id === constraint.native_asset_id &&
          payload.asset_profile_id === constraint.asset_profile_id &&
          payload.obligated_actor_id === constraint.obligated_actor_id &&
          payload.return_destination_id === constraint.return_destination_id &&
          payload.return_condition === constraint.return_condition &&
          payload.must_be_closed_before_phase === constraint.must_be_closed_before_phase,
        "obligation_metadata_outside_capability",
        `${testCase.case_id}: temporary-obligation metadata is outside the capability`,
      );
      rejectUnless(
        decimal(payload.amount, `${effect.occurrence_id}.amount`) <=
          decimal(constraint.max_amount, `${capability.capability_instance_id}.max_amount`),
        "capability_gross_exceeded",
        `${testCase.case_id}: temporary-obligation amount exceeds the capability`,
      );
      return;
    default:
      throw new CaseRejection(
        "engine_effect_in_protected_plane",
        `${testCase.case_id}: non-protected Engine effect entered the protected plane`,
      );
  }
}

function evaluateProtectedEffectsCase(testCase) {
  const { input } = testCase;
  const capabilityByInstance = new Map();
  for (const capability of input.capabilities) {
    rejectUnless(
      !capabilityByInstance.has(capability.capability_instance_id),
      "duplicate_capability_instance",
      `${testCase.case_id}: duplicate capability instance ${capability.capability_instance_id}`,
    );
    capabilityByInstance.set(capability.capability_instance_id, capability);
  }

  // Vocabulary and primitive exclusions precede capability lookup: an unknown,
  // Engine-defined, generic, or Core-derived proposal never acquires authority
  // merely because a capability happens to name it.
  for (const effect of input.proposed_effects) {
    if (effect.effect_kind === "generic_call") {
      throw new CaseRejection(
        "generic_privileged_call_forbidden",
        `${testCase.case_id}: generic privileged calls are not protected Effects`,
      );
    }
    if (effect.effect_kind === "core_derived_claim" || CORE_DERIVED_EFFECT_IDS.has(effect.effect_id)) {
      throw new CaseRejection(
        "core_derived_field_spoof",
        `${testCase.case_id}: an Engine proposed a Core-derived Effect`,
      );
    }
    if (!PROTECTED_EFFECT_TYPES.has(effect.effect_id)) {
      const code = effect.effect_id.startsWith("programmable.effect.")
        ? "unknown_protected_effect_id"
        : "engine_effect_in_protected_plane";
      throw new CaseRejection(code, `${testCase.case_id}: unsupported protected Effect ${effect.effect_id}`);
    }
    const type = PROTECTED_EFFECT_TYPES.get(effect.effect_id);
    rejectUnless(
      effect.effect_kind === type.kind,
      "protected_effect_kind_mismatch",
      `${testCase.case_id}: ${effect.effect_id} cannot use kind ${effect.effect_kind}`,
    );
  }

  const occurrenceIds = new Set();
  const positions = new Set();
  for (const effect of input.proposed_effects) {
    rejectUnless(
      !occurrenceIds.has(effect.occurrence_id),
      "duplicate_effect_occurrence",
      `${testCase.case_id}: duplicate occurrence ${effect.occurrence_id}`,
    );
    occurrenceIds.add(effect.occurrence_id);
    const position = `${effect.segment_sequence}:${effect.ordinal}`;
    rejectUnless(
      !positions.has(position),
      "duplicate_effect_occurrence",
      `${testCase.case_id}: duplicate Effect position ${position}`,
    );
    positions.add(position);
  }

  const consumedByCapability = new Map();
  for (const effect of input.proposed_effects) {
    const capability = capabilityByInstance.get(effect.capability_instance_id);
    rejectUnless(Boolean(capability), "missing_capability", `${testCase.case_id}: missing referenced capability`);

    const type = PROTECTED_EFFECT_TYPES.get(effect.effect_id);
    rejectUnless(
      capability.capability_id === type.capabilityId,
      "capability_type_mismatch",
      `${testCase.case_id}: capability type does not cover ${effect.effect_id}`,
    );
    rejectUnless(
      capability.authorization_scope_id === effect.authorization_scope_id,
      "authorization_scope_outside_capability",
      `${testCase.case_id}: Effect Scope differs from its capability`,
    );
    rejectUnless(
      capability.execution_target_id === effect.execution_target_id,
      "execution_target_outside_capability",
      `${testCase.case_id}: Effect Target differs from its capability`,
    );
    validateCapabilityConstraint(testCase, effect, capability);

    const consumed = (consumedByCapability.get(capability.capability_instance_id) ?? 0n) + effectAmount(effect);
    const perOccurrenceMaximum =
      effect.effect_kind === "asset_move" ? capability.constraint.max_gross_debit : capability.constraint.max_amount;
    if (perOccurrenceMaximum !== undefined) {
      rejectUnless(
        consumed <= decimal(perOccurrenceMaximum, `${capability.capability_instance_id}.cumulative_maximum`),
        "capability_gross_exceeded",
        `${testCase.case_id}: cumulative capability amount exceeded`,
      );
    }
    consumedByCapability.set(capability.capability_instance_id, consumed);
  }

  const nativeSourceDomains = new Map();
  const effectByOccurrence = new Map(input.proposed_effects.map((effect) => [effect.occurrence_id, effect]));
  const obligationAmounts = new Map();
  for (const effect of input.proposed_effects) {
    if (effect.effect_kind === "asset_move") {
      const aliasKey = [
        effect.payload.native_source_id,
        effect.payload.asset_profile_id,
        effect.payload.native_asset_id,
      ].join("\u0000");
      const existingDomain = nativeSourceDomains.get(aliasKey);
      rejectUnless(
        existingDomain === undefined || existingDomain === effect.payload.source_domain_revision_id,
        "cross_domain_alias",
        `${testCase.case_id}: one native source aliases multiple Domain Revisions`,
      );
      nativeSourceDomains.set(aliasKey, effect.payload.source_domain_revision_id);
    }

    if (effect.effect_kind === "temporary_obligation_open") {
      rejectUnless(
        input.execution_profile === "BOUNDED_SESSION_V1",
        "temporary_obligation_requires_bounded_session",
        `${testCase.case_id}: temporary obligation used outside a bounded session`,
      );
      const pairedMove = effectByOccurrence.get(effect.payload.paired_asset_move_occurrence_id);
      rejectUnless(
        pairedMove?.effect_kind === "asset_move",
        "obligation_pair_mismatch",
        `${testCase.case_id}: temporary obligation has no paired Asset Move`,
      );
      rejectUnless(
        pairedMove.segment_sequence === effect.segment_sequence &&
          positionPrecedes(
            effectPosition(pairedMove, `${testCase.case_id}.${pairedMove.occurrence_id}`),
            effectPosition(effect, `${testCase.case_id}.${effect.occurrence_id}`),
          ) &&
          effect.payload.opening_segment === effect.segment_sequence &&
          effect.payload.opening_ordinal === effect.ordinal,
        "obligation_pair_order",
        `${testCase.case_id}: paired Asset Move must precede its obligation in the opening segment`,
      );
      rejectUnless(
        pairedMove.payload.source_domain_revision_id === effect.payload.source_domain_revision_id &&
          pairedMove.payload.asset_profile_id === effect.payload.asset_profile_id &&
          pairedMove.payload.native_asset_id === effect.payload.native_asset_id &&
          pairedMove.payload.gross_debit === effect.payload.amount &&
          pairedMove.payload.recipient_id === effect.payload.obligated_actor_id &&
          pairedMove.payload.native_source_id === effect.payload.return_destination_id,
        "obligation_pair_mismatch",
        `${testCase.case_id}: obligation fields do not match the paired Asset Move`,
      );
      rejectUnless(
        decimal(effect.payload.close_by_segment_ordinal, `${effect.occurrence_id}.close_by_segment_ordinal`) >=
          decimal(effect.payload.opening_segment, `${effect.occurrence_id}.opening_segment`),
        "obligation_deadline_exceeded",
        `${testCase.case_id}: obligation deadline precedes its opening segment`,
      );
      obligationAmounts.set(effect.occurrence_id, effectAmount(effect));
    }
  }

  const closedAmounts = new Map();
  const closureIds = new Set();
  for (const closure of input.observed_obligation_closures) {
    rejectUnless(
      !closureIds.has(closure.closure_id),
      "duplicate_obligation_closure",
      `${testCase.case_id}: duplicate obligation closure ${closure.closure_id}`,
    );
    closureIds.add(closure.closure_id);
    rejectUnless(
      closure.obligation_occurrence_ids.length === 1,
      "obligation_cross_key_netting",
      `${testCase.case_id}: one closure attempts to net multiple obligation keys`,
    );
    const obligationId = closure.obligation_occurrence_ids[0];
    const obligation = effectByOccurrence.get(obligationId);
    rejectUnless(
      obligation?.effect_kind === "temporary_obligation_open",
      "unknown_obligation",
      `${testCase.case_id}: closure names an unknown obligation`,
    );
    rejectUnless(
      closure.source_actor_id === obligation.payload.obligated_actor_id &&
        closure.return_destination_id === obligation.payload.return_destination_id &&
        closure.source_domain_revision_id === obligation.payload.source_domain_revision_id &&
        closure.asset_profile_id === obligation.payload.asset_profile_id &&
        closure.native_asset_id === obligation.payload.native_asset_id &&
        closure.return_condition === obligation.payload.return_condition,
      "obligation_return_provenance_mismatch",
      `${testCase.case_id}: closure provenance differs from the exact obligation key`,
    );
    rejectUnless(
      decimal(closure.segment_sequence, `${closure.closure_id}.segment_sequence`) >=
          decimal(obligation.payload.opening_segment, `${obligation.occurrence_id}.opening_segment`) &&
        decimal(closure.segment_sequence, `${closure.closure_id}.segment_sequence`) <=
          decimal(obligation.payload.close_by_segment_ordinal, `${obligation.occurrence_id}.close_by_segment_ordinal`),
      "obligation_deadline_exceeded",
      `${testCase.case_id}: closure is outside the obligation's permitted segment range`,
    );
    const closed = (closedAmounts.get(obligationId) ?? 0n) + decimal(closure.amount, `${closure.closure_id}.amount`);
    rejectUnless(
      closed <= obligationAmounts.get(obligationId),
      "obligation_overclose",
      `${testCase.case_id}: closure exceeds its obligation`,
    );
    closedAmounts.set(obligationId, closed);
  }
  for (const [obligationId, amount] of obligationAmounts) {
    rejectUnless(
      (closedAmounts.get(obligationId) ?? 0n) === amount,
      "obligation_remaining",
      `${testCase.case_id}: obligation ${obligationId} remains open`,
    );
  }

  const maxOccurrences = decimal(input.resource_limits.max_effect_occurrences, `${testCase.case_id}.max_effect_occurrences`);
  rejectUnless(
    BigInt(input.proposed_effects.length) <= maxOccurrences,
    "resource_bound_exceeded",
    `${testCase.case_id}: Effect occurrence maximum exceeded`,
  );
  const assetMoveGross = input.proposed_effects
    .filter((effect) => effect.effect_kind === "asset_move")
    .reduce((sum, effect) => sum + effectAmount(effect), 0n);
  rejectUnless(
    assetMoveGross <= decimal(input.resource_limits.max_asset_move_gross_total, `${testCase.case_id}.max_asset_move_gross_total`),
    "resource_bound_exceeded",
    `${testCase.case_id}: Asset Move gross maximum exceeded`,
  );
}

export function validateProtectedEffectsVectors(document) {
  requireSchema(document, PROTECTED_EFFECTS_SCHEMA);
  return runDeclaredCases(
    document,
    (testCase) => ({ status: testCase.outcome, code: testCase.reject_code }),
    evaluateProtectedEffectsCase,
  );
}

function requiredReceiptField(receipt, field, code, caseId) {
  rejectUnless(
    typeof receipt[field] === "string" && receipt[field].length > 0,
    code,
    `${caseId}: normalized Receipt omits ${field}`,
  );
}

function evaluateEvidenceCase(testCase) {
  const input = testCase.input;
  switch (input.check) {
    case "evidence_axes": {
      rejectUnless(
        input.source_primary_provenance === input.reported_primary_provenance,
        "primary_provenance_changed",
        `${testCase.case_id}: independent evidence axes changed primary provenance`,
      );
      return;
    }
    case "core_verified_authenticity": {
      if (input.producer_kind === "ENGINE" && input.copied_core_receipt_discriminator) {
        throw new CaseRejection(
          "engine_event_impersonates_core",
          `${testCase.case_id}: Engine output copied a Core evidence discriminator`,
        );
      }
      rejectUnless(
        input.producer_kind === "CORE" && input.actual_producer_id === input.expected_core_deployment_id,
        "core_identity_mismatch",
        `${testCase.case_id}: Core producer identity mismatch`,
      );
      rejectUnless(
        input.invocation_context_authenticated,
        "core_invocation_not_authenticated",
        `${testCase.case_id}: Core invocation context is not authenticated`,
      );
      rejectUnless(
        input.event_schema_authenticated,
        "core_event_schema_not_authenticated",
        `${testCase.case_id}: Core event schema is not authenticated`,
      );
      return;
    }
    case "final_state": {
      if (!input.reported_final) {
        return;
      }
      rejectUnless(
        input.post_callback_checkpoint ||
          (!input.later_untrusted_callback_reachable && input.binding_proves_later_state_unreachable),
        "final_state_checkpoint_missing",
        `${testCase.case_id}: final state has no valid terminal checkpoint`,
      );
      return;
    }
    case "normalized_receipt": {
      const receipt = input.receipt;
      const committed = input.committed_context;
      const identity = receipt.receipt_identity_inputs;
      requiredReceiptField(receipt, "receipt_id", "receipt_id_missing", testCase.case_id);
      rejectUnless(
        receipt.execution_profile === input.execution_profile &&
          receipt.execution_commitment.kind === input.execution_profile &&
          committed.execution_commitment.kind === input.execution_profile,
        "receipt_execution_profile_mismatch",
        `${testCase.case_id}: Receipt execution profile or commitment kind differs from committed execution`,
      );
      rejectUnless(
        identity.envelope_id === committed.envelope_id &&
          identity.core_deployment_id === committed.core_deployment_id &&
          receipt.protocol_spec_id === committed.protocol_spec_id &&
          receipt.constitution_id === committed.constitution_id &&
          receipt.execution_coverage === committed.execution_coverage,
        "receipt_identity_relationship_mismatch",
        `${testCase.case_id}: Receipt header differs from committed execution identity`,
      );

      const committedTargetIds = committed.execution_targets.map((target) => target.execution_target_id);
      const receiptTargetIds = receipt.execution_targets.map((target) => target.execution_target_id);
      rejectUnless(
        sameJson(receiptTargetIds, committedTargetIds),
        "receipt_execution_target_coverage_mismatch",
        `${testCase.case_id}: Receipt Target sequence differs from committed execution`,
      );
      rejectUnless(
        receipt.execution_targets.every(
          (target, index) => target.market_id === committed.execution_targets[index].market_id,
        ),
        "receipt_market_id_mismatch",
        `${testCase.case_id}: Receipt Market identity differs from committed execution`,
      );
      rejectUnless(
        receipt.execution_targets.every(
          (target, index) => target.engine_revision_id === committed.execution_targets[index].engine_revision_id,
        ),
        "receipt_engine_revision_id_mismatch",
        `${testCase.case_id}: Receipt Engine Revision differs from committed execution`,
      );
      rejectUnless(
        sameJson(receipt.principal_authorization_states, committed.principal_authorization_states),
        "receipt_principal_authorization_state_mismatch",
        `${testCase.case_id}: Receipt Principal, Scope, replay, or Fill state differs from committed execution`,
      );

      const exactStringSet = (actual, expected) =>
        actual.length === expected.length &&
        sameJson([...actual].sort(), [...expected].sort());
      rejectUnless(
        exactStringSet(receipt.liquidity_domain_revision_ids, committed.liquidity_domain_revision_ids),
        "receipt_domain_revision_coverage_mismatch",
        `${testCase.case_id}: Receipt Domain Revision set differs from committed execution`,
      );

      const knownTargets = new Set(receiptTargetIds);
      const knownScopes = new Set(receipt.principal_authorization_states.map((state) => state.authorization_scope_id));
      const committedEffects = committed.protected_effect_occurrences;
      const receiptEffects = receipt.protected_effect_occurrences;
      const committedOccurrenceIds = committedEffects.map((effect) => effect.effect_occurrence_id);
      const occurrenceIds = receiptEffects.map((effect) => effect.effect_occurrence_id);
      rejectUnless(
        new Set(committedOccurrenceIds).size === committedOccurrenceIds.length &&
          new Set(occurrenceIds).size === occurrenceIds.length &&
          sameJson(occurrenceIds, committedOccurrenceIds),
        "receipt_protected_effect_coverage_mismatch",
        `${testCase.case_id}: Receipt protected Effect occurrence sequence differs from committed execution`,
      );
      const effectReferencesAreValid = (effect) =>
        knownTargets.has(effect.execution_target_id) &&
        knownScopes.has(effect.authorization_scope_id) &&
        effect.commitment_position.kind === input.execution_profile;
      rejectUnless(
        committedEffects.every(effectReferencesAreValid) && receiptEffects.every(effectReferencesAreValid),
        "receipt_protected_effect_reference_mismatch",
        `${testCase.case_id}: protected Effect references an unknown Target, Scope, or profile`,
      );
      rejectUnless(
        sameJson(receiptEffects, committedEffects),
        "receipt_protected_effect_relationship_mismatch",
        `${testCase.case_id}: Receipt protected Effect rows differ from committed execution`,
      );

      const committedAssessmentKeys = committed.applicable_assessment_group_keys
        .map((key) => canonicalJson(key, `${testCase.case_id}.committed_assessment_key`))
        .sort();
      const receiptAssessmentKeys = receipt.assessment_groups
        .map((record) => canonicalJson(record.group_key, `${testCase.case_id}.receipt_assessment_key`))
        .sort();
      rejectUnless(
        sameJson(receiptAssessmentKeys, committedAssessmentKeys),
        "receipt_assessment_group_coverage_mismatch",
        `${testCase.case_id}: Receipt assessment-group set differs from committed execution`,
      );
      for (const record of receipt.assessment_groups) {
        const basisBefore = decimal(record.basis_before, `${testCase.case_id}.basis_before`);
        const fillBasis = decimal(record.fill_basis, `${testCase.case_id}.fill_basis`);
        const basisAfter = decimal(record.basis_after, `${testCase.case_id}.basis_after`);
        const assessmentBefore = decimal(record.assessment_before, `${testCase.case_id}.assessment_before`);
        const assessmentDelta = decimal(record.assessment_delta, `${testCase.case_id}.assessment_delta`);
        const assessmentAfter = decimal(record.assessment_after, `${testCase.case_id}.assessment_after`);
        const grossDebit = decimal(record.gross_assessment_debit, `${testCase.case_id}.gross_assessment_debit`);
        const withholding = decimal(record.external_tax_withheld, `${testCase.case_id}.external_tax_withheld`);
        const fundedCredit = decimal(record.funded_credit, `${testCase.case_id}.funded_credit`);
        const liabilityDelta = decimal(record.liability_delta, `${testCase.case_id}.liability_delta`);
        rejectUnless(
          record.applicable_debit_present === true &&
            basisAfter === basisBefore + fillBasis &&
            assessmentBefore === basisBefore / 2_000n &&
            assessmentAfter === basisAfter / 2_000n &&
            assessmentDelta === assessmentAfter - assessmentBefore &&
            decimal(record.remainder_before, `${testCase.case_id}.remainder_before`) === basisBefore % 2_000n &&
            decimal(record.remainder_after, `${testCase.case_id}.remainder_after`) === basisAfter % 2_000n &&
            grossDebit === assessmentDelta &&
            withholding <= grossDebit &&
            fundedCredit === grossDebit - withholding &&
            liabilityDelta === fundedCredit,
          "receipt_assessment_arithmetic_mismatch",
          `${testCase.case_id}: Receipt assessment arithmetic or funded liability is inconsistent`,
        );
      }

      const committedOpaqueOutputs = committed.opaque_engine_output_commitments.map((entry) => ({
        execution_target_id: entry.execution_target_id,
        output_digest: entry.output_digest,
        evidence_ref: entry.evidence_ref,
      }));
      const receiptOpaqueOutputs = receipt.opaque_engine_outputs.map((entry) => ({
        execution_target_id: entry.execution_target_id,
        output_digest: entry.output_digest,
        evidence_ref: entry.evidence_ref,
      }));
      rejectUnless(
        sameJson(receiptOpaqueOutputs, committedOpaqueOutputs) &&
          receipt.opaque_engine_outputs.every((entry) => knownTargets.has(entry.execution_target_id)),
        "receipt_opaque_output_coverage_mismatch",
        `${testCase.case_id}: Receipt opaque Engine output commitments differ from execution`,
      );

      if (input.execution_profile === "ATOMIC_PLAN_V1") {
        rejectUnless(
          receipt.execution_commitment.plan_digest === committed.execution_commitment.plan_digest,
          "receipt_execution_commitment_mismatch",
          `${testCase.case_id}: Receipt atomic plan commitment differs from execution`,
        );
        rejectUnless(
          identity.execution_commitment_digest === receipt.execution_commitment.plan_digest,
          "receipt_identity_commitment_mismatch",
          `${testCase.case_id}: Receipt identity does not commit the atomic plan digest`,
        );
      } else {
        rejectUnless(
          receipt.execution_commitment.session_id === committed.execution_commitment.session_id &&
            receipt.execution_commitment.final_transcript_digest ===
              committed.execution_commitment.final_transcript_digest &&
            sameJson(
              receipt.execution_commitment.segment_commitments,
              committed.execution_commitment.segment_commitments,
            ),
          "receipt_execution_commitment_mismatch",
          `${testCase.case_id}: Receipt bounded-session commitments differ from execution`,
        );
        const checkpoint = receipt.execution_commitment.final_zero_obligation_checkpoint;
        rejectUnless(
          sameJson(checkpoint, committed.execution_commitment.final_zero_obligation_checkpoint) &&
            checkpoint.remaining_obligation_count === "0" &&
            checkpoint.all_obligations_zero === true,
          "receipt_final_checkpoint_mismatch",
          `${testCase.case_id}: Receipt final zero-obligation checkpoint differs from execution`,
        );
        rejectUnless(
          identity.execution_commitment_digest === receipt.execution_commitment.final_transcript_digest,
          "receipt_identity_commitment_mismatch",
          `${testCase.case_id}: Receipt identity does not commit the final transcript digest`,
        );
      }
      return;
    }
    case "assessment_receipt": {
      if (input.applicable_debit_present) {
        rejectUnless(
          input.assessment_record_present,
          "applicable_assessment_record_missing",
          `${testCase.case_id}: an applicable debit has no assessment record`,
        );
        rejectUnless(
          typeof input.assessment_group_key === "string" && input.assessment_amount !== undefined,
          "applicable_assessment_record_incomplete",
          `${testCase.case_id}: assessment record is incomplete`,
        );
      } else {
        rejectUnless(
          !input.assessment_record_present,
          "absent_assessment_group_has_record",
          `${testCase.case_id}: an absent assessment group has a record`,
        );
      }
      return;
    }
    case "bounded_session_receipt": {
      rejectUnless(
        input.executed_segment_ordinals.length === input.receipt_segment_ordinals.length &&
          input.executed_segment_ordinals.every((ordinal, index) => ordinal === input.receipt_segment_ordinals[index]),
        "session_transcript_order_mismatch",
        `${testCase.case_id}: Receipt transcript order differs from execution`,
      );
      rejectUnless(
        input.computed_final_transcript_digest === input.receipt_final_transcript_digest,
        "session_transcript_digest_mismatch",
        `${testCase.case_id}: Receipt transcript digest mismatch`,
      );
      rejectUnless(
        input.final_obligations.every((obligation) => decimal(obligation.remaining_amount, `${testCase.case_id}.remaining_amount`) === 0n),
        "session_final_obligation_nonzero",
        `${testCase.case_id}: final Receipt contains a nonzero obligation`,
      );
      rejectUnless(
        input.final_checkpoint_present,
        "session_final_checkpoint_missing",
        `${testCase.case_id}: final session checkpoint is missing`,
      );
      return;
    }
    case "offchain_valuation": {
      rejectUnless(
        input.primary_provenance === "OFFCHAIN_DERIVED",
        "valuation_provenance_invalid",
        `${testCase.case_id}: valuation has invalid provenance`,
      );
      rejectUnless(
        Array.isArray(input.source_assets) && input.source_assets.length > 0,
        "valuation_source_assets_missing",
        `${testCase.case_id}: valuation omits source assets`,
      );
      rejectUnless(
        typeof input.price_source_id === "string" && input.price_source_id.length > 0,
        "valuation_price_source_missing",
        `${testCase.case_id}: valuation omits its price source`,
      );
      rejectUnless(
        typeof input.observation_time === "string" && input.observation_time.length > 0,
        "valuation_observation_time_missing",
        `${testCase.case_id}: valuation omits observation time`,
      );
      rejectUnless(
        typeof input.method === "string" && input.method.length > 0,
        "valuation_method_missing",
        `${testCase.case_id}: valuation omits its method`,
      );
      rejectUnless(
        !input.onchain_assessment_state_changed,
        "valuation_mutates_assessment_state",
        `${testCase.case_id}: offchain valuation mutated assessment state`,
      );
      return;
    }
    default:
      throw new CaseRejection("unknown_evidence_check", `${testCase.case_id}: unknown evidence check ${input.check}`);
  }
}

export function validateEvidenceVectors(document) {
  requireSchema(document, EVIDENCE_SCHEMA);
  return runDeclaredCases(
    document,
    (testCase) => ({ status: testCase.expected_status, code: testCase.reject_code }),
    evaluateEvidenceCase,
  );
}

function digestSessionInitial(sessionContext) {
  return jcsDigest("programmable:bounded-session:v1:init", sessionContext, "bounded-session initial context");
}

function digestSessionSegment(priorDigest, record) {
  return rawDigest(
    "programmable:bounded-session:v1:segment",
    digestBytes(priorDigest, "bounded-session segment prior digest"),
    Buffer.from(canonicalJson(record, "bounded-session segment"), "utf8"),
  );
}

function digestSessionFinal(priorDigest, record) {
  return rawDigest(
    "programmable:bounded-session:v1:final",
    digestBytes(priorDigest, "bounded-session final prior digest"),
    Buffer.from(canonicalJson(record, "bounded-session final checkpoint"), "utf8"),
  );
}

function sameJson(left, right) {
  return canonicalJson(left, "semantic comparison") === canonicalJson(right, "semantic comparison");
}

function observationMatchesKey(observation, key, opening) {
  const expectedKind = opening
    ? "PROTECTED_GROSS_OUTFLOW"
    : key.return_condition === "GROSS_AT_LEAST"
      ? "PROTECTED_GROSS_RETURN"
      : "PROTECTED_SPENDABLE_RETURN";
  return (
    observation.kind === expectedKind &&
    observation.evidence_class === "PROFILE_VERIFIED" &&
    observation.domain_revision_id === key.domain_revision_id &&
    observation.asset_profile_id === key.asset_profile_id &&
    observation.native_asset_id === key.native_asset_id &&
    observation.source_actor_id === (opening ? key.return_recipient_id : key.obligated_actor_id) &&
    observation.destination_id === (opening ? key.obligated_actor_id : key.return_recipient_id)
  );
}

function temporaryObligationAdmissionKey(value) {
  return canonicalJson(
    {
      authorization_scope_id: value.authorization_scope_id,
      domain_revision_id: value.domain_revision_id,
      asset_profile_id: value.asset_profile_id,
      native_asset_id: value.native_asset_id,
      obligated_actor_id: value.obligated_actor_id,
      return_recipient_id: value.return_recipient_id,
    },
    "temporary-obligation admission",
  );
}

function evaluateBoundedSessionCase(testCase) {
  const { session_context: context, steps } = testCase;
  const descriptor = context.session_descriptor;
  rejectUnless(
    sameJson(testCase.required_profiles, ["portable-core-v1", "bounded-session-v1"]),
    "final_checkpoint_invalid",
    `${testCase.case_id}: bounded-session vectors require the exact portable and bounded-session profiles`,
  );
  const authorizationScopeIds = new Set(descriptor.authorization_scope_ids);
  const participantIds = new Set();
  const participantById = new Map();
  const obligationAdmissionsByParticipant = new Map();
  for (const participant of descriptor.participants) {
    rejectUnless(
      participant.participant_id !== "programmable.core",
      "final_checkpoint_invalid",
      `${testCase.case_id}: programmable.core is reserved and cannot be a participant ID`,
    );
    rejectUnless(
      !participantIds.has(participant.participant_id),
      "final_checkpoint_invalid",
      `${testCase.case_id}: duplicate participant ID`,
    );
    participantIds.add(participant.participant_id);
    participantById.set(participant.participant_id, participant);
    const admissions = new Map();
    for (const admission of participant.temporary_obligation_admissions) {
      rejectUnless(
        authorizationScopeIds.has(admission.authorization_scope_id) &&
          participant.liquidity_domain_revision_ids.includes(admission.domain_revision_id),
        "domain_or_scope_outside_session",
        `${testCase.case_id}: temporary-obligation admission names a Scope or Domain Revision outside the Session Descriptor`,
      );
      const admissionKey = temporaryObligationAdmissionKey(admission);
      rejectUnless(
        !admissions.has(admissionKey),
        "domain_or_scope_outside_session",
        `${testCase.case_id}: duplicate temporary-obligation admission tuple`,
      );
      admissions.set(admissionKey, admission);
    }
    obligationAdmissionsByParticipant.set(participant.participant_id, admissions);
  }
  const targetById = new Map();
  for (const target of descriptor.targets) {
    rejectUnless(
      target.target_id !== "programmable.core",
      "unknown_or_unauthorized_target",
      `${testCase.case_id}: programmable.core is reserved and cannot be a target ID`,
    );
    rejectUnless(!targetById.has(target.target_id), "unknown_or_unauthorized_target", `${testCase.case_id}: duplicate target ID`);
    rejectUnless(
      participantIds.has(target.participant_id),
      "unknown_or_unauthorized_target",
      `${testCase.case_id}: target has no declared participant`,
    );
    const participant = participantById.get(target.participant_id);
    if (target.target_kind === "ENGINE") {
      rejectUnless(
        target.revision_id === participant.engine_revision_id,
        "target_revision_mismatch",
        `${testCase.case_id}: Engine Target revision differs from its participant Engine Revision`,
      );
    } else {
      const admittedComponent = participant.protected_profile_component_admissions.find(
        (admission) =>
          admission.revision_id === target.revision_id &&
          admission.component_profile_id === target.component_profile_id,
      );
      rejectUnless(
        target.target_kind === "PROTECTED_PROFILE_COMPONENT" &&
          target.authority_source === "IMMUTABLE_CORE_DEPLOYMENT_PIN" &&
          Boolean(admittedComponent),
        "target_component_admission_mismatch",
        `${testCase.case_id}: protected profile component revision/profile tuple is not an immutable Core-deployment-pinned participant component`,
      );
    }
    rejectUnless(
      target.allowed_proposer_ids.every(
        (proposerId) => proposerId === "programmable.core" || participantIds.has(proposerId),
      ),
      "unknown_or_unauthorized_target",
      `${testCase.case_id}: target admits an unauthenticated proposer`,
    );
    targetById.set(target.target_id, target);
  }

  const limits = descriptor.resource_limits;
  rejectUnless(
    BigInt(steps.length) <= decimal(limits.max_segments, `${testCase.case_id}.max_segments`),
    "resource_limit_exceeded",
    `${testCase.case_id}: segment limit exceeded`,
  );

  let currentDigest = digestSessionInitial(context);
  let currentPhase = "AUTHENTICATED";
  let nextOrdinal = 0n;
  const cumulativeResources = Object.fromEntries(SESSION_RESOURCE_FIELDS.map(([field]) => [field, 0n]));
  const observationIds = new Set();
  const observationsById = new Map();
  const allocationIds = new Set();
  const allocatedByObservation = new Map();
  const obligations = new Map();
  const openedByEffectOccurrence = new Set();
  const effectOccurrenceIds = new Set();
  const calledTargetIds = new Set();
  const segmentDigests = [];
  let terminalSettlement = null;

  for (const step of steps) {
    const record = step.record;

    // The state-machine order is intentional: transcript position and phase are
    // authenticated before proposer/target authority, then resources and
    // observations, and finally obligation state, before any protected move.
    rejectUnless(record.session_id === context.session_id, "transcript_mismatch", `${testCase.case_id}: segment session ID mismatch`);
    rejectUnless(
      decimal(record.segment_ordinal, `${testCase.case_id}.segment_ordinal`) === nextOrdinal,
      "invalid_segment_ordinal",
      `${testCase.case_id}: segment ordinal is not the next zero-based ordinal`,
    );
    rejectUnless(
      step.claimed_before_digest === currentDigest,
      "transcript_mismatch",
      `${testCase.case_id}: segment claimed stale prior digest`,
    );
    rejectUnless(
      record.phase_before === currentPhase && PHASE_TRANSITIONS.has(`${record.phase_before}->${record.phase_after}`),
      "invalid_phase_transition",
      `${testCase.case_id}: invalid phase transition`,
    );
    rejectUnless(
      record.proposer_id === "programmable.core" || participantIds.has(record.proposer_id),
      "unauthorized_proposer",
      `${testCase.case_id}: proposer is not an authenticated session participant`,
    );
    for (const targetId of record.target_ids) {
      const target = targetById.get(targetId);
      rejectUnless(Boolean(target), "unknown_or_unauthorized_target", `${testCase.case_id}: undeclared target ${targetId}`);
      rejectUnless(
        !calledTargetIds.has(targetId),
        "target_call_reused",
        `${testCase.case_id}: target call slot ${targetId} was already consumed`,
      );
      rejectUnless(
        target.allowed_proposer_ids.includes(record.proposer_id) && target.allowed_phases.includes(record.phase_before),
        "unknown_or_unauthorized_target",
        `${testCase.case_id}: proposer or phase is not admitted for ${targetId}`,
      );
      calledTargetIds.add(targetId);
    }
    rejectUnless(
      record.segment_payload_digest !== record.effect_proposal_digest,
      "transcript_mismatch",
      `${testCase.case_id}: segment payload and protected Effect proposal use distinct commitments`,
    );
    for (const occurrenceId of record.protected_effect_occurrence_ids) {
      rejectUnless(
        !effectOccurrenceIds.has(occurrenceId),
        "effect_occurrence_reused",
        `${testCase.case_id}: protected Effect occurrence ${occurrenceId} is reused`,
      );
      effectOccurrenceIds.add(occurrenceId);
    }

    const actualResourceUse = {
      target_calls: BigInt(record.target_ids.length),
      protected_effects: BigInt(record.protected_effect_occurrence_ids.length),
      obligation_keys_created: BigInt(record.obligation_operations.filter((operation) => operation.operation === "OPEN").length),
      observations: BigInt(record.observations.length),
    };
    for (const [field, actual] of Object.entries(actualResourceUse)) {
      rejectUnless(
        decimal(record.resource_use[field], `${testCase.case_id}.${field}`) === actual,
        "resource_limit_exceeded",
        `${testCase.case_id}: declared ${field} differs from normalized record`,
      );
    }
    for (const field of ["observed_bytes", "return_bytes"]) {
      rejectUnless(
        decimal(record.resource_use[field], `${testCase.case_id}.${field}`) ===
          decimal(step.measured_copied_bytes[field], `${testCase.case_id}.measured_copied_bytes.${field}`),
        "resource_limit_exceeded",
        `${testCase.case_id}: declared ${field} differs from the independently Core-measured copied-byte count`,
      );
    }
    rejectUnless(
      (record.observations.length === 0 &&
        decimal(record.resource_use.observed_bytes, `${testCase.case_id}.observed_bytes`) === 0n) ||
        (record.observations.length > 0 &&
          decimal(record.resource_use.observed_bytes, `${testCase.case_id}.observed_bytes`) > 0n),
      "resource_limit_exceeded",
      `${testCase.case_id}: observed-byte use does not match Observation presence`,
    );
    for (const [field, limitField] of SESSION_RESOURCE_FIELDS) {
      const use = decimal(record.resource_use[field], `${testCase.case_id}.${field}`);
      cumulativeResources[field] += use;
      rejectUnless(
        cumulativeResources[field] <= decimal(limits[limitField], `${testCase.case_id}.${limitField}`),
        "resource_limit_exceeded",
        `${testCase.case_id}: ${limitField} exceeded`,
      );
    }

    const segmentObservationIds = new Set();
    for (const observation of record.observations) {
      rejectUnless(
        !observationIds.has(observation.observation_id),
        "invalid_observation",
        `${testCase.case_id}: duplicate observation ID`,
      );
      rejectUnless(
        observation.producer_id === "programmable.core" &&
          record.target_ids.includes(observation.source_target_id) &&
          targetById.has(observation.source_target_id),
        "invalid_observation",
        `${testCase.case_id}: observation source is not Core-authenticated`,
      );
      if (observation.kind.startsWith("PROTECTED_")) {
        const target = targetById.get(observation.source_target_id);
        const participant = participantById.get(target.participant_id);
        rejectUnless(
          participant.liquidity_domain_revision_ids.includes(observation.domain_revision_id),
          "domain_or_scope_outside_session",
          `${testCase.case_id}: protected Observation Domain Revision is outside its participant`,
        );
      }
      observationIds.add(observation.observation_id);
      segmentObservationIds.add(observation.observation_id);
      observationsById.set(observation.observation_id, observation);
    }

    const openingEffectsByOccurrence = new Map();
    const consumedOpeningEffectIds = new Set();
    for (const openingEffect of record.temporary_obligation_opening_effects) {
      rejectUnless(
        !openingEffectsByOccurrence.has(openingEffect.effect_occurrence_id) &&
          record.protected_effect_occurrence_ids.includes(openingEffect.effect_occurrence_id),
        "obligation_key_mismatch",
        `${testCase.case_id}: temporary-obligation opening Effect is duplicate or absent from this segment`,
      );
      const target = targetById.get(openingEffect.execution_target_id);
      rejectUnless(
        Boolean(target) &&
          record.target_ids.includes(openingEffect.execution_target_id) &&
          target.participant_id === openingEffect.participant_id,
        "obligation_key_mismatch",
        `${testCase.case_id}: temporary-obligation opening Effect does not resolve to its called participant Target`,
      );
      const participant = participantById.get(openingEffect.participant_id);
      rejectUnless(
        authorizationScopeIds.has(openingEffect.authorization_scope_id) &&
          participant.liquidity_domain_revision_ids.includes(openingEffect.domain_revision_id),
        "domain_or_scope_outside_session",
        `${testCase.case_id}: temporary-obligation opening Effect Scope or Domain Revision is outside the session`,
      );
      const admission = obligationAdmissionsByParticipant
        .get(openingEffect.participant_id)
        .get(temporaryObligationAdmissionKey(openingEffect));
      rejectUnless(
        Boolean(admission) &&
          decimal(openingEffect.gross_debit, `${testCase.case_id}.opening_effect.gross_debit`) <=
            decimal(admission.max_amount, `${testCase.case_id}.temporary_obligation_admission.max_amount`),
        "domain_or_scope_outside_session",
        `${testCase.case_id}: temporary-obligation opening Effect provenance or amount is not participant-admitted`,
      );
      openingEffectsByOccurrence.set(openingEffect.effect_occurrence_id, openingEffect);
    }

    for (const operation of record.obligation_operations) {
      const key = operation.key;
      const observation = observationsById.get(operation.observation_id);
      rejectUnless(
        key.session_id === context.session_id,
        "obligation_key_mismatch",
        `${testCase.case_id}: obligation belongs to another session`,
      );
      rejectUnless(
        authorizationScopeIds.has(key.authorization_scope_id),
        "domain_or_scope_outside_session",
        `${testCase.case_id}: obligation Scope is outside the Session Descriptor`,
      );
      const amount = decimal(operation.amount, `${testCase.case_id}.${operation.operation}.amount`);
      rejectUnless(amount > 0n, "obligation_overclose", `${testCase.case_id}: zero obligation allocation`);
      rejectUnless(Boolean(observation), "invalid_observation", `${testCase.case_id}: obligation names an unknown observation`);

      if (operation.operation === "OPEN") {
        const openingEffect = openingEffectsByOccurrence.get(key.opening_effect_occurrence_id);
        rejectUnless(
          !obligations.has(key.obligation_key_id),
          "obligation_key_reused",
          `${testCase.case_id}: obligation key reused`,
        );
        rejectUnless(
          Boolean(openingEffect) &&
            !openedByEffectOccurrence.has(key.opening_effect_occurrence_id),
          "obligation_key_mismatch",
          `${testCase.case_id}: obligation does not resolve one fresh opening Effect record in this segment`,
        );
        rejectUnless(
          openingEffect.authorization_scope_id === key.authorization_scope_id &&
            openingEffect.domain_revision_id === key.domain_revision_id &&
            openingEffect.asset_profile_id === key.asset_profile_id &&
            openingEffect.native_asset_id === key.native_asset_id &&
            openingEffect.obligated_actor_id === key.obligated_actor_id &&
            openingEffect.return_recipient_id === key.return_recipient_id &&
            openingEffect.execution_target_id === observation?.source_target_id &&
            decimal(openingEffect.gross_debit, `${testCase.case_id}.opening_effect.gross_debit`) === amount,
          "obligation_key_mismatch",
          `${testCase.case_id}: obligation key, amount, Target, or protected opening Effect provenance differs`,
        );
        rejectUnless(
          segmentObservationIds.has(operation.observation_id) && observationMatchesKey(observation, key, true),
          "invalid_observation",
          `${testCase.case_id}: obligation OPEN lacks its exact outflow observation`,
        );
        rejectUnless(
          decimal(observation.amount, `${testCase.case_id}.observation.amount`) === amount,
          "obligation_key_mismatch",
          `${testCase.case_id}: opened amount differs from observed gross outflow`,
        );
        const sourceTarget = targetById.get(observation.source_target_id);
        const sourceParticipant = participantById.get(sourceTarget.participant_id);
        rejectUnless(
          sourceParticipant.liquidity_domain_revision_ids.includes(key.domain_revision_id),
          "domain_or_scope_outside_session",
          `${testCase.case_id}: obligation Domain Revision is outside its source participant`,
        );
        openedByEffectOccurrence.add(key.opening_effect_occurrence_id);
        consumedOpeningEffectIds.add(key.opening_effect_occurrence_id);
        obligations.set(key.obligation_key_id, {
          key,
          opened: amount,
          closed: 0n,
        });
        continue;
      }

      const obligation = obligations.get(key.obligation_key_id);
      rejectUnless(Boolean(obligation), "obligation_key_mismatch", `${testCase.case_id}: CLOSE names an unknown key`);
      rejectUnless(sameJson(key, obligation.key), "obligation_key_mismatch", `${testCase.case_id}: obligation key fields differ`);
      rejectUnless(
        !allocationIds.has(operation.allocation_id),
        "obligation_key_mismatch",
        `${testCase.case_id}: allocation ID reused`,
      );
      allocationIds.add(operation.allocation_id);
      rejectUnless(
        segmentObservationIds.has(operation.observation_id) && observationMatchesKey(observation, key, false),
        "invalid_observation",
        `${testCase.case_id}: CLOSE lacks its exact return observation`,
      );
      rejectUnless(
        decimal(record.segment_ordinal, `${testCase.case_id}.segment_ordinal`) <=
          decimal(key.close_by_segment_ordinal, `${testCase.case_id}.close_by_segment_ordinal`),
        "obligation_deadline_exceeded",
        `${testCase.case_id}: obligation deadline exceeded`,
      );
      const observationAmount = decimal(observation.amount, `${testCase.case_id}.observation.amount`);
      const observationAllocated = (allocatedByObservation.get(operation.observation_id) ?? 0n) + amount;
      rejectUnless(
        observationAllocated <= observationAmount,
        "obligation_overclose",
        `${testCase.case_id}: observation allocation exceeds the realized return`,
      );
      allocatedByObservation.set(operation.observation_id, observationAllocated);
      rejectUnless(
        obligation.closed + amount <= obligation.opened,
        "obligation_overclose",
        `${testCase.case_id}: obligation over-closure`,
      );
      obligation.closed += amount;
    }
    rejectUnless(
      consumedOpeningEffectIds.size === openingEffectsByOccurrence.size,
      "obligation_key_mismatch",
      `${testCase.case_id}: one temporary-obligation opening Effect has no exact OPEN operation`,
    );

    const hasProtectedObservation = record.observations.some((observation) =>
      observation.kind.startsWith("PROTECTED_"),
    );
    const actualProtectedMovement =
      record.protected_effect_occurrence_ids.length > 0 ||
      hasProtectedObservation ||
      record.obligation_operations.length > 0;
    rejectUnless(
      record.protected_movement === actualProtectedMovement,
      "protected_movement_mismatch",
      `${testCase.case_id}: protected_movement does not match the normalized segment`,
    );

    if (record.phase_after === "RECONCILING") {
      rejectUnless(
        [...obligations.values()].every((obligation) => obligation.closed === obligation.opened),
        "obligation_remaining",
        `${testCase.case_id}: obligation remains before reconciliation`,
      );
      rejectUnless(
        Boolean(record.terminal_settlement) && record.terminal_settlement.assessment_funding_status === "SETTLED",
        "terminal_settlement_invalid",
        `${testCase.case_id}: assessment funding is not settled before reconciliation`,
      );
      if (record.phase_before === "AUTHENTICATED") {
        rejectUnless(
          record.target_ids.length === 0 &&
            record.protected_effect_occurrence_ids.length === 0 &&
            record.observations.length === 0 &&
            record.obligation_operations.length === 0 &&
            record.resource_use.observed_bytes === "0" &&
            record.resource_use.return_bytes === "0" &&
            !record.protected_movement,
          "invalid_phase_transition",
          `${testCase.case_id}: direct AUTHENTICATED to RECONCILING is an empty-session path only`,
        );
      }
      terminalSettlement = record.terminal_settlement;
    }

    const afterDigest = digestSessionSegment(currentDigest, record);
    if (step.expected_after_digest !== undefined) {
      rejectUnless(
        step.expected_after_digest === afterDigest,
        "transcript_mismatch",
        `${testCase.case_id}: expected segment digest is incorrect`,
      );
    }
    segmentDigests.push(afterDigest);
    currentDigest = afterDigest;
    currentPhase = record.phase_after;
    nextOrdinal += 1n;
  }

  if (testCase.expected_status === "reject" && testCase.final_checkpoint === undefined) {
    return;
  }

  const checkpoint = testCase.final_checkpoint;
  rejectUnless(Boolean(checkpoint), "final_checkpoint_invalid", `${testCase.case_id}: final checkpoint missing`);
  rejectUnless(
    checkpoint.claimed_before_digest === currentDigest,
    "transcript_mismatch",
    `${testCase.case_id}: final checkpoint claimed stale prior digest`,
  );
  rejectUnless(
    currentPhase === "RECONCILING" &&
      checkpoint.record.session_id === context.session_id &&
      checkpoint.record.phase_before === "RECONCILING" &&
      checkpoint.record.phase_after === "FINAL_CHECKPOINT",
    "final_checkpoint_invalid",
    `${testCase.case_id}: invalid final checkpoint transition`,
  );
  rejectUnless(
    Boolean(terminalSettlement) &&
      checkpoint.record.obligation_state_digest === terminalSettlement.obligation_state_digest &&
      checkpoint.record.protected_accounting_digest === terminalSettlement.protected_accounting_digest &&
      checkpoint.record.assessment_state_digest === terminalSettlement.assessment_state_digest,
    "terminal_settlement_invalid",
    `${testCase.case_id}: final checkpoint does not preserve the settlement completed before reconciliation`,
  );
  rejectUnless(
    [...obligations.values()].every((obligation) => obligation.closed === obligation.opened),
    "obligation_remaining",
    `${testCase.case_id}: final checkpoint has an open obligation`,
  );
  const checkpointParticipants = checkpoint.record.participant_checkpoints.map((entry) => entry.participant_id);
  rejectUnless(
    checkpoint.record.participant_checkpoints.every((entry) => entry.evidence_class === "ENGINE_ATTESTED"),
    "final_checkpoint_invalid",
    `${testCase.case_id}: portable participant checkpoint lacks independent evidence for a stronger Evidence Class`,
  );
  rejectUnless(
    checkpointParticipants.length === participantIds.size &&
      new Set(checkpointParticipants).size === checkpointParticipants.length &&
      checkpointParticipants.every((participantId) => participantIds.has(participantId)),
    "final_checkpoint_invalid",
    `${testCase.case_id}: participant checkpoint coverage is incomplete`,
  );

  const finalDigest = digestSessionFinal(currentDigest, checkpoint.record);
  if (checkpoint.expected_final_digest !== undefined) {
    rejectUnless(
      checkpoint.expected_final_digest === finalDigest,
      "transcript_mismatch",
      `${testCase.case_id}: expected final digest is incorrect`,
    );
  }

  if (testCase.expected !== undefined) {
    const actual = {
      initial_digest: digestSessionInitial(context),
      segment_after_digests: segmentDigests,
      final_digest: finalDigest,
      final_phase: "COMMITTED",
      open_obligation_count: "0",
    };
    rejectUnless(sameJson(testCase.expected, actual), "final_checkpoint_invalid", `${testCase.case_id}: accepted result mismatch`);
  }
  return { finalDigest, segmentDigests };
}

export function validateBoundedSessionVectors(document) {
  requireSchema(document, BOUNDED_SESSION_SCHEMA);
  return runDeclaredCases(
    document,
    (testCase) => ({ status: testCase.expected_status, code: testCase.expected_error }),
    evaluateBoundedSessionCase,
  );
}

function decodeUtf8Hex(hex, location) {
  rejectUnless(
    typeof hex === "string" && /^(?:[0-9a-f]{2})+$/.test(hex),
    "invalid_json",
    `${location}: input is not lowercase hexadecimal bytes`,
  );
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(hex, "hex"));
  } catch {
    throw new CaseRejection("invalid_json", `${location}: input is not valid UTF-8`);
  }
}

function parseDuplicateSafeJson(source, location) {
  const duplicateError = duplicateKeyValidator.validate(source, false);
  if (duplicateError) {
    throw new CaseRejection("duplicate_object_key", `${location}: ${String(duplicateError)}`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new CaseRejection("invalid_json", `${location}: ${error.message}`);
  }
}

function assertHashablePortableValue(value, location) {
  if (typeof value === "number") {
    throw new CaseRejection("json_number_forbidden", `${location}: JSON numbers are forbidden`);
  }
  if (typeof value === "string") {
    for (let index = 0; index < value.length; index += 1) {
      const codeUnit = value.charCodeAt(index);
      if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        rejectUnless(
          next >= 0xdc00 && next <= 0xdfff,
          "ijson_lone_surrogate",
          `${location}: lone high surrogate`,
        );
        index += 1;
      } else {
        rejectUnless(
          codeUnit < 0xdc00 || codeUnit > 0xdfff,
          "ijson_lone_surrogate",
          `${location}: lone low surrogate`,
        );
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertHashablePortableValue(entry, `${location}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      rejectUnless(/^[\x00-\x7f]+$/.test(key), "non_ascii_object_key", `${location}: non-ASCII object key ${key}`);
      assertHashablePortableValue(child, `${location}.${key}`);
    }
  }
}

function evaluateCanonicalIdentifierCase(testCase) {
  if (testCase.operation === "canonical_json_digest") {
    const source = decodeUtf8Hex(testCase.input_utf8_hex, `${testCase.case_id}.input_utf8_hex`);
    const value = parseDuplicateSafeJson(source, testCase.case_id);
    assertHashablePortableValue(value, testCase.case_id);
    const canonical = canonicalJson(value, testCase.case_id);
    const canonicalHex = Buffer.from(canonical, "utf8").toString("hex");
    const digest = rawDigest("programmable:canonical-json-test:v1", Buffer.from(canonical, "utf8"));
    rejectUnless(
      canonicalHex === testCase.expected_canonical_utf8_hex,
      "canonical_json_mismatch",
      `${testCase.case_id}: canonical bytes mismatch`,
    );
    rejectUnless(digest === testCase.expected_digest, "canonical_digest_mismatch", `${testCase.case_id}: digest mismatch`);
    return { digest, canonicalUtf8Hex: canonicalHex };
  }

  rejectUnless(
    testCase.operation === "authorization_scope_id",
    "unknown_identifier_operation",
    `${testCase.case_id}: unknown identifier operation`,
  );
  const descriptor = testCase.scope_descriptor;
  assertHashablePortableValue(descriptor, `${testCase.case_id}.scope_descriptor`);
  for (const forbiddenField of [
    "authorization_scope_id",
    "computed_scope_id",
    "signature",
    "signature_bytes",
    "native_signature_material",
  ]) {
    rejectUnless(
      !Object.prototype.hasOwnProperty.call(descriptor, forbiddenField),
      "scope_preimage_contains_excluded_field",
      `${testCase.case_id}: Scope preimage contains ${forbiddenField}`,
    );
  }

  const assetAuthorizations = new Map();
  for (const authorization of descriptor.asset_authorizations) {
    const tuple = `${authorization.asset_profile_id}\u0000${authorization.native_asset_id}`;
    rejectUnless(
      !assetAuthorizations.has(tuple),
      "duplicate_asset_authorization_tuple",
      `${testCase.case_id}: duplicate Asset Profile and native asset tuple`,
    );
    assetAuthorizations.set(tuple, authorization);
  }

  const sponsoredTuples = new Set();
  for (const sponsorship of descriptor.sponsored_assessment_authorizations ?? []) {
    const assetTuple = `${sponsorship.asset_profile_id}\u0000${sponsorship.native_asset_id}`;
    const sponsorshipTuple = `${sponsorship.assessment_authorization_scope_id}\u0000${assetTuple}`;
    rejectUnless(
      !sponsoredTuples.has(sponsorshipTuple),
      "duplicate_sponsored_assessment_tuple",
      `${testCase.case_id}: duplicate sponsored-assessment Scope and asset tuple`,
    );
    sponsoredTuples.add(sponsorshipTuple);
    const assetAuthorization = assetAuthorizations.get(assetTuple);
    rejectUnless(
      Boolean(assetAuthorization),
      "sponsored_assessment_asset_not_authorized",
      `${testCase.case_id}: sponsored-assessment asset tuple has no sponsor asset authorization`,
    );
    const sponsoredMaximum = decimal(
      sponsorship.maximum_gross_assessment_debit,
      `${testCase.case_id}.maximum_gross_assessment_debit`,
    );
    const assessmentMaximum = decimal(
      assetAuthorization.max_protocol_assessment_gross_debit,
      `${testCase.case_id}.max_protocol_assessment_gross_debit`,
    );
    const totalMaximum = decimal(
      assetAuthorization.max_total_gross_debit,
      `${testCase.case_id}.max_total_gross_debit`,
    );
    rejectUnless(
      sponsoredMaximum <= assessmentMaximum && sponsoredMaximum <= totalMaximum,
      "sponsored_assessment_limit_exceeds_asset_authorization",
      `${testCase.case_id}: sponsored-assessment maximum exceeds sponsor asset limits`,
    );
  }
  const digest = jcsDigest("programmable:authorization-scope:v1", descriptor, `${testCase.case_id}.scope_descriptor`);
  rejectUnless(digest === testCase.expected_digest, "scope_digest_mismatch", `${testCase.case_id}: Scope digest mismatch`);
  return { digest };
}

function validateCanonicalRelations(document, result) {
  const resultByCase = new Map(result.results.map((entry) => [entry.caseId, entry]));
  const relationIds = new Set();
  for (const relation of document.relations) {
    requireCondition(!relationIds.has(relation.relation_id), `Duplicate digest relation ${relation.relation_id}`);
    relationIds.add(relation.relation_id);
    const [leftId, rightId] = relation.case_ids;
    const left = resultByCase.get(leftId);
    const right = resultByCase.get(rightId);
    requireCondition(Boolean(left) && Boolean(right), `${relation.relation_id}: relation references an unknown case`);
    requireCondition(
      left.status === "accept" && right.status === "accept",
      `${relation.relation_id}: relation must reference accepted digest cases`,
    );
    const leftDigest = left.value?.digest;
    const rightDigest = right.value?.digest;
    requireCondition(Boolean(leftDigest) && Boolean(rightDigest), `${relation.relation_id}: relation case has no digest`);
    if (relation.operator === "equal_digest") {
      requireCondition(leftDigest === rightDigest, `${relation.relation_id}: expected equal digests`);
    } else if (relation.operator === "distinct_digest") {
      requireCondition(leftDigest !== rightDigest, `${relation.relation_id}: expected distinct digests`);
    } else {
      fail(`${relation.relation_id}: unknown relation operator ${relation.operator}`);
    }
  }
  return relationIds.size;
}

export function validateCanonicalIdentifierVectors(document) {
  requireSchema(document, CANONICAL_IDENTIFIERS_SCHEMA);
  requireCondition(Array.isArray(document.relations), `${CANONICAL_IDENTIFIERS_SCHEMA}: relations must be an array`);
  const result = runDeclaredCases(
    document,
    (testCase) => ({
      status: testCase.reject_code === undefined ? "accept" : "reject",
      code: testCase.reject_code,
    }),
    evaluateCanonicalIdentifierCase,
  );
  return { ...result, relations: validateCanonicalRelations(document, result) };
}

export const SEMANTIC_VECTOR_VALIDATORS = Object.freeze({
  [PROTECTED_EFFECTS_SCHEMA]: validateProtectedEffectsVectors,
  [EVIDENCE_SCHEMA]: validateEvidenceVectors,
  [BOUNDED_SESSION_SCHEMA]: validateBoundedSessionVectors,
  [CANONICAL_IDENTIFIERS_SCHEMA]: validateCanonicalIdentifierVectors,
});

export function validateSemanticVectorDocument(document) {
  const validator = SEMANTIC_VECTOR_VALIDATORS[document?.$schema];
  requireCondition(Boolean(validator), `No semantic validator registered for ${String(document?.$schema)}`);
  return validator(document);
}
