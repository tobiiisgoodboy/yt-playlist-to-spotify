import { auth } from "@/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ConvertClient from "./ConvertClient";

export default async function ConvertPage() {
  const session = await auth();
  const cookieStore = await cookies();

  const hasGoogle = !!session?.googleAccessToken;
  const hasSpotify = !!cookieStore.get("spotify_access_token");

  if (!hasGoogle || !hasSpotify) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Konwertuj playlisty</h1>
        <p className="text-gray-400 mb-8">
          Wklej link do playlisty YouTube, aby znalezc odpowiedniki na Spotify.
        </p>
        <ConvertClient />
      </div>
    </main>
  );
}
