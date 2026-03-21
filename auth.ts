import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_at: number;
} | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return {
    access_token: data.access_token,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/youtube",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // On first sign-in, store tokens and expiry
      if (account?.provider === "google") {
        return {
          ...token,
          googleAccessToken: account.access_token,
          googleRefreshToken: account.refresh_token,
          googleExpiresAt: account.expires_at,
        };
      }

      // Token still valid — return as-is
      if (Date.now() / 1000 < (token.googleExpiresAt as number ?? 0) - 60) {
        return token;
      }

      // Token expired — try to refresh
      if (!token.googleRefreshToken) return token;

      const refreshed = await refreshGoogleToken(token.googleRefreshToken as string);
      if (!refreshed) return token;

      return {
        ...token,
        googleAccessToken: refreshed.access_token,
        googleExpiresAt: refreshed.expires_at,
      };
    },
    async session({ session, token }) {
      session.googleAccessToken = token.googleAccessToken as string | undefined;
      return session;
    },
  },
});
