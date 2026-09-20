import { isBenignDisconnect } from "@/lib/server/benign-disconnect"

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  await import("./instrumentation.node")
}

export function onRequestError(error: { digest?: string } & Error) {
  if (isBenignDisconnect(error)) return
}
