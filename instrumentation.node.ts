import { isBenignDisconnect } from "@/lib/server/benign-disconnect"

process.on("uncaughtException", (error) => {
  if (isBenignDisconnect(error)) return
})

process.on("unhandledRejection", (reason) => {
  if (isBenignDisconnect(reason)) return
})
