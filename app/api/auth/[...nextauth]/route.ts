import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise, { getDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

const authOptions: NextAuthOptions = {
  // Only use MongoDB adapter if connection is available
  ...(clientPromise && { adapter: MongoDBAdapter(clientPromise) }),
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      // Fetch latest token balance on every JWT creation
      if (token.id) {
        try {
          const db = await getDatabase();
          const { ObjectId } = await import('mongodb');
          const dbUser = await db.collection('users').findOne({ 
            _id: typeof token.id === 'string' ? ObjectId.createFromHexString(token.id) : token.id 
          });
          if (dbUser) {
            token.tokens = dbUser.tokens || 0;
          }
        } catch (error: any) {
          // Don't fail JWT creation if token fetch fails
          console.error('Error fetching tokens in JWT:', error.message || error);
          // Keep existing token value or default to 0
          token.tokens = token.tokens || 0;
        }
      }
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
