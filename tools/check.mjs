import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import canonicalize from "canonicalize";
import duplicateKeyValidator from "json-dup-key-validator";

import { SEMANTIC_VECTOR_VALIDATORS } from "./semantic-vectors.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_U128 = (1n << 128n) - 1n;
const ASSESSMENT_DENOMINATOR = 2_000n;
const CORE_PROFILE_ID = "portable-core-v1";
const CONSTITUTION_SCHEMA = "urn:programmable:schema:constitution:v1";
const MARKET_TEMPLATE_SCHEMA = "urn:programmable:schema:market-template:v1";
const IDENTIFIER_VECTOR_SCHEMA = "urn:programmable:schema:identifier-vectors:v1";
const ASSESSMENT_VECTOR_SCHEMA = "urn:programmable:schema:protocol-assessment-vectors:v1";
const PROTOCOL_RELEASE_SCHEMA = "urn:programmable:schema:protocol-release:v1";
const CONFORMANCE_REPORT_SCHEMA = "urn:programmable:schema:conformance-report:v1";
const BINDING_RELEASE_SCHEMA = "urn:programmable:schema:binding-release:v1";
const DEPLOYMENT_MANIFEST_SCHEMA = "urn:programmable:schema:deployment-manifest:v1";
const ZERO_BYTE = Buffer.from([0]);
const PORTABLE_RUNTIME_TOKENS = [
  "msg.sender",
  "tx.origin",
  "delegatecall",
  "Program ID",
  "PDA",
  "CPI",
  "SPL Token",
  "ERC-",
];
const JSON_DOCUMENT_CACHE = new Map();
const PROTOCOL_COMMIT_CACHE = new Map();
const UINT64_MASK = (1n << 64n) - 1n;
const KECCAK_ROTATION_OFFSETS = [
  0, 1, 62, 28, 27,
  36, 44, 6, 55, 20,
  3, 10, 43, 25, 39,
  41, 45, 15, 21, 8,
  18, 2, 61, 56, 14,
];
const KECCAK_ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
  0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
  0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
  0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
  0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

class CheckFailure extends Error {
  constructor(message, code = "repository_check_failed") {
    super(message);
    this.name = "CheckFailure";
    this.code = code;
  }
}

class ConformanceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ConformanceError";
    this.code = code;
  }
}

function fail(message, code) {
  throw new CheckFailure(message, code);
}

function requireCondition(condition, message, code) {
  if (!condition) {
    fail(message, code);
  }
}

function repositoryPath(relativePath) {
  const absolutePath = path.resolve(ROOT, relativePath);
  const relative = path.relative(ROOT, absolutePath);
  requireCondition(
    !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative),
    `Path escapes the repository: ${relativePath}`,
  );
  return absolutePath;
}

function relativePath(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function readText(relative) {
  const absolutePath = repositoryPath(relative);
  requireCondition(fs.existsSync(absolutePath), `Missing file: ${relative}`);
  return fs.readFileSync(absolutePath, "utf8");
}

function parseJsonSource(source, location) {
  try {
    const duplicateError = duplicateKeyValidator.validate(source, false);
    if (duplicateError) {
      throw new Error(String(duplicateError));
    }
    return JSON.parse(source);
  } catch (error) {
    fail(`${location}: invalid JSON or duplicate object key: ${error.message}`);
  }
}

function parseJson(relative) {
  if (!JSON_DOCUMENT_CACHE.has(relative)) {
    JSON_DOCUMENT_CACHE.set(relative, parseJsonSource(readText(relative), relative));
  }
  return JSON_DOCUMENT_CACHE.get(relative);
}

function loadRepositoryJsonDocuments() {
  const documents = new Map();
  const jsonPaths = listFiles(".", (absolutePath) => {
    const relative = relativePath(absolutePath);
    return (
      absolutePath.endsWith(".json") &&
      relative !== "package-lock.json" &&
      !relative.startsWith(".git/") &&
      !relative.startsWith("node_modules/")
    );
  }).map(relativePath);
  for (const jsonPath of jsonPaths) {
    documents.set(jsonPath, parseJson(jsonPath));
  }
  return documents;
}

function documentsWithSchema(repositoryJsonDocuments, schemaId) {
  return [...repositoryJsonDocuments].filter(([, document]) => document?.$schema === schemaId);
}

function rotateLeft64(value, offset) {
  if (offset === 0) return value & UINT64_MASK;
  const shift = BigInt(offset);
  return ((value << shift) | (value >> (64n - shift))) & UINT64_MASK;
}

function keccakF1600(state) {
  for (const roundConstant of KECCAK_ROUND_CONSTANTS) {
    const columnParity = new Array(5).fill(0n);
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        columnParity[x] ^= state[x + 5 * y];
      }
    }
    for (let x = 0; x < 5; x += 1) {
      const delta = columnParity[(x + 4) % 5] ^ rotateLeft64(columnParity[(x + 1) % 5], 1);
      for (let y = 0; y < 5; y += 1) {
        state[x + 5 * y] = (state[x + 5 * y] ^ delta) & UINT64_MASK;
      }
    }

    const permuted = new Array(25).fill(0n);
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        const newX = y;
        const newY = (2 * x + 3 * y) % 5;
        const laneIndex = x + 5 * y;
        permuted[newX + 5 * newY] = rotateLeft64(state[laneIndex], KECCAK_ROTATION_OFFSETS[laneIndex]);
      }
    }

    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        const current = permuted[x + 5 * y];
        const next = permuted[(x + 1) % 5 + 5 * y];
        const afterNext = permuted[(x + 2) % 5 + 5 * y];
        state[x + 5 * y] = (current ^ ((~next & UINT64_MASK) & afterNext)) & UINT64_MASK;
      }
    }
    state[0] = (state[0] ^ roundConstant) & UINT64_MASK;
  }
}

function keccak256(bytes) {
  const rateBytes = 136;
  const paddingLength = rateBytes - (bytes.length % rateBytes);
  const padded = Buffer.alloc(bytes.length + paddingLength);
  bytes.copy(padded);
  padded[bytes.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  const state = new Array(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += rateBytes) {
    for (let lane = 0; lane < rateBytes / 8; lane += 1) {
      let value = 0n;
      for (let byteIndex = 0; byteIndex < 8; byteIndex += 1) {
        value |= BigInt(padded[offset + lane * 8 + byteIndex]) << BigInt(byteIndex * 8);
      }
      state[lane] = (state[lane] ^ value) & UINT64_MASK;
    }
    keccakF1600(state);
  }

  const output = Buffer.alloc(32);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number((state[Math.floor(index / 8)] >> BigInt((index % 8) * 8)) & 0xffn);
  }
  return output;
}

function decodeHexBytes(value, location) {
  requireCondition(
    typeof value === "string" && /^0x(?:[0-9a-f]{2})*$/.test(value),
    `${location}: expected lowercase, byte-aligned 0x-prefixed bytes`,
  );
  return Buffer.from(value.slice(2), "hex");
}

function sha256ByteDigest(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function deriveCreate2Address(creatorNativeId, salt, initCode, location) {
  requireCondition(/^0x[0-9a-f]{40}$/.test(creatorNativeId), `${location}: invalid CREATE2 creator address`);
  requireCondition(/^0x[0-9a-f]{64}$/.test(salt), `${location}: invalid CREATE2 salt`);
  const preimage = Buffer.concat([
    Buffer.from([0xff]),
    Buffer.from(creatorNativeId.slice(2), "hex"),
    Buffer.from(salt.slice(2), "hex"),
    keccak256(initCode),
  ]);
  return `0x${keccak256(preimage).subarray(12).toString("hex")}`;
}

function checkKeccakDefense() {
  requireCondition(
    keccak256(Buffer.alloc(0)).toString("hex") ===
      "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    "Keccak-256 self-test failed for the empty message",
  );
  requireCondition(
    deriveCreate2Address(
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      Buffer.from([0]),
      "CREATE2-self-test",
    ) === "0x4d1a2e2bb4f88f0250f26ffff098b0b30b26bf38",
    "CREATE2 address self-test failed",
  );
}

function requireRegularRepositoryFile(relative, kind = "File") {
  const absolutePath = repositoryPath(relative);
  requireCondition(fs.existsSync(absolutePath), `${kind} is missing: ${relative}`);
  const metadata = fs.lstatSync(absolutePath);
  requireCondition(
    metadata.isFile() && !metadata.isSymbolicLink(),
    `${kind} must be a regular repository file, not a directory or symbolic link: ${relative}`,
  );
  return absolutePath;
}

function requireExactStringSet(actual, expected, message) {
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  requireCondition(
    JSON.stringify(sortedActual) === JSON.stringify(sortedExpected),
    `${message}:\nexpected=${sortedExpected.join(",")}\nactual=${sortedActual.join(",")}`,
  );
}

function requirePermittedConformanceProfiles(profiles, constitution, location) {
  const permitted = new Set(constitution.permitted_conformance_profiles);
  for (const profile of profiles) {
    requireCondition(
      permitted.has(profile),
      `${location}: conformance profile is not permitted by the selected Constitution: ${profile}`,
    );
  }
}

function profileClaimMap(claims, idField, location) {
  const claimsById = new Map();
  for (const claim of claims) {
    const profileId = claim[idField];
    requireCondition(
      !claimsById.has(profileId),
      `${location}: duplicate ${idField} ${profileId}`,
    );
    requireCondition(
      claim.conformance.native_vector_set_path !== claim.conformance.native_test_report_path,
      `${location}: ${profileId} uses one path for native vectors and the native test report`,
    );
    claimsById.set(profileId, claim);
  }
  return claimsById;
}

function checkProfileClaimTaxonomy(artifact, artifactPath, constitution) {
  requireCondition(
    artifact.portable_profiles.includes(CORE_PROFILE_ID),
    `${artifactPath}: portable_profiles omits ${CORE_PROFILE_ID}`,
  );
  requirePermittedConformanceProfiles(artifact.portable_profiles, constitution, artifactPath);

  const portableIds = new Set(artifact.portable_profiles);
  const bindingNativeClaims = profileClaimMap(
    artifact.binding_native_profile_claims,
    "profile_id",
    `${artifactPath}.binding_native_profile_claims`,
  );
  const assetClaims = profileClaimMap(
    artifact.asset_profile_claims,
    "asset_profile_id",
    `${artifactPath}.asset_profile_claims`,
  );
  for (const profileId of bindingNativeClaims.keys()) {
    requireCondition(
      !portableIds.has(profileId),
      `${artifactPath}: binding-native profile reuses portable profile ID ${profileId}`,
    );
    requireCondition(
      !assetClaims.has(profileId),
      `${artifactPath}: profile ID appears as both binding-native and Asset Profile: ${profileId}`,
    );
  }
  for (const profileId of assetClaims.keys()) {
    requireCondition(
      !portableIds.has(profileId),
      `${artifactPath}: Asset Profile reuses portable profile ID ${profileId}`,
    );
  }
}

function requireExactProfileClaimSet(actual, expected, idField, message) {
  const actualById = profileClaimMap(actual, idField, `${message}:actual`);
  const expectedById = profileClaimMap(expected, idField, `${message}:expected`);
  requireExactStringSet(actualById.keys(), expectedById.keys(), message);
  for (const [profileId, expectedClaim] of expectedById) {
    requireCondition(
      canonicalize(actualById.get(profileId)) === canonicalize(expectedClaim),
      `${message}: conformance evidence differs for ${profileId}`,
    );
  }
}

function requireExactConformanceClaims(actual, expected, message) {
  requireExactStringSet(actual.portable_profiles, expected.portable_profiles, `${message}: portable profiles differ`);
  requireCondition(
    actual.portable_vector_set_digest === expected.portable_vector_set_digest,
    `${message}: portable vector-set digest differs`,
  );
  requireExactProfileClaimSet(
    actual.binding_native_profile_claims,
    expected.binding_native_profile_claims,
    "profile_id",
    `${message}: binding-native profile claims differ`,
  );
  requireExactProfileClaimSet(
    actual.asset_profile_claims,
    expected.asset_profile_claims,
    "asset_profile_id",
    `${message}: Asset Profile claims differ`,
  );
}

function markdownMetadataValue(source, documentPath, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...source.matchAll(new RegExp(`^- ${escapedLabel}: (.+)$`, "gm"))];
  requireCondition(matches.length === 1, `${documentPath}: expected exactly one '- ${label}:' metadata line`);
  return matches[0][1];
}

function markdownReleaseMetadata(documentPath) {
  const source = readText(documentPath);
  const specIdValue = markdownMetadataValue(source, documentPath, "Spec ID");
  const specIdMatch = /^`([^`]+)`$/.exec(specIdValue);
  requireCondition(Boolean(specIdMatch), `${documentPath}: Spec ID must be one backtick-delimited value`);
  return {
    classification: markdownMetadataValue(source, documentPath, "Classification"),
    specId: specIdMatch[1],
    status: markdownMetadataValue(source, documentPath, "Status"),
  };
}

function checkJsonParserDefense() {
  const rejected = [
    '{"key":"first","key":"second"}',
    '{} trailing-data',
    '{"key":01}',
    '{"key":"\\x"}',
    '{"key":"line\nbreak"}',
  ];
  for (const [index, source] of rejected.entries()) {
    let didReject = false;
    try {
      parseJsonSource(source, `parser-self-test-${index}`);
    } catch (error) {
      didReject = error instanceof CheckFailure;
    }
    requireCondition(didReject, `JSON parser self-test ${index} accepted invalid or duplicate-key input`);
  }

  const prototypeDocument = parseJsonSource('{"__proto__":{"injected":true}}', "parser-prototype-self-test");
  requireCondition(
    Object.prototype.hasOwnProperty.call(prototypeDocument, "__proto__") && prototypeDocument.injected === undefined,
    "JSON parser prototype handling is unsafe",
  );

  for (const [label, value] of [
    ["high", String.fromCharCode(0xd800)],
    ["low", String.fromCharCode(0xdc00)],
  ]) {
    let didReject = false;
    try {
      assertPortableJson(value, `portable-surrogate-self-test-${label}`);
    } catch (error) {
      didReject = error instanceof CheckFailure;
    }
    requireCondition(didReject, `Portable JSON self-test accepted a lone ${label} surrogate`);
  }
  assertPortableJson("valid scalar \u{1f680}", "portable-surrogate-self-test-pair");
}

function listFiles(directory, predicate = () => true) {
  const start = repositoryPath(directory);
  const files = [];
  for (const entry of fs.readdirSync(start, { withFileTypes: true })) {
    const absolutePath = path.join(start, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(relativePath(absolutePath), predicate));
    } else if (entry.isFile() && predicate(absolutePath)) {
      files.push(absolutePath);
    }
  }
  return files.sort((left, right) => relativePath(left).localeCompare(relativePath(right)));
}

function assertPortableJson(value, location) {
  if (typeof value === "number") {
    fail(`${location}: portable hashable documents encode numeric quantities as canonical decimal strings`);
  }
  if (typeof value === "string") {
    for (let index = 0; index < value.length; index += 1) {
      const codeUnit = value.charCodeAt(index);
      if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        requireCondition(
          next >= 0xdc00 && next <= 0xdfff,
          `${location}: string contains a lone high UTF-16 surrogate`,
        );
        index += 1;
      } else {
        requireCondition(
          codeUnit < 0xdc00 || codeUnit > 0xdfff,
          `${location}: string contains a lone low UTF-16 surrogate`,
        );
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPortableJson(item, `${location}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      requireCondition(/^[\x00-\x7f]+$/.test(key), `${location}: object key is not ASCII: ${key}`);
      assertPortableJson(child, `${location}.${key}`);
    }
  }
}

function checkTextFiles() {
  const files = listFiles(".", (absolutePath) => {
    const relative = relativePath(absolutePath);
    return !relative.startsWith(".git/") && !relative.startsWith("node_modules/");
  });

  for (const absolutePath of files) {
    const relative = relativePath(absolutePath);
    const source = fs.readFileSync(absolutePath);
    requireCondition(!source.includes(0), `${relative}: NUL byte is not allowed`);
    const text = source.toString("utf8");
    requireCondition(Buffer.from(text, "utf8").equals(source), `${relative}: file is not valid UTF-8`);
    requireCondition(!text.includes("\r"), `${relative}: CRLF or bare CR line endings are not allowed`);
    requireCondition(text.endsWith("\n"), `${relative}: file must end with one newline`);
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      requireCondition(!/[ \t]+$/.test(line), `${relative}:${index + 1}: trailing whitespace`);
    });
  }

  return files.length;
}

function buildSchemaValidator(schemaPaths) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, ownProperties: true });
  const schemaIds = [];
  for (const schemaPath of schemaPaths) {
    const schema = parseJson(schemaPath);
    requireCondition(typeof schema.$id === "string", `${schemaPath}: schema has no $id`);
    ajv.addSchema(schema, schema.$id);
    schemaIds.push([schemaPath, schema.$id]);
  }
  for (const [schemaPath, schemaId] of schemaIds) {
    requireCondition(Boolean(ajv.getSchema(schemaId)), `${schemaPath}: schema did not compile`);
  }
  return ajv;
}

function validateArtifact(ajv, relative, document) {
  requireCondition(typeof document.$schema === "string", `${relative}: artifact has no $schema`);
  const validate = ajv.getSchema(document.$schema);
  requireCondition(Boolean(validate), `${relative}: unknown schema ${document.$schema}`);
  if (!validate(document)) {
    const detail = ajv.errorsText(validate.errors, { dataVar: relative, separator: "\n" });
    fail(`${relative}: schema validation failed\n${detail}`);
  }
}

function checkReleaseInventory(protocolRelease, schemaPaths) {
  const groups = [
    ["Constitution document", [protocolRelease.constitution_document]],
    ["normative document", protocolRelease.normative_documents],
    ["schema", protocolRelease.schemas],
    ["conformance vector", protocolRelease.conformance_vectors],
  ];
  for (const [kind, entries] of groups) {
    for (const entry of entries) {
      requireRegularRepositoryFile(entry, `Release inventory ${kind}`);
    }
  }

  const normativeDocuments = [];
  const normativeMetadata = new Map();
  for (const directory of ["spec", "bindings"]) {
    for (const absolutePath of listFiles(directory, (file) => file.endsWith(".md"))) {
      const documentPath = relativePath(absolutePath);
      const metadata = markdownReleaseMetadata(documentPath);
      if (/^Normative(?:$| )/.test(metadata.classification)) {
        normativeDocuments.push(documentPath);
        normativeMetadata.set(documentPath, metadata);
      }
    }
  }
  requireExactStringSet(
    protocolRelease.normative_documents,
    normativeDocuments,
    "Release normative document inventory differs from files classified as Normative",
  );
  requireExactStringSet(protocolRelease.schemas, schemaPaths, "Release schema inventory differs from schemas/");

  const actualVectors = listFiles("vectors", (file) => file.endsWith(".json")).map(relativePath);
  requireExactStringSet(
    protocolRelease.conformance_vectors,
    actualVectors,
    "Release vector inventory differs from vectors/",
  );

  const packageDocument = parseJson("package.json");
  requireCondition(
    protocolRelease.protocol_spec_id === `programmable-protocol/${packageDocument.version}`,
    "package.json version and protocol_spec_id differ",
  );
  const activeStatusLabels = { draft: "Draft", candidate: "Candidate", final: "Final" };
  const normativeStatuses = new Set();
  for (const documentPath of protocolRelease.normative_documents) {
    const metadata = normativeMetadata.get(documentPath);
    requireCondition(Boolean(metadata), `${documentPath}: listed normative document is not classified as Normative`);
    requireCondition(
      metadata.specId === protocolRelease.protocol_spec_id,
      `${documentPath}: Spec ID ${metadata.specId} differs from ${protocolRelease.protocol_spec_id}`,
    );
    normativeStatuses.add(metadata.status);
  }
  requireCondition(
    normativeStatuses.size === 1,
    `Normative document statuses differ: ${[...normativeStatuses].sort().join(", ")}`,
  );
  if (activeStatusLabels[protocolRelease.status] !== undefined) {
    requireCondition(
      normativeStatuses.has(activeStatusLabels[protocolRelease.status]),
      `Normative document status differs from active release status ${protocolRelease.status}`,
    );
  }
}

function checkRequirementIds() {
  const definitions = new Map();
  const pattern = /\*\*\[([A-Z]+-[A-Za-z0-9.-]+)\]\*\*/g;
  for (const absolutePath of listFiles(".", (file) => file.endsWith(".md") && !relativePath(file).startsWith("node_modules/"))) {
    const relative = relativePath(absolutePath);
    const source = fs.readFileSync(absolutePath, "utf8");
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const line = source.slice(0, match.index).split("\n").length;
      requireCondition(/^[A-Z]+-[0-9]{3}$/.test(match[1]), `${relative}:${line}: malformed requirement ID ${match[1]}`);
      requireCondition(!definitions.has(match[1]), `${relative}:${line}: duplicate requirement ID ${match[1]}`);
      definitions.set(match[1], `${relative}:${line}`);
    }
  }
  requireCondition(definitions.size > 0, "No normative requirement IDs found");
  return definitions.size;
}

function checkMarkdownLinks() {
  let checked = 0;
  const pattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const absolutePath of listFiles(".", (file) => file.endsWith(".md") && !relativePath(file).startsWith("node_modules/"))) {
    const source = fs.readFileSync(absolutePath, "utf8");
    const sourceRelative = relativePath(absolutePath);
    let match;
    while ((match = pattern.exec(source)) !== null) {
      let target = match[1].trim();
      if (target.startsWith("<") && target.endsWith(">")) {
        target = target.slice(1, -1);
      }
      if (/^(?:https?:|mailto:)/.test(target) || target.startsWith("#")) {
        continue;
      }
      target = target.split("#", 1)[0];
      if (target === "") {
        continue;
      }
      const resolved = path.resolve(path.dirname(absolutePath), decodeURIComponent(target));
      const withinRoot = path.relative(ROOT, resolved);
      requireCondition(
        withinRoot !== ".." && !withinRoot.startsWith(`..${path.sep}`) && !path.isAbsolute(withinRoot),
        `${sourceRelative}: link escapes repository: ${target}`,
      );
      requireCondition(fs.existsSync(resolved), `${sourceRelative}: broken local link: ${target}`);
      checked += 1;
    }
  }
  return checked;
}

function checkPortableLayer() {
  const documents = [
    "spec/01-semantic-model.md",
    "spec/02-execution-and-authority.md",
    "spec/03-protocol-assessment.md",
    "spec/04-evidence-and-discovery.md",
  ];
  for (const documentPath of documents) {
    const source = readText(documentPath);
    for (const token of PORTABLE_RUNTIME_TOKENS) {
      requireCondition(!source.includes(token), `${documentPath}: native runtime token leaked into portable semantics: ${token}`);
    }
  }
}

function constitutionId(document) {
  const hashableDocument = { ...document };
  delete hashableDocument.constitution_id;
  const canonicalDocument = canonicalize(hashableDocument);
  requireCondition(typeof canonicalDocument === "string", "Constitution JCS canonicalization failed");
  const digest = crypto
    .createHash("sha256")
    .update("programmable:constitution:v1", "utf8")
    .update(Buffer.from([0]))
    .update(canonicalDocument, "utf8")
    .digest("hex");
  return `sha256:${digest}`;
}

function checkConstitution(ajv, protocolRelease) {
  const documentPath = protocolRelease.constitution_document;
  requireRegularRepositoryFile(documentPath, "Constitution document");
  const document = parseJson(documentPath);
  assertPortableJson(document, documentPath);
  requireCondition(document.$schema === CONSTITUTION_SCHEMA, `${documentPath}: unexpected Constitution schema`);
  validateArtifact(ajv, documentPath, document);
  requireCondition(
    document.protocol_spec_id === protocolRelease.protocol_spec_id,
    `${documentPath}: Protocol Spec ID differs from release`,
  );
  if (["draft", "candidate", "final"].includes(protocolRelease.status)) {
    requireCondition(
      document.status === protocolRelease.status,
      `${documentPath}: Constitution status differs from active release status ${protocolRelease.status}`,
    );
  }
  const computedId = constitutionId(document);
  requireCondition(
    document.constitution_id === computedId,
    `${documentPath}: Constitution ID expected ${document.constitution_id}, computed ${computedId}`,
  );
  return document;
}

function checkMarketTemplateSchemaVocabulary(protocolRelease, constitution) {
  const schemaPath = "schemas/market-template-v1.schema.json";
  requireCondition(protocolRelease.schemas.includes(schemaPath), `${schemaPath}: missing from release schema inventory`);
  const schema = parseJson(schemaPath);
  const capabilityIds = schema.$defs?.protected_capability_id?.enum;
  const effectIds = schema.$defs?.engine_proposable_protected_effect_id?.enum;
  requireCondition(Array.isArray(capabilityIds), `${schemaPath}: protected capability vocabulary is not an enum`);
  requireCondition(Array.isArray(effectIds), `${schemaPath}: engine-proposable effect vocabulary is not an enum`);
  requireExactStringSet(
    capabilityIds,
    constitution.protected_authority.capability_ids,
    `${schemaPath}: capability vocabulary differs from the Constitution`,
  );
  requireExactStringSet(
    effectIds,
    constitution.protected_authority.engine_proposable_effect_ids,
    `${schemaPath}: engine-proposable effect vocabulary differs from the Constitution`,
  );
}

function requireUniqueMemberIds(documentPath, entries, memberName) {
  const seen = new Set();
  for (const entry of entries) {
    requireCondition(
      !seen.has(entry[memberName]),
      `${documentPath}: duplicate ${memberName} ${entry[memberName]}`,
    );
    seen.add(entry[memberName]);
  }
}

function forEachEvidenceReference(value, callback, location) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => forEachEvidenceReference(entry, callback, `${location}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "evidence_refs") {
      child.forEach((evidenceId, index) => callback(evidenceId, `${location}.${key}[${index}]`));
    } else {
      forEachEvidenceReference(child, callback, `${location}.${key}`);
    }
  }
}

function checkDeploymentManifestSemantics(document, documentPath, constitution) {
  requireCondition(
    document.core.constitution_id === constitution.constitution_id,
    `${documentPath}: Core Constitution ID differs from the selected release`,
  );
  checkProfileClaimTaxonomy(document, documentPath, constitution);

  const evidenceIds = new Set();
  for (const evidence of document.evidence_catalog) {
    requireCondition(
      !evidenceIds.has(evidence.evidence_id),
      `${documentPath}: duplicate evidence ID ${evidence.evidence_id}`,
    );
    evidenceIds.add(evidence.evidence_id);
  }
  forEachEvidenceReference(
    document,
    (evidenceId, location) => {
      requireCondition(evidenceIds.has(evidenceId), `${location}: unresolved evidence reference ${evidenceId}`);
    },
    documentPath,
  );

  const dependencyIds = new Set();
  for (const dependency of document.runtime_evidence.dependencies) {
    requireCondition(
      !dependencyIds.has(dependency.dependency_id),
      `${documentPath}: duplicate dependency ID ${dependency.dependency_id}`,
    );
    dependencyIds.add(dependency.dependency_id);
  }

  if (document.runtime_family === "EVM") {
    requireCondition(document.network.namespace === "eip155", `${documentPath}: EVM network namespace must be eip155`);
    requireCondition(
      document.network.reference === document.runtime_evidence.chain_id,
      `${documentPath}: EVM network reference differs from runtime chain ID`,
    );
    requireCondition(
      document.core.runtime_code_digest === document.runtime_evidence.artifact.runtime_bytecode_digest,
      `${documentPath}: Core runtime-code digest differs from EVM artifact evidence`,
    );
    requireCondition(
      document.core.artifact_digest === document.runtime_evidence.artifact.creation_bytecode_digest,
      `${documentPath}: Core artifact digest differs from EVM creation-bytecode evidence`,
    );

    const initialization = document.runtime_evidence.initialization;
    const creation = document.runtime_evidence.creation;
    const initCode = decodeHexBytes(initialization.creation_input, `${documentPath}.runtime_evidence.initialization.creation_input`);
    const constructorArguments = decodeHexBytes(
      initialization.constructor_arguments,
      `${documentPath}.runtime_evidence.initialization.constructor_arguments`,
    );
    requireCondition(
      constructorArguments.length <= initCode.length &&
        initCode.subarray(initCode.length - constructorArguments.length).equals(constructorArguments),
      `${documentPath}: constructor arguments are not the exact suffix of the creation input`,
    );
    const creationBytecode = initCode.subarray(0, initCode.length - constructorArguments.length);
    const computedInitCodeDigest = sha256ByteDigest(initCode);
    requireCondition(
      computedInitCodeDigest === creation.init_code_digest,
      `${documentPath}: CREATE/CREATE2 init-code digest differs from the creation input`,
    );
    requireCondition(
      computedInitCodeDigest === document.runtime_evidence.artifact.init_code_digest,
      `${documentPath}: artifact init-code digest differs from the creation input`,
    );
    requireCondition(
      sha256ByteDigest(creationBytecode) === document.runtime_evidence.artifact.creation_bytecode_digest,
      `${documentPath}: creation-bytecode digest differs from creation input minus constructor arguments`,
    );
    requireCondition(
      creation.derived_native_id === document.core.native_id,
      `${documentPath}: derived EVM native ID differs from the Core native ID`,
    );
    if (creation.mechanism === "CREATE2") {
      requireCondition(creation.salt !== null, `${documentPath}: CREATE2 requires a salt`);
      requireCondition(
        deriveCreate2Address(creation.creator_native_id, creation.salt, initCode, documentPath) ===
          creation.derived_native_id,
        `${documentPath}: CREATE2 derivation does not produce the claimed native ID`,
      );
    } else {
      requireCondition(creation.salt === null, `${documentPath}: CREATE must not carry a CREATE2 salt`);
    }
    return;
  }

  requireCondition(document.network.namespace === "solana", `${documentPath}: SVM network namespace must be solana`);
  requireCondition(
    document.network.genesis_or_anchor === document.runtime_evidence.genesis_hash,
    `${documentPath}: SVM network anchor differs from runtime genesis hash`,
  );
  requireCondition(
    document.core.native_id === document.runtime_evidence.program_id,
    `${documentPath}: Core native ID differs from the SVM Program ID`,
  );
  requireCondition(
    document.core.artifact_digest === document.runtime_evidence.artifact.elf_digest,
    `${documentPath}: Core artifact digest differs from SVM ELF evidence`,
  );
  requireCondition(
    document.core.runtime_code_digest === undefined,
    `${documentPath}: SVM Core must not claim an EVM-style runtime-code digest`,
  );
  if (document.runtime_evidence.initialization.mode === "instructions") {
    for (const step of document.runtime_evidence.initialization.steps) {
      requireCondition(
        step.program_id === document.core.native_id,
        `${documentPath}: initialization step targets a different Program ID`,
      );
    }
  }
  if (document.runtime_evidence.immutable_state.mode === "accounts") {
    const accountIds = new Set();
    for (const account of document.runtime_evidence.immutable_state.accounts) {
      requireCondition(!accountIds.has(account.account_id), `${documentPath}: duplicate immutable-state account ID`);
      accountIds.add(account.account_id);
      requireCondition(
        account.owner_program_id === document.core.native_id,
        `${documentPath}: immutable-state account is not owned by the Core Program ID`,
      );
    }
  }
}

function loadAndCheckExamples(ajv, protocolRelease, constitution) {
  const fixturePaths = listFiles("examples", (file) => file.endsWith(".json")).map(relativePath);
  const marketTemplates = new Map();
  const deploymentManifests = new Map();
  for (const fixturePath of fixturePaths) {
    const document = parseJson(fixturePath);
    assertPortableJson(document, fixturePath);
    validateArtifact(ajv, fixturePath, document);
    if (document.protocol_spec_id !== undefined) {
      requireCondition(
        document.protocol_spec_id === protocolRelease.protocol_spec_id,
        `${fixturePath}: Protocol Spec ID differs from release`,
      );
    }
    if (document.$schema === MARKET_TEMPLATE_SCHEMA) {
      requireUniqueMemberIds(fixturePath, document.asset_roles, "role_id");
      requireUniqueMemberIds(fixturePath, document.actions, "action_id");
      marketTemplates.set(fixturePath, document);
    } else if (document.$schema === DEPLOYMENT_MANIFEST_SCHEMA) {
      checkDeploymentManifestSemantics(document, fixturePath, constitution);
      deploymentManifests.set(fixturePath, document);
    }
  }
  requireCondition(marketTemplates.size > 0, "No market-template examples found");
  return { deploymentManifests, fixtureCount: fixturePaths.length, marketTemplates };
}

function checkDeploymentManifests(ajv, repositoryJsonDocuments, constitution) {
  const deploymentManifests = new Map();
  for (const [manifestPath, manifest] of documentsWithSchema(repositoryJsonDocuments, DEPLOYMENT_MANIFEST_SCHEMA)) {
    assertPortableJson(manifest, manifestPath);
    validateArtifact(ajv, manifestPath, manifest);
    checkDeploymentManifestSemantics(manifest, manifestPath, constitution);
    deploymentManifests.set(manifestPath, manifest);
  }
  return deploymentManifests;
}

function marketTemplateId(document) {
  const canonicalDocument = canonicalize(document);
  requireCondition(typeof canonicalDocument === "string", "JCS canonicalization failed");
  const digest = crypto
    .createHash("sha256")
    .update("programmable:market-template:v1", "utf8")
    .update(Buffer.from([0]))
    .update(canonicalDocument, "utf8")
    .digest("hex");
  return `sha256:${digest}`;
}

function authorizationScopeId(descriptor, location) {
  assertPortableJson(descriptor, location);
  const canonicalDescriptor = canonicalize(descriptor);
  requireCondition(typeof canonicalDescriptor === "string", `${location}: Scope Descriptor JCS canonicalization failed`);
  const digest = crypto
    .createHash("sha256")
    .update("programmable:authorization-scope:v1", "utf8")
    .update(ZERO_BYTE)
    .update(canonicalDescriptor, "utf8")
    .digest("hex");
  return `sha256:${digest}`;
}

function checkAuthenticatedPrincipalEvidence(document, constitution) {
  const evidenceByReference = new Map();
  for (const [index, evidence] of document.authenticated_principal_evidence.entries()) {
    const location = `vectors/protocol-assessment-v1.json.authenticated_principal_evidence[${index}]`;
    requireCondition(
      !evidenceByReference.has(evidence.authorization_evidence_ref),
      `${location}: duplicate authorization evidence reference ${evidence.authorization_evidence_ref}`,
    );
    const descriptor = evidence.scope_descriptor;
    const computedScopeId = authorizationScopeId(descriptor, `${location}.scope_descriptor`);
    requireCondition(
      computedScopeId === evidence.authorization_scope_id,
      `${location}: authorization_scope_id expected ${evidence.authorization_scope_id}, computed ${computedScopeId}`,
    );
    requireCondition(
      descriptor.protocol_spec_id === document.protocol_spec_id,
      `${location}: sponsor Scope Descriptor Protocol Spec ID differs from assessment vectors`,
    );
    requireCondition(
      descriptor.constitution_id === constitution.constitution_id,
      `${location}: sponsor Scope Descriptor Constitution ID differs from release`,
    );
    requireCondition(
      descriptor.principal_id === evidence.principal_id,
      `${location}: authenticated Principal differs from sponsor Scope Descriptor`,
    );
    requireCondition(
      descriptor.authorization_profile_id === evidence.authorization_profile_id,
      `${location}: authenticated profile differs from sponsor Scope Descriptor`,
    );

    const assetAuthorizations = new Map();
    for (const assetAuthorization of descriptor.asset_authorizations) {
      const assetTuple = `${assetAuthorization.asset_profile_id}\u0000${assetAuthorization.native_asset_id}`;
      requireCondition(!assetAuthorizations.has(assetTuple), `${location}: duplicate sponsor asset authorization tuple`);
      assetAuthorizations.set(assetTuple, assetAuthorization);
    }
    const sponsoredTuples = new Set();
    for (const authorization of descriptor.sponsored_assessment_authorizations ?? []) {
      const assetTuple = `${authorization.asset_profile_id}\u0000${authorization.native_asset_id}`;
      const sponsoredTuple = `${authorization.assessment_authorization_scope_id}\u0000${assetTuple}`;
      requireCondition(!sponsoredTuples.has(sponsoredTuple), `${location}: duplicate sponsored-assessment tuple`);
      sponsoredTuples.add(sponsoredTuple);
      const assetAuthorization = assetAuthorizations.get(assetTuple);
      requireCondition(Boolean(assetAuthorization), `${location}: sponsored asset tuple has no sponsor asset authorization`);
      const sponsoredMaximum = BigInt(authorization.maximum_gross_assessment_debit);
      requireCondition(
        sponsoredMaximum <= BigInt(assetAuthorization.max_protocol_assessment_gross_debit) &&
          sponsoredMaximum <= BigInt(assetAuthorization.max_total_gross_debit),
        `${location}: sponsored maximum exceeds sponsor asset authorization`,
      );
    }
    evidenceByReference.set(evidence.authorization_evidence_ref, evidence);
  }
  return evidenceByReference;
}

function jsonArtifactDigest(document, location) {
  assertPortableJson(document, location);
  requireCondition(typeof document.$schema === "string", `${location}: artifact has no $schema`);
  const canonicalDocument = canonicalize(document);
  requireCondition(typeof canonicalDocument === "string", `${location}: JCS canonicalization failed`);
  const digest = crypto
    .createHash("sha256")
    .update("programmable:json-artifact:v1", "utf8")
    .update(ZERO_BYTE)
    .update(document.$schema, "utf8")
    .update(ZERO_BYTE)
    .update(canonicalDocument, "utf8")
    .digest("hex");
  return `sha256:${digest}`;
}

function vectorSetDigest(records) {
  const manifest = [...records].sort((left, right) => {
    if (left.path < right.path) return -1;
    if (left.path > right.path) return 1;
    return 0;
  });
  const canonicalManifest = canonicalize(manifest);
  requireCondition(typeof canonicalManifest === "string", "Vector-set manifest JCS canonicalization failed");
  const digest = crypto
    .createHash("sha256")
    .update("programmable:vector-set:v1", "utf8")
    .update(ZERO_BYTE)
    .update(canonicalManifest, "utf8")
    .digest("hex");
  return `sha256:${digest}`;
}

function readGitFileAtCommit(commit, filePath, location) {
  requireCondition(/^[0-9a-f]{40}$/.test(commit), `${location}: invalid Git commit`);
  requireCondition(
    /^(?!(?:\.{1,2})(?:\/|$))[A-Za-z0-9._-]+(?:\/(?!(?:\.{1,2})(?:\/|$))[A-Za-z0-9._-]+)*$/.test(filePath),
    `${location}: invalid repository path ${filePath}`,
  );
  try {
    return execFileSync("git", ["show", `${commit}:${filePath}`], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    fail(`${location}: Git commit ${commit} does not contain ${filePath}`);
  }
}

function protocolStateAtCommit(ajv, commit, location) {
  if (PROTOCOL_COMMIT_CACHE.has(commit)) {
    return PROTOCOL_COMMIT_CACHE.get(commit);
  }
  try {
    execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], {
      cwd: ROOT,
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    fail(`${location}: protocol_commit ${commit} is not a commit object in this Protocol repository`);
  }

  const releasePath = "protocol-version.json";
  const release = parseJsonSource(readGitFileAtCommit(commit, releasePath, location), `${commit}:${releasePath}`);
  assertPortableJson(release, `${commit}:${releasePath}`);
  requireCondition(
    release.$schema === PROTOCOL_RELEASE_SCHEMA,
    `${location}: pinned protocol-version.json has an unexpected schema identifier`,
  );
  validateArtifact(ajv, `${commit}:${releasePath}`, release);
  requireCondition(
    typeof release.protocol_spec_id === "string" && Array.isArray(release.conformance_vectors),
    `${location}: pinned protocol-version.json does not define a Protocol Spec ID and vector inventory`,
  );
  const vectorRecords = release.conformance_vectors.map((vectorPath) => {
    const vector = parseJsonSource(readGitFileAtCommit(commit, vectorPath, location), `${commit}:${vectorPath}`);
    assertPortableJson(vector, `${commit}:${vectorPath}`);
    requireCondition(typeof vector.$schema === "string", `${location}: pinned vector ${vectorPath} has no $schema`);
    return {
      artifact_digest: jsonArtifactDigest(vector, `${commit}:${vectorPath}`),
      path: vectorPath,
      schema_id: vector.$schema,
    };
  });

  requireCondition(
    typeof release.constitution_document === "string",
    `${location}: pinned protocol-version.json has no Constitution document`,
  );
  const pinnedConstitution = parseJsonSource(
    readGitFileAtCommit(commit, release.constitution_document, location),
    `${commit}:${release.constitution_document}`,
  );
  assertPortableJson(pinnedConstitution, `${commit}:${release.constitution_document}`);
  const computedConstitutionId = constitutionId(pinnedConstitution);
  requireCondition(
    pinnedConstitution.constitution_id === computedConstitutionId,
    `${location}: pinned Constitution embeds an invalid Constitution ID`,
  );
  const state = {
    constitutionId: computedConstitutionId,
    productionEligible: release.production_eligible,
    protocolSpecId: release.protocol_spec_id,
    status: release.status,
    vectorSetDigest: vectorSetDigest(vectorRecords),
  };
  PROTOCOL_COMMIT_CACHE.set(commit, state);
  return state;
}

function checkProtocolCommitPin(ajv, artifact, artifactPath) {
  const state = protocolStateAtCommit(ajv, artifact.protocol_commit, artifactPath);
  requireCondition(
    artifact.protocol_spec_id === state.protocolSpecId,
    `${artifactPath}: Protocol Spec ID differs from protocol_commit state`,
  );
  requireCondition(
    artifact.constitution_id === state.constitutionId,
    `${artifactPath}: Constitution ID differs from protocol_commit state`,
  );
  requireCondition(
    artifact.portable_vector_set_digest === state.vectorSetDigest,
    `${artifactPath}: portable_vector_set_digest differs from protocol_commit state`,
  );
  return state;
}

function checkIdentifierVectors(document, marketTemplates) {
  const caseIds = new Set();
  const documentPaths = new Set();
  for (const vector of document.cases) {
    requireCondition(!caseIds.has(vector.case_id), `Duplicate identifier case ID: ${vector.case_id}`);
    caseIds.add(vector.case_id);
    requireCondition(!documentPaths.has(vector.document_path), `Duplicate identifier document path: ${vector.document_path}`);
    documentPaths.add(vector.document_path);
    const template = marketTemplates.get(vector.document_path);
    requireCondition(Boolean(template), `${vector.case_id}: document_path is not a validated market-template example`);
    const actual = marketTemplateId(template);
    requireCondition(actual === vector.expected_id, `${vector.case_id}: expected ${vector.expected_id}, got ${actual}`);
  }
  requireExactStringSet(
    documentPaths,
    marketTemplates.keys(),
    "Identifier vector coverage differs from market-template examples",
  );
  return {
    total: caseIds.size,
    cases: document.cases.map((vector) => ({
      caseId: vector.case_id,
      requiredProfiles: [CORE_PROFILE_ID],
    })),
  };
}

function conformance(condition, code, message) {
  if (!condition) {
    throw new ConformanceError(code, message);
  }
}

function decimal(value, location) {
  conformance(typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value), "invalid_decimal", `${location}: invalid decimal`);
  const parsed = BigInt(value);
  conformance(parsed <= MAX_U128, "arithmetic_overflow", `${location}: exceeds unsigned 128-bit domain`);
  return parsed;
}

function checkedAdd(left, right, location) {
  const result = left + right;
  conformance(result <= MAX_U128, "arithmetic_overflow", `${location}: unsigned 128-bit addition overflow`);
  return result;
}

function scopeIdentity(groupKey) {
  return canonicalize({
    core_deployment_id: groupKey.core_deployment_id,
    constitution_id: groupKey.constitution_id,
    authorization_scope_id: groupKey.authorization_scope_id,
  });
}

function compareExpected(caseId, groupIndex, fillIndex, expected, actual) {
  conformance(Boolean(expected), "missing_expected_result", `${caseId} group ${groupIndex} fill ${fillIndex}: expected result is missing`);
  for (const [field, value] of Object.entries(actual)) {
    const expectedValue = typeof value === "bigint" ? expected[field] : expected[field];
    const actualValue = typeof value === "bigint" ? value.toString() : value;
    conformance(
      expectedValue === actualValue,
      "unexpected_result",
      `${caseId} group ${groupIndex} fill ${fillIndex}: ${field} expected ${expectedValue}, got ${actualValue}`,
    );
  }
}

function evaluateAssessmentCase(testCase, authenticatedPrincipalEvidence) {
  const groupKeys = new Set();
  const scopes = new Map();
  const sponsorUsage = new Map();

  for (const [groupIndex, group] of testCase.groups.entries()) {
    const serializedGroupKey = canonicalize(group.group_key);
    conformance(!groupKeys.has(serializedGroupKey), "duplicate_group_key", `${testCase.case_id}: duplicate canonical group key`);
    groupKeys.add(serializedGroupKey);

    const scopeKey = scopeIdentity(group.group_key);
    if (!scopes.has(scopeKey)) {
      scopes.set(scopeKey, {
        assessmentPrincipalId: group.group_key.assessment_principal_id,
        debitIds: new Set(),
        refundIds: new Set(),
      });
    }
    const scope = scopes.get(scopeKey);
    conformance(
      scope.assessmentPrincipalId === group.group_key.assessment_principal_id,
      "scope_principal_mismatch",
      `${testCase.case_id}: one Authorization Scope cannot bind multiple assessment Principals`,
    );
    const groupOriginIds = new Set();
    let basis = decimal(group.basis_before, `${testCase.case_id}.groups[${groupIndex}].basis_before`);
    const initialAssessment = basis / ASSESSMENT_DENOMINATOR;
    if (group.stored_assessment !== undefined) {
      const stored = decimal(group.stored_assessment, `${testCase.case_id}.groups[${groupIndex}].stored_assessment`);
      conformance(stored === initialAssessment, "stored_assessment_mismatch", `${testCase.case_id}: stored assessment does not match cumulative basis`);
    }

    let previousFillSequence = null;
    for (const [fillIndex, fill] of group.fills.entries()) {
      const fillSequence = decimal(fill.fill_sequence, `${testCase.case_id}.groups[${groupIndex}].fills[${fillIndex}].fill_sequence`);
      conformance(
        previousFillSequence === null || fillSequence > previousFillSequence,
        "non_increasing_fill_sequence",
        `${testCase.case_id}: fill sequence must increase strictly`,
      );
      previousFillSequence = fillSequence;

      const origins = new Map();
      const refundedByOrigin = new Map();
      let applicableGrossDebit = 0n;
      let applicableDebitCount = 0;
      for (const [debitIndex, debit] of fill.debits.entries()) {
        conformance(!scope.debitIds.has(debit.debit_id), "duplicate_debit_id", `${testCase.case_id}: duplicate debit ID ${debit.debit_id}`);
        scope.debitIds.add(debit.debit_id);
        const amount = decimal(debit.amount, `${testCase.case_id}.groups[${groupIndex}].fills[${fillIndex}].debits[${debitIndex}].amount`);
        origins.set(debit.debit_id, { amount, classification: debit.classification });
        groupOriginIds.add(debit.debit_id);
        if (debit.classification === "applicable") {
          applicableGrossDebit = checkedAdd(applicableGrossDebit, amount, `${testCase.case_id}: applicable debit sum`);
          applicableDebitCount += 1;
        }
      }

      let applicableRefund = 0n;
      for (const [refundIndex, refund] of fill.refunds.entries()) {
        conformance(!scope.refundIds.has(refund.refund_id), "duplicate_refund_id", `${testCase.case_id}: duplicate refund ID ${refund.refund_id}`);
        scope.refundIds.add(refund.refund_id);
        conformance(
          refund.proof === "segregated_unused_origin" || refund.proof === "exact_pre_use_reversal",
          "invalid_refund_proof",
          `${testCase.case_id}: refund proof is not admissible`,
        );
        const origin = origins.get(refund.origin_debit_id);
        if (!origin) {
          const code = groupOriginIds.has(refund.origin_debit_id) ? "refund_origin_not_current_fill" : "unknown_refund_origin";
          throw new ConformanceError(code, `${testCase.case_id}: ineligible refund origin ${refund.origin_debit_id}`);
        }
        const amount = decimal(refund.amount, `${testCase.case_id}.groups[${groupIndex}].fills[${fillIndex}].refunds[${refundIndex}].amount`);
        const alreadyRefunded = refundedByOrigin.get(refund.origin_debit_id) ?? 0n;
        const totalRefunded = checkedAdd(alreadyRefunded, amount, `${testCase.case_id}: refund sum`);
        conformance(totalRefunded <= origin.amount, "refund_exceeds_origin", `${testCase.case_id}: refund exceeds origin debit`);
        refundedByOrigin.set(refund.origin_debit_id, totalRefunded);
        if (origin.classification === "applicable") {
          applicableRefund = checkedAdd(applicableRefund, amount, `${testCase.case_id}: applicable refund sum`);
        }
      }

      conformance(applicableRefund <= applicableGrossDebit, "negative_fill_basis", `${testCase.case_id}: refund would make fill basis negative`);
      const fillBasis = applicableGrossDebit - applicableRefund;
      const basisBefore = basis;
      const assessmentBefore = basisBefore / ASSESSMENT_DENOMINATOR;
      const basisAfter = checkedAdd(basisBefore, fillBasis, `${testCase.case_id}: cumulative basis`);
      const assessmentAfter = basisAfter / ASSESSMENT_DENOMINATOR;
      const assessmentDelta = assessmentAfter - assessmentBefore;
      const withholding = decimal(fill.protocol_withholding, `${testCase.case_id}.groups[${groupIndex}].fills[${fillIndex}].protocol_withholding`);

      if (fill.fee_funding_principal_id !== undefined) {
        conformance(
          testCase.required_profiles.includes("sponsored-assessment-v1"),
          "sponsor_profile_not_applicable",
          `${testCase.case_id}: sponsored funding requires sponsored-assessment-v1`,
        );
        conformance(
          fill.fee_funding_principal_id !== group.group_key.assessment_principal_id,
          "sponsor_principal_not_separate",
          `${testCase.case_id}: sponsored funding must name a separate fee-funding Principal`,
        );
        const evidence = authenticatedPrincipalEvidence.get(fill.fee_funding_authorization_evidence_ref);
        conformance(
          Boolean(evidence),
          "sponsor_authorization_evidence_missing",
          `${testCase.case_id}: fee-funding authorization evidence reference is unknown`,
        );
        conformance(
          evidence.authorization_scope_id === fill.fee_funding_scope_id,
          "sponsor_scope_evidence_mismatch",
          `${testCase.case_id}: fee-funding Scope ID differs from authenticated evidence`,
        );
        conformance(
          evidence.principal_id === fill.fee_funding_principal_id,
          "sponsor_principal_evidence_mismatch",
          `${testCase.case_id}: fee-funding Principal differs from authenticated evidence`,
        );
        const descriptor = evidence.scope_descriptor;
        conformance(
          descriptor.core_deployment_id === group.group_key.core_deployment_id &&
            descriptor.constitution_id === group.group_key.constitution_id,
          "sponsor_scope_context_mismatch",
          `${testCase.case_id}: sponsor Scope Descriptor binds another Core or Constitution`,
        );
        const scopeAuthorizations = (descriptor.sponsored_assessment_authorizations ?? []).filter(
          (authorization) =>
            authorization.assessment_authorization_scope_id === group.group_key.authorization_scope_id,
        );
        conformance(
          scopeAuthorizations.length > 0,
          "sponsor_scope_mismatch",
          `${testCase.case_id}: sponsor Scope Descriptor authorizes another assessment Scope`,
        );
        const matchingAuthorizations = scopeAuthorizations.filter(
          (authorization) =>
            authorization.assessment_principal_id === group.group_key.assessment_principal_id &&
            authorization.asset_profile_id === group.group_key.asset_profile_id &&
            authorization.native_asset_id === group.group_key.native_asset_id &&
            authorization.protocol_collector_id === group.protocol_collector_id,
        );
        conformance(
          matchingAuthorizations.length === 1,
          "sponsor_authorization_mismatch",
          `${testCase.case_id}: sponsor Scope Descriptor tuple differs from the assessment group or Collector`,
        );
        const authorization = matchingAuthorizations[0];
        const sponsorMaximum = decimal(
          authorization.maximum_gross_assessment_debit,
          `${testCase.case_id}.groups[${groupIndex}].fills[${fillIndex}].maximum_gross_assessment_debit`,
        );
        const sponsorKey = canonicalize({
          fee_funding_principal_id: evidence.principal_id,
          fee_funding_scope_id: evidence.authorization_scope_id,
          assessment_authorization_scope_id: authorization.assessment_authorization_scope_id,
          assessment_principal_id: authorization.assessment_principal_id,
          asset_profile_id: authorization.asset_profile_id,
          native_asset_id: authorization.native_asset_id,
          protocol_collector_id: authorization.protocol_collector_id,
        });
        const priorSponsorState = sponsorUsage.get(sponsorKey);
        conformance(
          priorSponsorState === undefined || priorSponsorState.maximum === sponsorMaximum,
          "sponsor_authorization_inconsistent",
          `${testCase.case_id}: one sponsor Scope tuple carries inconsistent ceilings`,
        );
        const usedBefore = priorSponsorState?.used ?? 0n;
        const usedAfter = checkedAdd(usedBefore, assessmentDelta, `${testCase.case_id}: cumulative sponsor assessment`);
        conformance(
          usedAfter <= sponsorMaximum,
          "sponsor_assessment_ceiling_exceeded",
          `${testCase.case_id}: cumulative sponsored assessment exceeds its exact ceiling`,
        );
        sponsorUsage.set(sponsorKey, { maximum: sponsorMaximum, used: usedAfter });
      }

      if (fill.assessment_ceiling !== undefined) {
        const ceiling = decimal(fill.assessment_ceiling, `${testCase.case_id}.groups[${groupIndex}].fills[${fillIndex}].assessment_ceiling`);
        conformance(assessmentDelta <= ceiling, "assessment_ceiling_exceeded", `${testCase.case_id}: assessment exceeds signed ceiling`);
      }
      conformance(withholding <= assessmentDelta, "withholding_exceeds_assessment", `${testCase.case_id}: withholding exceeds gross assessment debit`);
      const fundedCredit = assessmentDelta - withholding;
      conformance(assessmentDelta === 0n || fundedCredit > 0n, "zero_funded_credit", `${testCase.case_id}: positive assessment produced zero funded credit`);
      conformance(!fill.force_postcondition_failure, "postcondition_failure", `${testCase.case_id}: forced postcondition failure`);

      if (testCase.expected_status === "accept") {
        compareExpected(testCase.case_id, groupIndex, fillIndex, fill.expected, {
          basis_before: basisBefore,
          fill_basis: fillBasis,
          basis_after: basisAfter,
          assessment_before: assessmentBefore,
          assessment_delta: assessmentDelta,
          assessment_after: assessmentAfter,
          remainder_before: basisBefore % ASSESSMENT_DENOMINATOR,
          remainder_after: basisAfter % ASSESSMENT_DENOMINATOR,
          emit_assessment_record: applicableDebitCount > 0,
          gross_assessment_debit: assessmentDelta,
          funded_credit: fundedCredit,
          liability_delta: fundedCredit,
        });
      }
      basis = basisAfter;
    }
  }
}

function checkAssessmentVectors(document, constitution) {
  const assessmentProfile = document.assessment_profile;
  requireCondition(
    assessmentProfile.constitution_id === constitution.constitution_id,
    "Assessment vector profile Constitution ID differs from the release Constitution",
  );
  for (const field of [
    "assessment_id",
    "basis_id",
    "exclusion_set_id",
    "rate_numerator",
    "rate_denominator",
    "arithmetic_bits",
    "rounding",
    "collector_policy",
  ]) {
    requireCondition(
      assessmentProfile[field] === constitution.protocol_assessment[field],
      `Assessment vector ${field} differs from the Constitution`,
    );
  }
  const rateNumerator = BigInt(assessmentProfile.rate_numerator);
  const rateDenominator = BigInt(assessmentProfile.rate_denominator);
  let divisorLeft = rateNumerator;
  let divisorRight = rateDenominator;
  while (divisorRight !== 0n) {
    [divisorLeft, divisorRight] = [divisorRight, divisorLeft % divisorRight];
  }
  const computedReducedDenominator = rateDenominator / divisorLeft;
  requireCondition(
    assessmentProfile.reduced_denominator === computedReducedDenominator.toString(),
    "Assessment vector reduced denominator does not match its declared rate",
  );
  requireCondition(
    computedReducedDenominator === ASSESSMENT_DENOMINATOR,
    "Assessment vector reduced denominator differs from evaluator arithmetic",
  );
  const authenticatedPrincipalEvidence = checkAuthenticatedPrincipalEvidence(document, constitution);

  const caseIds = new Set();
  let accepted = 0;
  let rejected = 0;
  for (const testCase of document.cases) {
    requireCondition(!caseIds.has(testCase.case_id), `Duplicate assessment case ID: ${testCase.case_id}`);
    caseIds.add(testCase.case_id);
    requireCondition(
      testCase.required_profiles.includes(CORE_PROFILE_ID),
      `${testCase.case_id}: required_profiles omits ${CORE_PROFILE_ID}`,
    );
    for (const group of testCase.groups) {
      requireCondition(
        group.group_key.constitution_id === constitution.constitution_id,
        `${testCase.case_id}: group Constitution ID differs from the release Constitution`,
      );
    }
    try {
      evaluateAssessmentCase(testCase, authenticatedPrincipalEvidence);
      if (testCase.expected_status === "reject") {
        fail(`${testCase.case_id}: expected rejection ${testCase.expected_error}, but evaluation accepted`);
      }
      accepted += 1;
    } catch (error) {
      if (!(error instanceof ConformanceError)) {
        throw error;
      }
      if (testCase.expected_status !== "reject") {
        fail(`${testCase.case_id}: unexpected ${error.code}: ${error.message}`);
      }
      requireCondition(
        error.code === testCase.expected_error,
        `${testCase.case_id}: expected rejection ${testCase.expected_error}, got ${error.code}: ${error.message}`,
      );
      rejected += 1;
    }
  }
  return {
    total: caseIds.size,
    accepted,
    rejected,
    cases: document.cases.map((testCase) => ({
      caseId: testCase.case_id,
      requiredProfiles: [...testCase.required_profiles],
    })),
  };
}

function addCasesToCatalog(catalog, vectorPath, cases) {
  for (const entry of cases) {
    requireCondition(!catalog.has(entry.caseId), `Duplicate conformance case ID ${entry.caseId} in ${vectorPath}`);
    catalog.set(entry.caseId, {
      requiredProfiles: [...entry.requiredProfiles],
      vectorPath,
    });
  }
}

function checkListedVectors(ajv, protocolRelease, constitution, marketTemplates) {
  const caseCatalog = new Map();
  const handledSchemaPaths = new Map();
  const vectorArtifactRecords = [];
  let identifierCases = null;
  let assessmentCases = null;

  for (const vectorPath of protocolRelease.conformance_vectors) {
    requireRegularRepositoryFile(vectorPath, "Listed conformance vector");
    const document = parseJson(vectorPath);
    assertPortableJson(document, vectorPath);
    validateArtifact(ajv, vectorPath, document);
    requireCondition(
      document.protocol_spec_id === protocolRelease.protocol_spec_id,
      `${vectorPath}: Protocol Spec ID differs from release`,
    );
    requireCondition(
      !handledSchemaPaths.has(document.$schema),
      `${vectorPath}: duplicate vector schema dispatch ${document.$schema}; already handled by ${handledSchemaPaths.get(document.$schema)}`,
    );
    vectorArtifactRecords.push({
      artifact_digest: jsonArtifactDigest(document, vectorPath),
      path: vectorPath,
      schema_id: document.$schema,
    });

    let result;
    if (document.$schema === IDENTIFIER_VECTOR_SCHEMA) {
      result = checkIdentifierVectors(document, marketTemplates);
      identifierCases = result;
    } else if (document.$schema === ASSESSMENT_VECTOR_SCHEMA) {
      result = checkAssessmentVectors(document, constitution);
      assessmentCases = result;
    } else {
      const semanticValidator = SEMANTIC_VECTOR_VALIDATORS[document.$schema];
      requireCondition(
        Boolean(semanticValidator),
        `${vectorPath}: listed vector schema has no registered semantic validator: ${document.$schema}`,
      );
      result = semanticValidator(document);
    }
    for (const entry of result.cases) {
      requirePermittedConformanceProfiles(entry.requiredProfiles, constitution, `${vectorPath}:${entry.caseId}`);
    }
    handledSchemaPaths.set(document.$schema, vectorPath);
    addCasesToCatalog(caseCatalog, vectorPath, result.cases);
  }

  for (const requiredSchema of [
    IDENTIFIER_VECTOR_SCHEMA,
    ASSESSMENT_VECTOR_SCHEMA,
    ...Object.keys(SEMANTIC_VECTOR_VALIDATORS),
  ]) {
    requireCondition(
      handledSchemaPaths.has(requiredSchema),
      `Release vector inventory is missing required vector schema ${requiredSchema}`,
    );
  }
  return {
    assessmentCases,
    caseCatalog,
    identifierCases,
    semanticSuites: [...handledSchemaPaths.keys()].filter((schemaId) => SEMANTIC_VECTOR_VALIDATORS[schemaId]),
    vectorSetDigest: vectorSetDigest(vectorArtifactRecords),
  };
}

function checkConformanceReport(
  report,
  reportPath,
  protocolRelease,
  constitution,
  caseCatalog,
  expectedVectorSetDigest,
) {
  requireCondition(
    report.protocol_spec_id === protocolRelease.protocol_spec_id,
    `${reportPath}: Protocol Spec ID differs from release`,
  );
  const claimedProfiles = new Set(report.portable_profiles);
  checkProfileClaimTaxonomy(report, reportPath, constitution);
  requireCondition(
    report.portable_vector_set_digest === expectedVectorSetDigest,
    `${reportPath}: portable_vector_set_digest differs from the pinned release vector set`,
  );
  requireCondition(
    report.constitution_id === constitution.constitution_id,
    `${reportPath}: Constitution ID differs from release`,
  );

  const results = new Map();
  for (const result of report.results) {
    requireCondition(!results.has(result.case_id), `${reportPath}: duplicate result case ID ${result.case_id}`);
    requireCondition(caseCatalog.has(result.case_id), `${reportPath}: unknown result case ID ${result.case_id}`);
    results.set(result.case_id, result);
  }
  requireExactStringSet(results.keys(), caseCatalog.keys(), `${reportPath}: result case set differs from pinned vectors`);

  for (const [caseId, metadata] of caseCatalog) {
    const result = results.get(caseId);
    const missingProfiles = metadata.requiredProfiles.filter((profile) => !claimedProfiles.has(profile));
    if (missingProfiles.length === 0) {
      requireCondition(
        result.status !== "not_applicable",
        `${reportPath}: ${caseId} is applicable to the claimed portable profiles and cannot be not_applicable`,
      );
    } else {
      requireCondition(
        result.status === "not_applicable",
        `${reportPath}: ${caseId} requires unclaimed profile ${missingProfiles[0]} and must be not_applicable`,
      );
      requireCondition(
        missingProfiles.some((profile) => result.details.includes(profile)),
        `${reportPath}: ${caseId} not_applicable details must name an unclaimed required profile`,
      );
    }
  }
}

function requireApplicablePasses(report, reportPath, caseCatalog) {
  const claimedProfiles = new Set(report.portable_profiles);
  const results = new Map(report.results.map((result) => [result.case_id, result]));
  for (const [caseId, metadata] of caseCatalog) {
    if (metadata.requiredProfiles.every((profile) => claimedProfiles.has(profile))) {
      requireCondition(
        results.get(caseId)?.status === "pass",
        `${reportPath}: applicable conformance case ${caseId} did not pass`,
      );
    }
  }
}

function expectCheckFailure(label, callback) {
  let rejected = false;
  try {
    callback();
  } catch (error) {
    if (!(error instanceof CheckFailure)) {
      throw error;
    }
    rejected = true;
  }
  requireCondition(rejected, `Semantic self-test accepted ${label}`);
}

function checkDeploymentManifestDefense(deploymentManifests, constitution) {
  const byRuntime = new Map();
  for (const [manifestPath, manifest] of deploymentManifests) {
    if (!byRuntime.has(manifest.runtime_family)) {
      byRuntime.set(manifest.runtime_family, { manifest, manifestPath });
    }
  }
  for (const runtime of ["EVM", "SVM"]) {
    requireCondition(byRuntime.has(runtime), `Deployment-manifest self-test requires one ${runtime} fixture`);
  }

  const evm = byRuntime.get("EVM");
  const svm = byRuntime.get("SVM");
  const rejectManifest = (label, source, mutate) => {
    expectCheckFailure(label, () => {
      const candidate = structuredClone(source.manifest);
      mutate(candidate);
      checkDeploymentManifestSemantics(candidate, `${source.manifestPath}:semantic-self-test`, constitution);
    });
  };

  rejectManifest("a duplicate deployment evidence ID", evm, (candidate) => {
    const duplicate = structuredClone(candidate.evidence_catalog[0]);
    duplicate.locator = `${duplicate.locator}:duplicate`;
    candidate.evidence_catalog.push(duplicate);
  });
  rejectManifest("an unresolved deployment evidence reference", evm, (candidate) => {
    candidate.network.evidence_refs[0] = "evidence:missing";
  });
  rejectManifest("an EVM chain-identity mismatch", evm, (candidate) => {
    candidate.runtime_evidence.chain_id = "1";
  });
  rejectManifest("an EVM runtime-code mismatch", evm, (candidate) => {
    candidate.runtime_evidence.artifact.runtime_bytecode_digest = `sha256:${"0".repeat(64)}`;
  });
  rejectManifest("an EVM creation-bytecode mismatch", evm, (candidate) => {
    candidate.runtime_evidence.artifact.creation_bytecode_digest = `sha256:${"0".repeat(64)}`;
  });
  rejectManifest("an EVM init-code mismatch", evm, (candidate) => {
    candidate.runtime_evidence.creation.init_code_digest = `sha256:${"0".repeat(64)}`;
  });
  rejectManifest("an EVM CREATE2 creator mismatch", evm, (candidate) => {
    candidate.runtime_evidence.creation.creator_native_id = "0x1111111111111111111111111111111111111111";
  });
  rejectManifest("an EVM CREATE2 salt mismatch", evm, (candidate) => {
    candidate.runtime_evidence.creation.salt = `0x${"1".repeat(64)}`;
  });
  rejectManifest("an EVM derived native-ID mismatch", evm, (candidate) => {
    candidate.runtime_evidence.creation.derived_native_id = "0x1111111111111111111111111111111111111111";
  });
  rejectManifest("constructor arguments outside the creation input", evm, (candidate) => {
    candidate.runtime_evidence.initialization.constructor_arguments = "0x01";
  });
  rejectManifest("a duplicate dependency ID", evm, (candidate) => {
    candidate.runtime_evidence.dependencies.push(structuredClone(candidate.runtime_evidence.dependencies[0]));
  });
  rejectManifest("an SVM genesis mismatch", svm, (candidate) => {
    candidate.runtime_evidence.genesis_hash = "different-genesis";
  });
  rejectManifest("an SVM Core Program ID mismatch", svm, (candidate) => {
    candidate.runtime_evidence.program_id = "DifferentProgram111111111111111111111111111111";
  });
  rejectManifest("an SVM ELF mismatch", svm, (candidate) => {
    candidate.runtime_evidence.artifact.elf_digest = `sha256:${"0".repeat(64)}`;
  });
  rejectManifest("an SVM runtime-code digest", svm, (candidate) => {
    candidate.core.runtime_code_digest = `sha256:${"0".repeat(64)}`;
  });
  rejectManifest("an SVM initialization target mismatch", svm, (candidate) => {
    candidate.runtime_evidence.initialization.steps[0].program_id =
      "DifferentProgram111111111111111111111111111111";
  });
  rejectManifest("an SVM immutable-state owner mismatch", svm, (candidate) => {
    candidate.runtime_evidence.immutable_state.accounts[0].owner_program_id =
      "DifferentProgram111111111111111111111111111111";
  });
}

function checkConformanceReportDefense(protocolRelease, constitution, caseCatalog, expectedVectorSetDigest) {
  requireCondition(caseCatalog.size > 0, "Conformance report self-test requires at least one vector case");
  const allProfiles = new Set([CORE_PROFILE_ID]);
  for (const metadata of caseCatalog.values()) {
    metadata.requiredProfiles.forEach((profile) => allProfiles.add(profile));
  }
  const completeReport = {
    protocol_spec_id: protocolRelease.protocol_spec_id,
    constitution_id: constitution.constitution_id,
    portable_vector_set_digest: expectedVectorSetDigest,
    portable_profiles: [...allProfiles],
    binding_native_profile_claims: [
      {
        claim_type: "binding_native",
        profile_id: "programmable.evm.direct-core.v1",
        conformance: {
          native_vector_set_path: "conformance/native/direct-core-v1.vectors.json",
          native_vector_set_digest: `sha256:${"1".repeat(64)}`,
          native_test_report_path: "conformance/native/direct-core-v1.report.json",
          native_test_report_digest: `sha256:${"2".repeat(64)}`,
        },
      },
    ],
    asset_profile_claims: [
      {
        claim_type: "asset_profile",
        asset_profile_id: "programmable.evm.asset.erc20-exact-balance.v1",
        conformance: {
          native_vector_set_path: "conformance/assets/erc20-exact-balance-v1.vectors.json",
          native_vector_set_digest: `sha256:${"3".repeat(64)}`,
          native_test_report_path: "conformance/assets/erc20-exact-balance-v1.report.json",
          native_test_report_digest: `sha256:${"4".repeat(64)}`,
        },
      },
    ],
    results: [...caseCatalog.keys()].map((caseId) => ({ case_id: caseId, status: "pass" })),
  };
  checkConformanceReport(
    completeReport,
    "report-semantic-self-test",
    protocolRelease,
    constitution,
    caseCatalog,
    expectedVectorSetDigest,
  );

  expectCheckFailure("a Constitution-unpermitted conformance profile", () => {
    const unknownProfile = structuredClone(completeReport);
    unknownProfile.portable_profiles.push("unpermitted-profile-v1");
    checkConformanceReport(
      unknownProfile,
      "report-semantic-self-test",
      protocolRelease,
      constitution,
      caseCatalog,
      expectedVectorSetDigest,
    );
  });

  expectCheckFailure("a duplicate binding-native profile ID with different evidence", () => {
    const duplicate = structuredClone(completeReport);
    const second = structuredClone(duplicate.binding_native_profile_claims[0]);
    second.conformance.native_test_report_digest = `sha256:${"5".repeat(64)}`;
    duplicate.binding_native_profile_claims.push(second);
    checkConformanceReport(
      duplicate,
      "report-semantic-self-test",
      protocolRelease,
      constitution,
      caseCatalog,
      expectedVectorSetDigest,
    );
  });

  expectCheckFailure("a profile ID shared by binding-native and Asset Profile claims", () => {
    const retyped = structuredClone(completeReport);
    retyped.asset_profile_claims[0].asset_profile_id = retyped.binding_native_profile_claims[0].profile_id;
    checkConformanceReport(
      retyped,
      "report-semantic-self-test",
      protocolRelease,
      constitution,
      caseCatalog,
      expectedVectorSetDigest,
    );
  });

  expectCheckFailure("a native claim that aliases its vector and report path", () => {
    const aliased = structuredClone(completeReport);
    aliased.binding_native_profile_claims[0].conformance.native_test_report_path =
      aliased.binding_native_profile_claims[0].conformance.native_vector_set_path;
    checkConformanceReport(
      aliased,
      "report-semantic-self-test",
      protocolRelease,
      constitution,
      caseCatalog,
      expectedVectorSetDigest,
    );
  });

  expectCheckFailure("a duplicate case ID", () => {
    const duplicate = structuredClone(completeReport);
    duplicate.results.push({ ...duplicate.results[0] });
    checkConformanceReport(
      duplicate,
      "report-semantic-self-test",
      protocolRelease,
      constitution,
      caseCatalog,
      expectedVectorSetDigest,
    );
  });
  expectCheckFailure("an omitted case ID", () => {
    const omitted = structuredClone(completeReport);
    omitted.results.pop();
    checkConformanceReport(
      omitted,
      "report-semantic-self-test",
      protocolRelease,
      constitution,
      caseCatalog,
      expectedVectorSetDigest,
    );
  });
  expectCheckFailure("not_applicable for an applicable case", () => {
    const invalidStatus = structuredClone(completeReport);
    invalidStatus.results[0] = {
      ...invalidStatus.results[0],
      status: "not_applicable",
      details: "Incorrectly skipped",
    };
    checkConformanceReport(
      invalidStatus,
      "report-semantic-self-test",
      protocolRelease,
      constitution,
      caseCatalog,
      expectedVectorSetDigest,
    );
  });

  const optionalCase = [...caseCatalog].find(([, metadata]) => metadata.requiredProfiles.length > 1);
  if (optionalCase !== undefined) {
    const coreOnlyReport = {
      protocol_spec_id: protocolRelease.protocol_spec_id,
      constitution_id: constitution.constitution_id,
      portable_vector_set_digest: expectedVectorSetDigest,
      portable_profiles: [CORE_PROFILE_ID],
      binding_native_profile_claims: structuredClone(completeReport.binding_native_profile_claims),
      asset_profile_claims: structuredClone(completeReport.asset_profile_claims),
      results: [...caseCatalog].map(([caseId, metadata]) => {
        const missingProfiles = metadata.requiredProfiles.filter((profile) => profile !== CORE_PROFILE_ID);
        return missingProfiles.length === 0
          ? { case_id: caseId, status: "pass" }
          : { case_id: caseId, status: "not_applicable", details: `Unclaimed profile: ${missingProfiles[0]}` };
      }),
    };
    checkConformanceReport(
      coreOnlyReport,
      "report-semantic-self-test",
      protocolRelease,
      constitution,
      caseCatalog,
      expectedVectorSetDigest,
    );
    expectCheckFailure("pass for an inapplicable case", () => {
      const invalidStatus = structuredClone(coreOnlyReport);
      const resultIndex = invalidStatus.results.findIndex((result) => result.case_id === optionalCase[0]);
      invalidStatus.results[resultIndex] = { case_id: optionalCase[0], status: "pass" };
      checkConformanceReport(
        invalidStatus,
        "report-semantic-self-test",
        protocolRelease,
        constitution,
        caseCatalog,
        expectedVectorSetDigest,
      );
    });
  }

  expectCheckFailure("a mismatched portable vector-set digest", () => {
    const mismatchedDigest = structuredClone(completeReport);
    mismatchedDigest.portable_vector_set_digest = `sha256:${"0".repeat(64)}`;
    checkConformanceReport(
      mismatchedDigest,
      "report-semantic-self-test",
      protocolRelease,
      constitution,
      caseCatalog,
      expectedVectorSetDigest,
    );
  });
  return completeReport;
}

function checkConformanceReports(
  ajv,
  repositoryJsonDocuments,
  protocolRelease,
  constitution,
  caseCatalog,
  expectedVectorSetDigest,
) {
  const reportsByDigest = new Map();
  for (const [reportPath, report] of documentsWithSchema(repositoryJsonDocuments, CONFORMANCE_REPORT_SCHEMA)) {
    assertPortableJson(report, reportPath);
    validateArtifact(ajv, reportPath, report);
    checkConformanceReport(
      report,
      reportPath,
      protocolRelease,
      constitution,
      caseCatalog,
      expectedVectorSetDigest,
    );
    checkProtocolCommitPin(ajv, report, reportPath);
    const digest = jsonArtifactDigest(report, reportPath);
    requireCondition(
      !reportsByDigest.has(digest),
      `${reportPath}: duplicate conformance-report identity also recorded at ${reportsByDigest.get(digest)?.path}`,
    );
    reportsByDigest.set(digest, { document: report, path: reportPath });
  }
  return reportsByDigest;
}

function requireCanonicalEquality(left, right, message) {
  requireCondition(canonicalize(left) === canonicalize(right), message);
}

function checkBindingReleaseReportRelation(release, releasePath, reportEntry, caseCatalog) {
  requireCondition(
    reportEntry !== undefined,
    `${releasePath}: conformance_report_digest does not resolve to a repository Conformance Report`,
  );
  const report = reportEntry.document;
  const reportPath = reportEntry.path;
  requireCondition(report.binding_id === release.binding_id, `${releasePath}: Binding ID differs from ${reportPath}`);
  requireCondition(
    report.implementation_commit === release.source.commit,
    `${releasePath}: source commit differs from ${reportPath} implementation commit`,
  );
  requireCondition(
    report.protocol_commit === release.protocol_commit,
    `${releasePath}: protocol commit differs from ${reportPath}`,
  );
  requireCondition(
    report.protocol_spec_id === release.protocol_spec_id,
    `${releasePath}: Protocol Spec ID differs from ${reportPath}`,
  );
  requireCondition(
    report.constitution_id === release.constitution_id,
    `${releasePath}: Constitution ID differs from ${reportPath}`,
  );
  requireExactConformanceClaims(release, report, `${releasePath} differs from ${reportPath}`);
  requireCanonicalEquality(release.toolchain, report.toolchain, `${releasePath}: toolchain differs from ${reportPath}`);
  requireApplicablePasses(report, reportPath, caseCatalog);

  const artifactNames = new Set([release.native_interface.name]);
  for (const artifact of release.artifact_digests) {
    requireCondition(
      !artifactNames.has(artifact.name),
      `${releasePath}: duplicate native artifact record name ${artifact.name}`,
    );
    artifactNames.add(artifact.name);
  }
}

function checkBindingReleasePins(
  ajv,
  repositoryJsonDocuments,
  protocolRelease,
  constitution,
  expectedVectorSetDigest,
  caseCatalog,
  reportsByDigest,
) {
  const releasesByDigest = new Map();
  for (const [releasePath, release] of documentsWithSchema(repositoryJsonDocuments, BINDING_RELEASE_SCHEMA)) {
    assertPortableJson(release, releasePath);
    validateArtifact(ajv, releasePath, release);
    requireCondition(
      release.protocol_spec_id === protocolRelease.protocol_spec_id,
      `${releasePath}: Protocol Spec ID differs from release`,
    );
    requireCondition(
      release.constitution_id === constitution.constitution_id,
      `${releasePath}: Constitution ID differs from release`,
    );
    requireCondition(
      release.portable_vector_set_digest === expectedVectorSetDigest,
      `${releasePath}: portable_vector_set_digest differs from the pinned release vector set`,
    );
    checkProfileClaimTaxonomy(release, releasePath, constitution);
    const protocolState = checkProtocolCommitPin(ajv, release, releasePath);
    checkBindingReleaseReportRelation(
      release,
      releasePath,
      reportsByDigest.get(release.conformance_report_digest),
      caseCatalog,
    );
    const digest = jsonArtifactDigest(release, releasePath);
    requireCondition(
      !releasesByDigest.has(digest),
      `${releasePath}: duplicate binding-release identity also recorded at ${releasesByDigest.get(digest)?.path}`,
    );
    releasesByDigest.set(digest, { document: release, path: releasePath, protocolState });
  }
  return releasesByDigest;
}

function releaseArtifactByKind(release, releasePath, kind) {
  const matches = [release.native_interface, ...release.artifact_digests].filter((artifact) => artifact.kind === kind);
  requireCondition(matches.length === 1, `${releasePath}: expected exactly one ${kind} artifact record`);
  return matches[0];
}

function checkDeploymentManifestBinding(manifest, manifestPath, releaseEntry) {
  requireCondition(
    releaseEntry !== undefined,
    `${manifestPath}: binding_release_digest does not resolve to a repository Binding Release`,
  );
  const release = releaseEntry.document;
  const releasePath = releaseEntry.path;
  if (manifest.classification === "production") {
    requireCondition(
      releaseEntry.protocolState !== undefined,
      `${manifestPath}: Production deployment has no verified protocol_commit state through ${releasePath}`,
    );
    requireCondition(
      releaseEntry.protocolState.status === "final",
      `${manifestPath}: Production deployment resolves through ${releasePath} to a Protocol release whose status is not final`,
    );
    requireCondition(
      releaseEntry.protocolState.productionEligible === true,
      `${manifestPath}: Production deployment resolves through ${releasePath} to a Protocol release that is not production_eligible`,
    );
  }
  requireCondition(
    manifest.runtime_family === release.runtime_family,
    `${manifestPath}: runtime family differs from ${releasePath}`,
  );
  requireCondition(
    manifest.core.constitution_id === release.constitution_id,
    `${manifestPath}: Constitution ID differs from ${releasePath}`,
  );
  requireExactConformanceClaims(manifest, release, `${manifestPath} differs from ${releasePath}`);
  requireCondition(
    manifest.runtime_evidence.artifact.source_commit === release.source.commit,
    `${manifestPath}: native artifact source commit differs from ${releasePath}`,
  );

  if (manifest.runtime_family === "EVM") {
    requireCondition(
      releaseArtifactByKind(release, releasePath, "abi").digest === manifest.runtime_evidence.artifact.abi_digest,
      `${manifestPath}: ABI digest differs from ${releasePath}`,
    );
    requireCondition(
      releaseArtifactByKind(release, releasePath, "creation_bytecode").digest ===
        manifest.runtime_evidence.artifact.creation_bytecode_digest,
      `${manifestPath}: creation-bytecode digest differs from ${releasePath}`,
    );
    requireCondition(
      releaseArtifactByKind(release, releasePath, "runtime_bytecode").digest ===
        manifest.runtime_evidence.artifact.runtime_bytecode_digest,
      `${manifestPath}: runtime-bytecode digest differs from ${releasePath}`,
    );
    return;
  }

  requireCondition(
    releaseArtifactByKind(release, releasePath, "idl").digest === manifest.runtime_evidence.artifact.idl_digest,
    `${manifestPath}: IDL digest differs from ${releasePath}`,
  );
  requireCondition(
    releaseArtifactByKind(release, releasePath, "elf").digest === manifest.runtime_evidence.artifact.elf_digest,
    `${manifestPath}: ELF digest differs from ${releasePath}`,
  );
}

function checkDeploymentManifestReleasePins(deploymentManifests, releasesByDigest) {
  let resolvedCount = 0;
  for (const [manifestPath, manifest] of deploymentManifests) {
    if (manifest.classification === "example") {
      continue;
    }
    checkDeploymentManifestBinding(
      manifest,
      manifestPath,
      releasesByDigest.get(manifest.binding_release_digest),
    );
    resolvedCount += 1;
  }
  return resolvedCount;
}

function checkArtifactChainDefense(
  ajv,
  protocolRelease,
  constitution,
  caseCatalog,
  expectedVectorSetDigest,
  completeReport,
  deploymentManifests,
) {
  const escapedSchemaDocument = parseJsonSource(
    '{"$schema":"urn:programmable:schema:binding-\\u0072elease:v1"}',
    "schema-dispatch-self-test",
  );
  requireCondition(
    documentsWithSchema(new Map([["escaped.json", escapedSchemaDocument]]), BINDING_RELEASE_SCHEMA).length === 1,
    "Parsed-schema dispatch self-test did not recognize an escaped schema identifier",
  );

  const evmFixture = [...deploymentManifests.values()].find((manifest) => manifest.runtime_family === "EVM");
  requireCondition(Boolean(evmFixture), "Artifact-chain self-test requires one EVM deployment fixture");
  const protocolCommit = "1111111111111111111111111111111111111111";
  const implementationCommit = "2222222222222222222222222222222222222222";
  const bindingId = "programmable-evm/0.1.0-selftest";
  const toolchain = { node: "self-test" };
  const report = {
    $schema: CONFORMANCE_REPORT_SCHEMA,
    ...structuredClone(completeReport),
    protocol_commit: protocolCommit,
    binding_id: bindingId,
    implementation_commit: implementationCommit,
    toolchain,
    test_environment: { runtime: "in-memory" },
  };
  validateArtifact(ajv, "artifact-chain-report-self-test", report);
  checkConformanceReport(
    report,
    "artifact-chain-report-self-test",
    protocolRelease,
    constitution,
    caseCatalog,
    expectedVectorSetDigest,
  );

  const release = {
    $schema: BINDING_RELEASE_SCHEMA,
    binding_id: bindingId,
    runtime_family: "EVM",
    protocol_spec_id: protocolRelease.protocol_spec_id,
    protocol_commit: protocolCommit,
    constitution_id: constitution.constitution_id,
    source: {
      repository: "https://example.invalid/programmable-evm.git",
      commit: implementationCommit,
    },
    toolchain,
    reproducible_build_command: "example-build --locked",
    native_interface: {
      name: "core-abi",
      kind: "abi",
      authoritative_byte_source: "RFC 8785 canonical ABI JSON bytes",
      algorithm: "SHA-256",
      digest: evmFixture.runtime_evidence.artifact.abi_digest,
      source_path: "artifacts/core.abi.json",
    },
    artifact_digests: [
      {
        name: "core-creation-bytecode",
        kind: "creation_bytecode",
        authoritative_byte_source: "compiler creation bytecode bytes before constructor arguments",
        algorithm: "SHA-256",
        digest: evmFixture.runtime_evidence.artifact.creation_bytecode_digest,
        source_path: "artifacts/core.creation.bin",
      },
      {
        name: "core-runtime-bytecode",
        kind: "runtime_bytecode",
        authoritative_byte_source: "compiler runtime bytecode bytes",
        algorithm: "SHA-256",
        digest: evmFixture.runtime_evidence.artifact.runtime_bytecode_digest,
        source_path: "artifacts/core.runtime.bin",
      },
    ],
    portable_profiles: [...report.portable_profiles],
    portable_vector_set_digest: expectedVectorSetDigest,
    binding_native_profile_claims: structuredClone(report.binding_native_profile_claims),
    asset_profile_claims: structuredClone(report.asset_profile_claims),
    conformance_report_digest: jsonArtifactDigest(report, "artifact-chain-report-self-test"),
    known_limits: { status: "self-test only" },
  };
  validateArtifact(ajv, "artifact-chain-release-self-test", release);
  const reportEntry = { document: report, path: "artifact-chain-report-self-test" };
  const reportCatalog = new Map([[jsonArtifactDigest(report, reportEntry.path), reportEntry]]);
  checkBindingReleaseReportRelation(
    release,
    "artifact-chain-release-self-test",
    reportCatalog.get(release.conformance_report_digest),
    caseCatalog,
  );

  const rejectReleaseLink = (label, mutateRelease, mutateReport = () => {}) => {
    expectCheckFailure(label, () => {
      const candidateRelease = structuredClone(release);
      const candidateReport = structuredClone(report);
      mutateRelease(candidateRelease);
      mutateReport(candidateReport);
      checkBindingReleaseReportRelation(
        candidateRelease,
        "artifact-chain-release-self-test",
        { document: candidateReport, path: "artifact-chain-report-self-test" },
        caseCatalog,
      );
    });
  };
  expectCheckFailure("an unresolved conformance-report digest", () => {
    const candidate = structuredClone(release);
    candidate.conformance_report_digest = `sha256:${"0".repeat(64)}`;
    checkBindingReleaseReportRelation(
      candidate,
      "artifact-chain-release-self-test",
      reportCatalog.get(candidate.conformance_report_digest),
      caseCatalog,
    );
  });
  rejectReleaseLink("a binding-ID mismatch", () => {}, (candidate) => {
    candidate.binding_id = "programmable-evm/0.1.1-selftest";
  });
  rejectReleaseLink("an implementation/source commit mismatch", () => {}, (candidate) => {
    candidate.implementation_commit = "3333333333333333333333333333333333333333";
  });
  rejectReleaseLink("a protocol-commit mismatch", () => {}, (candidate) => {
    candidate.protocol_commit = "3333333333333333333333333333333333333333";
  });
  rejectReleaseLink("a Constitution mismatch", () => {}, (candidate) => {
    candidate.constitution_id = `sha256:${"0".repeat(64)}`;
  });
  rejectReleaseLink("a portable vector-set mismatch", () => {}, (candidate) => {
    candidate.portable_vector_set_digest = `sha256:${"0".repeat(64)}`;
  });
  rejectReleaseLink("a portable-profile mismatch", (candidate) => {
    candidate.portable_profiles = candidate.portable_profiles.slice(0, -1);
  });
  rejectReleaseLink("a binding-native vector-set mismatch", (candidate) => {
    candidate.binding_native_profile_claims[0].conformance.native_vector_set_digest =
      `sha256:${"5".repeat(64)}`;
  });
  rejectReleaseLink("a binding-native test-report mismatch", (candidate) => {
    candidate.binding_native_profile_claims[0].conformance.native_test_report_digest =
      `sha256:${"6".repeat(64)}`;
  });
  rejectReleaseLink("an Asset Profile vector-set mismatch", (candidate) => {
    candidate.asset_profile_claims[0].conformance.native_vector_set_digest =
      `sha256:${"7".repeat(64)}`;
  });
  rejectReleaseLink("an Asset Profile test-report mismatch", (candidate) => {
    candidate.asset_profile_claims[0].conformance.native_test_report_digest =
      `sha256:${"8".repeat(64)}`;
  });
  rejectReleaseLink("a toolchain mismatch", () => {}, (candidate) => {
    candidate.toolchain = { node: "different" };
  });
  rejectReleaseLink("a failed applicable conformance case", () => {}, (candidate) => {
    candidate.results[0] = { ...candidate.results[0], status: "fail", details: "self-test failure" };
  });
  rejectReleaseLink("a duplicate native artifact name", (candidate) => {
    candidate.artifact_digests[0].name = candidate.native_interface.name;
  });

  const manifest = structuredClone(evmFixture);
  manifest.binding_release_digest = jsonArtifactDigest(release, "artifact-chain-release-self-test");
  manifest.portable_profiles = [...release.portable_profiles];
  manifest.portable_vector_set_digest = release.portable_vector_set_digest;
  manifest.binding_native_profile_claims = structuredClone(release.binding_native_profile_claims);
  manifest.asset_profile_claims = structuredClone(release.asset_profile_claims);
  manifest.runtime_evidence.artifact.source_commit = implementationCommit;
  const releaseEntry = {
    document: release,
    path: "artifact-chain-release-self-test",
    protocolState: { productionEligible: true, status: "final" },
  };
  const releaseCatalog = new Map([[jsonArtifactDigest(release, releaseEntry.path), releaseEntry]]);
  checkDeploymentManifestBinding(
    manifest,
    "artifact-chain-manifest-self-test",
    releaseCatalog.get(manifest.binding_release_digest),
  );

  const productionManifest = structuredClone(manifest);
  productionManifest.classification = "production";
  checkDeploymentManifestBinding(
    productionManifest,
    "artifact-chain-production-manifest-self-test",
    releaseEntry,
  );
  expectCheckFailure("a Production deployment without verified protocol-commit state", () => {
    checkDeploymentManifestBinding(
      productionManifest,
      "artifact-chain-production-manifest-self-test",
      { document: release, path: "artifact-chain-release-self-test" },
    );
  });
  expectCheckFailure("a Production deployment pinned to a non-Final Protocol release", () => {
    checkDeploymentManifestBinding(
      productionManifest,
      "artifact-chain-production-manifest-self-test",
      {
        document: release,
        path: "artifact-chain-release-self-test",
        protocolState: { productionEligible: true, status: "candidate" },
      },
    );
  });
  expectCheckFailure("a Production deployment pinned to a production-ineligible Protocol release", () => {
    checkDeploymentManifestBinding(
      productionManifest,
      "artifact-chain-production-manifest-self-test",
      {
        document: release,
        path: "artifact-chain-release-self-test",
        protocolState: { productionEligible: false, status: "final" },
      },
    );
  });

  const rejectManifestLink = (label, mutate) => {
    expectCheckFailure(label, () => {
      const candidate = structuredClone(manifest);
      mutate(candidate);
      checkDeploymentManifestBinding(candidate, "artifact-chain-manifest-self-test", releaseEntry);
    });
  };
  expectCheckFailure("an unresolved binding-release digest", () => {
    const candidate = structuredClone(manifest);
    candidate.binding_release_digest = `sha256:${"0".repeat(64)}`;
    checkDeploymentManifestBinding(
      candidate,
      "artifact-chain-manifest-self-test",
      releaseCatalog.get(candidate.binding_release_digest),
    );
  });
  rejectManifestLink("a binding/deployment runtime mismatch", (candidate) => {
    candidate.runtime_family = "SVM";
  });
  rejectManifestLink("a binding/deployment portable-profile mismatch", (candidate) => {
    candidate.portable_profiles = candidate.portable_profiles.slice(0, -1);
  });
  rejectManifestLink("a binding/deployment portable vector-set mismatch", (candidate) => {
    candidate.portable_vector_set_digest = `sha256:${"5".repeat(64)}`;
  });
  rejectManifestLink("a binding/deployment native vector-set mismatch", (candidate) => {
    candidate.binding_native_profile_claims[0].conformance.native_vector_set_digest =
      `sha256:${"6".repeat(64)}`;
  });
  rejectManifestLink("a binding/deployment native test-report mismatch", (candidate) => {
    candidate.binding_native_profile_claims[0].conformance.native_test_report_digest =
      `sha256:${"7".repeat(64)}`;
  });
  rejectManifestLink("a binding/deployment Asset Profile vector-set mismatch", (candidate) => {
    candidate.asset_profile_claims[0].conformance.native_vector_set_digest =
      `sha256:${"8".repeat(64)}`;
  });
  rejectManifestLink("a binding/deployment Asset Profile test-report mismatch", (candidate) => {
    candidate.asset_profile_claims[0].conformance.native_test_report_digest =
      `sha256:${"9".repeat(64)}`;
  });
  rejectManifestLink("a binding/deployment source-commit mismatch", (candidate) => {
    candidate.runtime_evidence.artifact.source_commit = "3333333333333333333333333333333333333333";
  });
  rejectManifestLink("a binding/deployment ABI mismatch", (candidate) => {
    candidate.runtime_evidence.artifact.abi_digest = `sha256:${"0".repeat(64)}`;
  });
  rejectManifestLink("a binding/deployment creation-bytecode mismatch", (candidate) => {
    candidate.runtime_evidence.artifact.creation_bytecode_digest = `sha256:${"0".repeat(64)}`;
  });
  rejectManifestLink("a binding/deployment runtime-bytecode mismatch", (candidate) => {
    candidate.runtime_evidence.artifact.runtime_bytecode_digest = `sha256:${"0".repeat(64)}`;
  });
}

function main() {
  checkJsonParserDefense();
  checkKeccakDefense();
  const textFiles = checkTextFiles();
  const repositoryJsonDocuments = loadRepositoryJsonDocuments();
  const protocolRelease = parseJson("protocol-version.json");
  assertPortableJson(protocolRelease, "protocol-version.json");
  const schemaPaths = listFiles("schemas", (file) => file.endsWith(".schema.json")).map(relativePath);
  const ajv = buildSchemaValidator(schemaPaths);
  validateArtifact(ajv, "protocol-version.json", protocolRelease);
  checkReleaseInventory(protocolRelease, schemaPaths);
  const constitution = checkConstitution(ajv, protocolRelease);
  checkMarketTemplateSchemaVocabulary(protocolRelease, constitution);
  const examples = loadAndCheckExamples(ajv, protocolRelease, constitution);
  const deploymentManifests = checkDeploymentManifests(ajv, repositoryJsonDocuments, constitution);
  checkDeploymentManifestDefense(deploymentManifests, constitution);
  const { assessmentCases, caseCatalog, identifierCases, semanticSuites, vectorSetDigest: releaseVectorSetDigest } = checkListedVectors(
    ajv,
    protocolRelease,
    constitution,
    examples.marketTemplates,
  );
  const completeReport = checkConformanceReportDefense(
    protocolRelease,
    constitution,
    caseCatalog,
    releaseVectorSetDigest,
  );
  checkArtifactChainDefense(
    ajv,
    protocolRelease,
    constitution,
    caseCatalog,
    releaseVectorSetDigest,
    completeReport,
    deploymentManifests,
  );
  const conformanceReports = checkConformanceReports(
    ajv,
    repositoryJsonDocuments,
    protocolRelease,
    constitution,
    caseCatalog,
    releaseVectorSetDigest,
  );
  const bindingReleases = checkBindingReleasePins(
    ajv,
    repositoryJsonDocuments,
    protocolRelease,
    constitution,
    releaseVectorSetDigest,
    caseCatalog,
    conformanceReports,
  );
  const resolvedDeployments = checkDeploymentManifestReleasePins(deploymentManifests, bindingReleases);
  const requirementIds = checkRequirementIds();
  const links = checkMarkdownLinks();
  checkPortableLayer();

  process.stdout.write(
    [
      "Programmable Protocol repository check passed.",
      `  files: ${textFiles}`,
      `  schemas: ${schemaPaths.length}`,
      `  example fixtures: ${examples.fixtureCount}`,
      `  market templates: ${examples.marketTemplates.size}`,
      `  deployment manifests: ${deploymentManifests.size} (${resolvedDeployments} release-resolved claims)`,
      `  identifier vectors: ${identifierCases.total}`,
      `  assessment vectors: ${assessmentCases.total} (${assessmentCases.accepted} accept, ${assessmentCases.rejected} reject)`,
      `  semantic vector suites: ${semanticSuites.length}`,
      `  portable vector set: ${releaseVectorSetDigest}`,
      `  binding releases: ${bindingReleases.size}`,
      `  conformance reports: ${conformanceReports.size}`,
      `  normative requirements: ${requirementIds}`,
      `  local links: ${links}`,
    ].join("\n") + "\n",
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`ERROR: ${error.message}\n`);
  process.exitCode = 1;
}
