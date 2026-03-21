import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/youtube",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === "google") {
        token.googleAccessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.googleAccessToken = token.googleAccessToken as string | undefined;
      return session;
    },
  },
});
