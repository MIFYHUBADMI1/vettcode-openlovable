import { z } from "zod"
import {
  PLATFORM_RUNTIME_REQUESTS_PER_DAY_MAX,
  PLATFORM_RUNTIME_REQUESTS_PER_MINUTE,
} from "@/lib/runtime/platform-limits"

const ModelIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\w./:-]+$/, "Invalid model identifier")

export const ProjectRuntimeLimitsSchema = z
  .object({
    /** Omit / null = no project-level RPM (platform per-key cap still applies). */
    requestsPerMinute: z
      .number()
      .int()
      .min(1)
      .max(PLATFORM_RUNTIME_REQUESTS_PER_MINUTE)
      .nullable()
      .optional(),
    requestsPerDay: z
      .number()
      .int()
      .min(1)
      .max(PLATFORM_RUNTIME_REQUESTS_PER_DAY_MAX)
      .nullable()
      .optional(),
  })
  .strict()

/**
 * PATCH body for project runtime config. Unknown fields rejected.
 * Empty-string defaultModel clears the project override (platform default).
 */
export const ProjectRuntimeConfigPatchSchema = z
  .object({
    defaultModel: z.union([ModelIdSchema, z.literal("")]).optional(),
    allowedModels: z.array(ModelIdSchema).max(50).optional(),
    fallbackModels: z.array(ModelIdSchema).max(5).optional(),
    allowEndUserModelSelection: z.boolean().optional(),
    limits: ProjectRuntimeLimitsSchema.optional(),
  })
  .strict()

export type ProjectRuntimeConfigPatch = z.infer<typeof ProjectRuntimeConfigPatchSchema>
