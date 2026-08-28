import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { getDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

/**
 * Ensure NEXTAUTH_URL is environment-aware.
 *
 * NextAuth v4 derives its base URL solely from the `NEXTAUTH_URL`
 * environment variable. A hardcoded production URL in `.env.local`
 * (e.g. https://mirrorsiteai.vercel.app) causes session cookies to be
 * scoped to the wrong origin when running locally, which is the most
 * common cause of "sessions not persisting" on localhost.
 *
 * In production we fall back to Vercel's VERCEL_URL when NEXTAUTH_URL
 * is absent. In development we always use localhost.
 */
if (!process.env.NEXTAUTH_URL) {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_URL) {
    process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
  } else if (process.env.NODE_ENV !== 'production') {
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  }
} else if (
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXTAUTH_URL.startsWith('https://')
) {
  // An https URL in a non-production environment almost certainly means
  // the developer copied a production .env — override to localhost.
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
}

export const authOptions: NextAuthOptions = {
  // JWT strategy — no database adapter. The MongoDB adapter is meant for
  // database-session strategy and conflicts with `strategy: 'jwt'`, causing
  // subtle state-reset bugs when the DB is briefly unreachable.
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter email and password');
        }

        try {
          const db = await getDatabase();
          const user = await db.collection('users').findOne({ email: credentials.email });

          if (!user) {
            throw new Error('No user found with this email');
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

          if (!isPasswordValid) {
            throw new Error('Invalid password');
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error('Authentication error:', error);
          // Re-throw the original error to show the actual message
          throw error;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    signOut: '/',
  },
  callbacks: {
    /**
     * The JWT callback runs on EVERY request. We therefore only hit the
     * database when `user` is present — i.e. on the initial sign-in — and
     * keep the cached value on subsequent token rotations. This prevents
     * transient DB errors from resetting `token.tokens` to 0 mid-session,
     * which previously made sessions appear to "drop".
     */
    async jwt({ token, user }) {
      // Initial sign-in: persist the user id and fetch token balance.
      if (user) {
        token.id = user.id;
        try {
          const db = await getDatabase();
          const { ObjectId } = await import('mongodb');
          const dbUser = await db.collection('users').findOne({
            _id: typeof token.id === 'string'
              ? ObjectId.createFromHexString(token.id)
              : token.id,
          });
          if (dbUser) {
            token.tokens = dbUser.tokens || 0;
          }
        } catch (error: any) {
          console.error('Error fetching tokens on sign-in JWT:', error.message || error);
          token.tokens = token.tokens || 0;
        }
      }
      // On subsequent calls `user` is undefined — keep the existing token.
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tokens = (token.tokens as number) || 0;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
