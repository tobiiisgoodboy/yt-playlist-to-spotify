import "next-auth";

declare module "next-auth" {
  interface Session {
    googleAccessToken?: string;
    spotifyAccessToken?: string;
  }
}
