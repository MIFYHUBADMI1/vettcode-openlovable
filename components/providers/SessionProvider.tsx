"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ReactNode } from "react";

/**
 * Wraps the NextAuth SessionProvider with settings that improve session
 * persistence across client-side navigations.
 *
 * - refetchOnWindowFocus: re-validate the session when the user returns to
 *   the tab, so a stale/unauthenticated state is corrected automatically.
 * - refetchInterval: poll every 5 minutes to keep the JWT fresh during long
 *   sessions and prevent surprise logouts.
 */
export default function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <NextAuthSessionProvider
      refetchOnWindowFocus
      refetchInterval={5 * 60}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
