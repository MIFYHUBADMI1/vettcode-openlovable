import { describe, it, expect } from "vitest"
import { Sanitizer } from "./sanitizer"
import type { ApplicationSpecification } from "../../types/specification"

/**
 * Test suite for Sanitizer
 * -------------------------
 * Validates Requirements 20.1-20.8
 */

describe("Sanitizer", () => {
  const sanitizer = new Sanitizer()

  /**
   * Helper to create a minimal valid ApplicationSpecification for testing
   */
  const createSpec = (overrides: Partial<ApplicationSpecification> = {}): ApplicationSpecification => ({
    applicationType: "web_app",
    title: "Test App",
    description: "Test application",
    purpose: "Testing",
    targetUsers: [],
    userRoles: [],
    coreFlows: [],
    suggestedFeatures: [],
    dataEntities: [],
    backendRequirements: [],
    integrations: [],
    additionalInstructions: "",
    ...overrides,
  })

  describe("sanitize", () => {
    describe("database replacements", () => {
      /**
       * **Validates: Requirement 20.2**
       * WHEN PostgreSQL, MongoDB, MySQL, or SQLite are mentioned,
       * THE Sanitizer SHALL replace them with "Totalum SDK database"
       */
      it("should replace PostgreSQL references with Totalum SDK database", () => {
        const spec = createSpec({
          backendRequirements: ["Use PostgreSQL for data storage"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.sanitized).toBe(true)
        expect(result.specification.backendRequirements).toEqual(["Use Totalum SDK database for data storage"])
        expect(result.replacements).toHaveLength(1)
        expect(result.replacements[0].pattern).toBe("PostgreSQL")
      })

      it("should replace postgres (lowercase) references", () => {
        const spec = createSpec({
          additionalInstructions: "Store data in postgres database",
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.additionalInstructions).toBe("Store data in Totalum SDK database database")
        expect(result.replacements[0].original.toLowerCase()).toBe("postgres")
      })

      it("should replace MongoDB references with Totalum SDK database", () => {
        const spec = createSpec({
          integrations: ["MongoDB Atlas integration"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.integrations).toEqual(["Totalum SDK database Atlas integration"])
        expect(result.replacements[0].pattern).toBe("MongoDB")
      })

      it("should replace MySQL references with Totalum SDK database", () => {
        const spec = createSpec({
          designDirection: "Use MySQL for relational data",
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.designDirection).toBe("Use Totalum SDK database for relational data")
      })

      it("should replace SQLite references with Totalum SDK database", () => {
        const spec = createSpec({
          backendRequirements: ["SQLite for local development"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.backendRequirements).toEqual(["Totalum SDK database for local development"])
      })
    })

    describe("ORM replacements", () => {
      /**
       * **Validates: Requirement 20.3**
       * WHEN Prisma, Mongoose, Sequelize, TypeORM, or Drizzle are mentioned,
       * THE Sanitizer SHALL replace them with "Totalum SDK"
       */
      it("should replace Prisma references with Totalum SDK", () => {
        const spec = createSpec({
          backendRequirements: ["Use Prisma ORM for database access"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.backendRequirements).toEqual(["Use Totalum SDK for database access"])
        expect(result.replacements[0].pattern).toBe("Prisma ORM")
      })

      it("should replace Mongoose references with Totalum SDK", () => {
        const spec = createSpec({
          integrations: ["Mongoose for MongoDB schemas"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.integrations).toEqual(["Totalum SDK for Totalum SDK database schemas"])
      })

      it("should replace Sequelize references with Totalum SDK", () => {
        const spec = createSpec({
          additionalInstructions: "Implement models with Sequelize",
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.additionalInstructions).toBe("Implement models with Totalum SDK")
      })

      it("should replace TypeORM references with Totalum SDK", () => {
        const spec = createSpec({
          backendRequirements: ["TypeORM for entity management"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.backendRequirements).toEqual(["Totalum SDK for entity management"])
      })

      it("should replace Drizzle references with Totalum SDK", () => {
        const spec = createSpec({
          backendRequirements: ["Drizzle ORM for type-safe queries"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.backendRequirements).toEqual(["Totalum SDK for type-safe queries"])
      })
    })

    describe("backend framework replacements", () => {
      /**
       * **Validates: Requirement 20.4**
       * WHEN Express, Fastify, or NestJS are mentioned,
       * THE Sanitizer SHALL replace them with "Next.js API routes"
       */
      it("should replace Express references with Next.js API routes", () => {
        const spec = createSpec({
          backendRequirements: ["Express server for API endpoints"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.backendRequirements).toEqual(["Next.js API routes server for API endpoints"])
        expect(result.replacements[0].pattern).toBe("Express")
      })

      it("should replace Fastify references with Next.js API routes", () => {
        const spec = createSpec({
          integrations: ["Fastify for high-performance APIs"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.integrations).toEqual(["Next.js API routes for high-performance APIs"])
      })

      it("should replace NestJS references with Next.js API routes", () => {
        const spec = createSpec({
          additionalInstructions: "Use NestJS for backend structure",
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.additionalInstructions).toBe("Use Next.js API routes for backend structure")
      })
    })

    describe("BaaS replacements", () => {
      it("should replace Firebase references with Totalum SDK", () => {
        const spec = createSpec({
          integrations: ["Firebase Authentication"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.integrations).toEqual(["Totalum SDK Authentication"])
      })

      it("should replace Supabase references with Totalum SDK", () => {
        const spec = createSpec({
          backendRequirements: ["Supabase for backend services"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.backendRequirements).toEqual(["Totalum SDK for backend services"])
      })
    })

    describe("field scanning", () => {
      /**
       * **Validates: Requirement 20.5**
       * THE Sanitizer SHALL scan suggestedFeatures descriptions, backendRequirements,
       * integrations, designDirection, and additionalInstructions
       */
      it("should scan backendRequirements array", () => {
        const spec = createSpec({
          backendRequirements: ["PostgreSQL database", "Express API"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.replacements).toHaveLength(2)
        expect(result.replacements.some(v => v.field === "backendRequirements[0]")).toBe(true)
        expect(result.replacements.some(v => v.field === "backendRequirements[1]")).toBe(true)
      })

      it("should scan integrations array", () => {
        const spec = createSpec({
          integrations: ["MongoDB Atlas", "Prisma Client"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.replacements).toHaveLength(2)
        expect(result.replacements.some(v => v.field.startsWith("integrations"))).toBe(true)
      })

      it("should scan designDirection string", () => {
        const spec = createSpec({
          designDirection: "Modern design with PostgreSQL backend",
        })

        const result = sanitizer.sanitize(spec)

        expect(result.replacements.some(v => v.field === "designDirection")).toBe(true)
      })

      it("should scan additionalInstructions string", () => {
        const spec = createSpec({
          additionalInstructions: "Use Express for routing",
        })

        const result = sanitizer.sanitize(spec)

        expect(result.replacements.some(v => v.field === "additionalInstructions")).toBe(true)
      })

      it("should scan suggestedFeatures descriptions", () => {
        const spec = createSpec({
          suggestedFeatures: [
            {
              key: "database",
              label: "Database",
              description: "PostgreSQL with Prisma",
              enabled: true,
            },
          ],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.suggestedFeatures[0].description).toBe("Totalum SDK database with Totalum SDK")
        expect(result.replacements).toHaveLength(2)
      })

      it("should scan dataEntities descriptions", () => {
        const spec = createSpec({
          dataEntities: [
            {
              name: "User",
              description: "Stored in MongoDB",
              fields: ["name", "email"],
            },
          ],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.dataEntities[0].description).toBe("Stored in Totalum SDK database")
      })

      it("should scan coreFlows descriptions", () => {
        const spec = createSpec({
          coreFlows: [
            {
              name: "User Registration",
              description: "Save to PostgreSQL via Prisma",
            },
          ],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.coreFlows[0].description).toBe("Save to Totalum SDK database via Totalum SDK")
      })

      it("should scan authenticationRequirements", () => {
        const spec = createSpec({
          authenticationRequirements: "Firebase Authentication with Google provider",
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.authenticationRequirements).toBe("Totalum SDK Authentication with Google provider")
      })
    })

    describe("violation tracking", () => {
      /**
       * **Validates: Requirement 20.6**
       * THE Sanitizer SHALL log each sanitization action with the original text and replacement
       */
      it("should track violations with field paths", () => {
        const spec = createSpec({
          backendRequirements: ["PostgreSQL database"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.replacements[0]).toMatchObject({
          field: "backendRequirements[0]",
          original: "PostgreSQL",
          replacement: "Totalum SDK database",
          pattern: "PostgreSQL",
        })
      })

      it("should track multiple violations in the same field", () => {
        const spec = createSpec({
          additionalInstructions: "Use PostgreSQL with Prisma for data access",
        })

        const result = sanitizer.sanitize(spec)

        expect(result.replacements).toHaveLength(2)
        expect(result.replacements[0].pattern).toBe("PostgreSQL")
        expect(result.replacements[1].pattern).toBe("Prisma")
      })

      it("should track violations across multiple fields", () => {
        const spec = createSpec({
          backendRequirements: ["PostgreSQL database"],
          integrations: ["MongoDB Atlas"],
          additionalInstructions: "Express API server",
        })

        const result = sanitizer.sanitize(spec)

        expect(result.replacements).toHaveLength(3)
        expect(new Set(result.replacements.map(v => v.field)).size).toBe(3)
      })
    })

    describe("sanitized flag", () => {
      /**
       * **Validates: Requirement 20.7**
       * THE Sanitizer SHALL set a sanitized flag on the ApplicationSpecification when changes are made
       */
      it("should set sanitized flag when violations are found", () => {
        const spec = createSpec({
          backendRequirements: ["PostgreSQL database"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.sanitized).toBe(true)
      })

      it("should not set sanitized flag when no violations are found", () => {
        const spec = createSpec({
          backendRequirements: ["Totalum SDK for data access"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.sanitized).toBe(false)
        expect(result.replacements).toHaveLength(0)
      })
    })

    describe("edge cases", () => {
      it("should handle empty specification", () => {
        const spec = createSpec()

        const result = sanitizer.sanitize(spec)

        expect(result.sanitized).toBe(false)
        expect(result.replacements).toHaveLength(0)
      })

      it("should handle undefined optional fields", () => {
        const spec = createSpec({
          authenticationRequirements: undefined,
          designDirection: undefined,
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.authenticationRequirements).toBeUndefined()
        expect(result.specification.designDirection).toBeUndefined()
      })

      it("should filter empty strings from arrays after sanitization", () => {
        const spec = createSpec({
          backendRequirements: ["   ", "PostgreSQL"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.backendRequirements).toEqual(["Totalum SDK database"])
      })

      it("should handle case-insensitive matches", () => {
        const spec = createSpec({
          backendRequirements: ["POSTGRESQL", "postgresql", "PostGreSQL"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.backendRequirements.every(
          req => req.includes("Totalum SDK database")
        )).toBe(true)
      })

      it("should handle multiple violations in single text", () => {
        const spec = createSpec({
          additionalInstructions: "Use PostgreSQL with Prisma and Express for the backend",
        })

        const result = sanitizer.sanitize(spec)

        expect(result.replacements).toHaveLength(3)
        expect(result.specification.additionalInstructions).toBe(
          "Use Totalum SDK database with Totalum SDK and Next.js API routes for the backend"
        )
      })

      it("should preserve other content while replacing violations", () => {
        const spec = createSpec({
          description: "A great application using modern technologies",
          backendRequirements: ["PostgreSQL database"],
        })

        const result = sanitizer.sanitize(spec)

        expect(result.specification.description).toBe("A great application using modern technologies")
        expect(result.specification.title).toBe("Test App")
      })
    })
  })

  describe("scanForViolations", () => {
    /**
     * **Validates: Requirement 20.1**
     * THE Sanitizer SHALL scan all text fields in ApplicationSpecification
     * for unsupported technology references
     */
    it("should scan without modifying the specification", () => {
      const spec = createSpec({
        backendRequirements: ["PostgreSQL database"],
      })

      const violations = sanitizer.scanForViolations(spec)

      expect(violations).toHaveLength(1)
      expect(spec.backendRequirements).toEqual(["PostgreSQL database"])
    })

    it("should find all violations across all fields", () => {
      const spec = createSpec({
        backendRequirements: ["PostgreSQL"],
        integrations: ["MongoDB"],
        additionalInstructions: "Express API",
        suggestedFeatures: [
          {
            key: "db",
            label: "Database",
            description: "Prisma ORM",
            enabled: true,
          },
        ],
      })

      const violations = sanitizer.scanForViolations(spec)

      expect(violations).toHaveLength(4)
    })

    it("should return empty array when no violations found", () => {
      const spec = createSpec({
        backendRequirements: ["Next.js API routes"],
      })

      const violations = sanitizer.scanForViolations(spec)

      expect(violations).toHaveLength(0)
    })
  })

  /**
   * **Validates: Requirement 20.8**
   * THE Sanitizer SHALL complete sanitization within 5 seconds
   * regardless of specification size
   */
  describe("performance", () => {
    it("should sanitize large specifications quickly", () => {
      const largeSpec = createSpec({
        backendRequirements: Array(100).fill("PostgreSQL database"),
        integrations: Array(100).fill("MongoDB Atlas"),
        suggestedFeatures: Array(50).fill({
          key: "feature",
          label: "Feature",
          description: "Using Prisma and Express",
          enabled: false,
        }),
      })

      const start = Date.now()
      const result = sanitizer.sanitize(largeSpec)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(5000)
      expect(result.sanitized).toBe(true)
    })
  })
})



