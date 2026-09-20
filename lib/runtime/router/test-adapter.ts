import "server-only"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import type { RuntimeProviderAdapter } from "./adapter"
import { ProviderExecutionError } from "./adapter"
import { registerProviderAdapter } from "./provider-registry"

/**
 * Atai Runtime — TEST-ONLY echo adapter (server-only).
 *
 * Phase 5 §39: proves the full highway (auth → router → scope → registry →
 * adapter → normalized response) without any real provider. This adapter
 * MUST NOT be registered by production code paths — only router tests import
 * registerTestEchoAdapter. It is not registered by default anywhere.
 *
 * @module lib/runtime/router/test-adapter
 */

class TestEchoAdapter implements RuntimeProviderAdapter {
  readonly provider = "test-echo"

  supports(capability: string, operation: string): boolean {
    return capability === "test" && operation === "echo"
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResponse> {
    const input = (request.request.input ?? {}) as { message?: unknown }
    if (typeof input.message !== "string") {
      throw new ProviderExecutionError(
        "unsupported_operation",
        "test/echo requires input.message (string)",
      )
    }
    return {
      provider: this.provider,
      data: { message: input.message },
    }
  }
}

/**
 * Register the test echo adapter. TESTS ONLY — never call from production
 * route handlers or module top-level production code.
 */
export function registerTestEchoAdapter(): void {
  registerProviderAdapter(new TestEchoAdapter())
}
