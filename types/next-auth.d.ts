import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      tokens?: number;
    };
  }

  interface User {
    id: string;
    tokens?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    tokens?: number;
  }
}
