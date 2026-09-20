import { postJson } from "@/lib/client/api"
import type { OnboardingSource } from "@/lib/onboarding/state"

export async function recordOnboardingActivation(input: {
  businessDescription?: string
  source?: OnboardingSource | string
  signalType?: "url" | "idea"
  destination: string
}) {
  await postJson("/api/auth/onboarding", {
    activated: true,
    businessDescription: input.businessDescription,
    source: input.source,
    signalType: input.signalType,
    destination: input.destination,
  })
}

export async function recordOnboardingDismissed() {
  await postJson("/api/auth/onboarding", { dismissed: true })
}
