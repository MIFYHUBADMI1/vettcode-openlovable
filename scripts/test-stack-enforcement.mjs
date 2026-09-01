#!/usr/bin/env node
/**
 * Test: Stack enforcement across the pipeline
 * Verifies that unsupported technologies are stripped and the correct
 * stack (React, Next.js, Tailwind CSS, Totalum SDK) is enforced.
 */

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

// ── Replicate the sanitization logic from specification.ts ──
const STACK_REPLACEMENTS = [
  [/\bpostgresql|postgres\b/gi, "Totalum SDK database"],
  [/\bprisma(?:\s+orm)?\b/gi, "Totalum SDK"],
  [/\bmongodb\b/gi, "Totalum SDK database"],
  [/\bmongoose\b/gi, "Totalum SDK"],
  [/\bmysql\b/gi, "Totalum SDK database"],
  [/\bsqlite\b/gi, "Totalum SDK database"],
  [/\bsequelize\b/gi, "Totalum SDK"],
  [/\btypeorm\b/gi, "Totalum SDK"],
  [/\bdrizzle(?:\s+orm)?\b/gi, "Totalum SDK"],
  [/\bknex\b/gi, "Totalum SDK"],
  [/\bfirebase\b/gi, "Totalum SDK"],
  [/\bsupabase\b/gi, "Totalum SDK"],
  [/\bexpress\.?js|express\b/gi, "Next.js API routes"],
  [/\bfastify\b/gi, "Next.js API routes"],
  [/\bnestjs\b/gi, "Next.js API routes"],
  [/\bREST\s+API\s+framework/gi, "Next.js API routes"],
];

function sanitizeText(text) {
  let result = text;
  for (const [pattern, replacement] of STACK_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function sanitizeArray(arr) {
  return arr.map((item) => sanitizeText(item)).filter((item) => item.trim().length > 0);
}

// ── Replicate prompt building logic from prompt-builder.ts ──
function buildPrompt(spec) {
  const features = (spec.suggestedFeatures || [])
    .filter((f) => f.enabled)
    .map((f) => f.label);
  const entities = (spec.dataEntities || [])
    .map((e) => `- ${e.name}${e.fields.length ? ` (${e.fields.join(", ")})` : ""}`)
    .join("\n");
  const flows = (spec.coreFlows || [])
    .map((f) => `- ${f.name}: ${f.description ?? ""}`)
    .join("\n");

  return [
    `Build a production-ready full-stack web application: ${spec.title}.`,
    "",
    "REQUIRED TECH STACK:",
    "- Frontend: React with Next.js (App Router)",
    "- Styling: Tailwind CSS",
    "- Database: Totalum SDK (built-in database — use Totalum SDK for all data operations)",
    "- Authentication: Totalum SDK auth helpers",
    "- Do NOT use PostgreSQL, Prisma, MongoDB, Mongoose, or any external database.",
    "- Do NOT use external ORM libraries. All data storage must go through Totalum SDK.",
    "- Do NOT suggest technologies outside this stack. Use only what Totalum supports.",
    "",
    `Application type: ${spec.applicationType}`,
    `Purpose: ${spec.purpose}`,
    "",
    spec.authenticationRequirements ? `Authentication: ${spec.authenticationRequirements}` : "",
    spec.backendRequirements?.length ? `Backend: ${spec.backendRequirements.join(", ")}` : "",
    "",
    "IMPORTANT: Use ONLY React, Next.js, Tailwind CSS, and Totalum SDK. Do not reference or use any other database, ORM, or backend framework.",
    "Deliver a working, deployable application with a clean, responsive UI and a functional backend.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

// ══════════════════════════════════════════════════════════════
// TEST 1: sanitizeText replaces unsupported technologies
// ══════════════════════════════════════════════════════════════
console.log("\n🔧 Test 1: sanitizeText replaces unsupported technologies");

assert(
  sanitizeText("Use PostgreSQL for the database") === "Use Totalum SDK database for the database",
  "PostgreSQL → Totalum SDK database"
);
assert(
  sanitizeText("Set up Prisma ORM for data access") === "Set up Totalum SDK for data access",
  "Prisma ORM → Totalum SDK"
);
assert(
  sanitizeText("Connect to MongoDB for storage") === "Connect to Totalum SDK database for storage",
  "MongoDB → Totalum SDK database"
);
assert(
  sanitizeText("Use Mongoose for schema validation") === "Use Totalum SDK for schema validation",
  "Mongoose → Totalum SDK"
);
assert(
  sanitizeText("Set up Express.js backend") === "Set up Next.js API routes backend",
  "Express.js → Next.js API routes"
);
assert(
  sanitizeText("Use Firebase for auth") === "Use Totalum SDK for auth",
  "Firebase → Totalum SDK"
);
assert(
  sanitizeText("Use Supabase as the database") === "Use Totalum SDK as the database",
  "Supabase → Totalum SDK"
);
assert(
  sanitizeText("Set up NestJS server") === "Set up Next.js API routes server",
  "NestJS → Next.js API routes"
);
assert(
  sanitizeText("Use Drizzle ORM for queries") === "Use Totalum SDK for queries",
  "Drizzle ORM → Totalum SDK"
);
assert(
  sanitizeText("Use Fastify for the API") === "Use Next.js API routes for the API",
  "Fastify → Next.js API routes"
);
assert(
  sanitizeText("Use MySQL as backend") === "Use Totalum SDK database as backend",
  "MySQL → Totalum SDK database"
);
assert(
  sanitizeText("Set up Sequelize models") === "Set up Totalum SDK models",
  "Sequelize → Totalum SDK"
);

// ══════════════════════════════════════════════════════════════
// TEST 2: sanitizeText preserves supported technologies
// ══════════════════════════════════════════════════════════════
console.log("\n✅ Test 2: sanitizeText preserves supported technologies");

assert(
  sanitizeText("Use React with Next.js App Router") === "Use React with Next.js App Router",
  "React + Next.js preserved"
);
assert(
  sanitizeText("Style with Tailwind CSS") === "Style with Tailwind CSS",
  "Tailwind CSS preserved"
);
assert(
  sanitizeText("Use Totalum SDK for database operations") === "Use Totalum SDK for database operations",
  "Totalum SDK preserved"
);

// ══════════════════════════════════════════════════════════════
// TEST 3: sanitizeArray cleans arrays of unsupported tech
// ══════════════════════════════════════════════════════════════
console.log("\n📦 Test 3: sanitizeArray cleans arrays");

const result = sanitizeArray([
  "PostgreSQL database with Prisma ORM",
  "Express.js backend",
  "React with Next.js frontend",
  "Tailwind CSS styling",
]);
assert(
  result[0].includes("Totalum SDK"),
  "Array item 0 has Totalum SDK (PostgreSQL/Prisma removed)"
);
assert(
  !result[0].includes("PostgreSQL"),
  "Array item 0 has no PostgreSQL"
);
assert(
  !result[0].includes("Prisma"),
  "Array item 0 has no Prisma"
);
assert(
  result[1] === "Next.js API routes backend",
  "Array item 1: Express.js → Next.js API routes"
);
assert(
  result[2] === "React with Next.js frontend",
  "Array item 2 preserved"
);
assert(
  result[3] === "Tailwind CSS styling",
  "Array item 3 preserved"
);

// ══════════════════════════════════════════════════════════════
// TEST 4: sanitizeSpecification cleans all spec fields
// ══════════════════════════════════════════════════════════════
console.log("\n📋 Test 4: sanitizeSpecification cleans all spec fields");

const dirtySpec = {
  authenticationRequirements: "Use Firebase auth with Prisma for user storage",
  backendRequirements: ["PostgreSQL database", "Express.js API", "MongoDB for caching"],
  integrations: ["Stripe payments", "Supabase for real-time"],
  designDirection: "Modern with NestJS-inspired patterns",
  additionalInstructions: "Use Mongoose for all data models",
  coreFlows: [
    { name: "Login", description: "User logs in via Firebase" },
    { name: "Dashboard", description: "Shows data from PostgreSQL" },
  ],
  suggestedFeatures: [
    { key: "auth", label: "Auth", description: "Firebase authentication", enabled: true },
    { key: "db", label: "Database", description: "PostgreSQL with Prisma ORM", enabled: true },
  ],
  dataEntities: [
    { name: "User", fields: ["id", "name"], description: "Stored in MongoDB via Mongoose" },
  ],
};

const cleaned = {
  ...dirtySpec,
  authenticationRequirements: sanitizeText(dirtySpec.authenticationRequirements),
  backendRequirements: sanitizeArray(dirtySpec.backendRequirements),
  integrations: sanitizeArray(dirtySpec.integrations),
  designDirection: sanitizeText(dirtySpec.designDirection),
  additionalInstructions: sanitizeText(dirtySpec.additionalInstructions),
  coreFlows: dirtySpec.coreFlows.map((f) => ({
    ...f,
    description: sanitizeText(f.description),
  })),
  suggestedFeatures: dirtySpec.suggestedFeatures.map((f) => ({
    ...f,
    description: sanitizeText(f.description),
  })),
  dataEntities: dirtySpec.dataEntities.map((e) => ({
    ...e,
    description: sanitizeText(e.description),
  })),
};

// Auth: Firebase → Totalum SDK, Prisma → Totalum SDK
assert(
  cleaned.authenticationRequirements === "Use Totalum SDK auth with Totalum SDK for user storage",
  "auth requirements fully sanitized"
);

// Backend: all three should be sanitized
assert(
  cleaned.backendRequirements.length === 3,
  "backend requirements: all 3 items preserved"
);
assert(
  cleaned.backendRequirements.some((r) => r.includes("Totalum SDK database")),
  "backend requirements: has Totalum SDK database (from PostgreSQL/MongoDB)"
);
assert(
  cleaned.backendRequirements.some((r) => r.includes("Next.js API routes")),
  "backend requirements: has Next.js API routes (from Express.js)"
);
assert(
  cleaned.backendRequirements.every((r) => !r.includes("PostgreSQL")),
  "backend requirements: no PostgreSQL"
);
assert(
  cleaned.backendRequirements.every((r) => !r.includes("MongoDB")),
  "backend requirements: no MongoDB"
);

// Integrations: Supabase → Totalum SDK, Stripe stays
assert(
  cleaned.integrations[0] === "Stripe payments",
  "integrations: Stripe preserved"
);
assert(
  cleaned.integrations[1].includes("Totalum SDK"),
  "integrations: Supabase replaced with Totalum SDK"
);
assert(
  !cleaned.integrations[1].includes("Supabase"),
  "integrations: no Supabase"
);

// Design direction
assert(
  cleaned.designDirection.includes("Next.js API routes"),
  "design direction: NestJS → Next.js API routes"
);

// Additional instructions
assert(
  cleaned.additionalInstructions.includes("Totalum SDK"),
  "additional instructions: Mongoose → Totalum SDK"
);

// Core flows
assert(
  cleaned.coreFlows[0].description.includes("Totalum SDK"),
  "core flow 0: Firebase → Totalum SDK"
);
assert(
  cleaned.coreFlows[1].description.includes("Totalum SDK database"),
  "core flow 1: PostgreSQL → Totalum SDK database"
);

// Suggested features
assert(
  cleaned.suggestedFeatures[0].description.includes("Totalum SDK"),
  "feature 0: Firebase → Totalum SDK"
);
assert(
  cleaned.suggestedFeatures[1].description.includes("Totalum SDK database"),
  "feature 1: PostgreSQL → Totalum SDK database"
);
assert(
  cleaned.suggestedFeatures[1].description.includes("Totalum SDK"),
  "feature 1: Prisma → Totalum SDK"
);

// Data entities
assert(
  cleaned.dataEntities[0].description.includes("Totalum SDK database"),
  "entity: MongoDB → Totalum SDK database"
);
assert(
  cleaned.dataEntities[0].description.includes("Totalum SDK"),
  "entity: Mongoose → Totalum SDK"
);

// ══════════════════════════════════════════════════════════════
// TEST 5: buildPrompt includes stack enforcement
// ══════════════════════════════════════════════════════════════
console.log("\n🏗️  Test 5: buildPrompt includes stack enforcement");

const prompt = buildPrompt({
  title: "My SaaS App",
  applicationType: "saas",
  purpose: "Project management tool",
  authenticationRequirements: "Email/password auth",
  backendRequirements: ["REST API"],
  integrations: [],
  designDirection: "Clean and modern",
  additionalInstructions: "",
  coreFlows: [{ name: "Login", description: "User logs in" }],
  suggestedFeatures: [{ key: "auth", label: "Auth", enabled: true }],
  dataEntities: [{ name: "Task", fields: ["title", "assignee"] }],
});

assert(
  prompt.includes("REQUIRED TECH STACK"),
  "Prompt includes REQUIRED TECH STACK section"
);
assert(
  prompt.includes("React with Next.js"),
  "Prompt mentions React + Next.js"
);
assert(
  prompt.includes("Tailwind CSS"),
  "Prompt mentions Tailwind CSS"
);
assert(
  prompt.includes("Totalum SDK"),
  "Prompt mentions Totalum SDK"
);
assert(
  prompt.includes("PostgreSQL, Prisma, MongoDB, Mongoose"),
  "Prompt warns against PostgreSQL, Prisma, MongoDB, Mongoose"
);
assert(
  prompt.includes("Do NOT use external ORM"),
  "Prompt warns against external ORMs"
);
assert(
  prompt.includes("IMPORTANT: Use ONLY React, Next.js, Tailwind CSS, and Totalum SDK"),
  "Prompt has closing stack enforcement reminder"
);

// ══════════════════════════════════════════════════════════════
// TEST 6: No unsupported tech slips through sanitization
// ══════════════════════════════════════════════════════════════
console.log("\n🛡️  Test 6: No unsupported tech slips through");

const UNSUPPORTED_TERMS = ["PostgreSQL", "Prisma", "MongoDB", "Mongoose", "MySQL", "SQLite", "Firebase", "Supabase", "Sequelize", "TypeORM", "Drizzle", "Knex"];
const UNSUPPORTED_BACKENDS = ["Express.js", "Express", "Fastify", "NestJS"];

// Test that sanitization removes all unsupported terms
for (const term of UNSUPPORTED_TERMS) {
  const result = sanitizeText(`Use ${term} for the app`);
  assert(
    !result.includes(term),
    `Sanitized: "${term}" removed`
  );
}

for (const term of UNSUPPORTED_BACKENDS) {
  const result = sanitizeText(`Set up ${term} server`);
  assert(
    result.includes("Next.js API routes"),
    `Sanitized: "${term}" → Next.js API routes`
  );
}

// ══════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("═".repeat(50));

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\n🎉 All stack enforcement tests passed!\n");
  process.exit(0);
}
