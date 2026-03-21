import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Spotify from "next-auth/providers/spotify";

const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-modify-private",
].join(" ");

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/youtube.readonly",
        },
      },
    }),
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: { scope: SPOTIFY_SCOPES },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === "google") {
        token.googleAccessToken = account.access_token;
      }
      if (account?.provider === "spotify") {
        token.spotifyAccessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.googleAccessToken = token.googleAccessToken as string | undefined;
      session.spotifyAccessToken = token.spotifyAccessToken as
        | string
        | undefined;
      return session;
    },
  },
});
