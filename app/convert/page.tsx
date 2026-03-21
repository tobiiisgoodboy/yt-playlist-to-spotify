import { auth } from "@/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Link do playlisty YouTube
          </label>
          <input
            type="url"
            placeholder="https://www.youtube.com/playlist?list=..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
          />
          <button className="mt-4 w-full bg-green-500 text-black font-bold py-3 rounded-xl hover:bg-green-400 transition-colors cursor-pointer">
            Analizuj playlisty
          </button>
        </div>
      </div>
    </main>
  );
}
