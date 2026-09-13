/**
 * Test endpoint to debug internal API authentication
 */

import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const internalKey = process.env.ATAI_INTERNAL_KEY
  const providedKey = req.headers.get("x-internal-key")
  
  return NextResponse.json({
    status: "debug",
    env: {
      hasInternalKey: !!internalKey,
      internalKeyPartial: internalKey?.substring(0, 15) + "...",
      internalKeyLength: internalKey?.length,
    },
    request: {
      hasProvidedKey: !!providedKey,
      providedKeyPartial: providedKey?.substring(0, 15) + "...",
      providedKeyLength: providedKey?.length,
    },
    match: providedKey === internalKey,
    exactComparison: {
      expected: internalKey,
      received: providedKey,
      typesMatch: typeof internalKey === typeof providedKey,
    }
  })
}
