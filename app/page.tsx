import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import { FaYoutube, FaSpotify } from "react-icons/fa";

export default async function Home() {
  const session = await auth();

  const hasGoogle = !!session?.googleAccessToken;
  const hasSpotify = !!session?.spotifyAccessToken;

  if (hasGoogle && hasSpotify) {
    redirect("/convert");
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-3">YT → Spotify</h1>
          <p className="text-gray-400">
            Polacz YouTube i Spotify, aby konwertowac playlisty.
          </p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-8 space-y-4 border border-gray-800">
          {/* Google */}
          <div className="flex items-center gap-4">
            <div
              className={`w-3 h-3 rounded-full flex-shrink-0 ${
                hasGoogle ? "bg-green-500" : "bg-gray-600"
              }`}
            />
            <span className="text-gray-300 flex-1 flex items-center gap-2">
              <FaYoutube className="text-red-500 text-xl" />
              YouTube{hasGoogle ? " — polaczono" : ""}
            </span>
            {!hasGoogle && (
              <form
                action={async () => {
                  "use server";
                  await signIn("google");
                }}
              >
                <button
                  type="submit"
                  className="bg-white text-gray-900 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Polacz
                </button>
              </form>
            )}
          </div>

          {/* Spotify */}
          <div className="flex items-center gap-4">
            <div
              className={`w-3 h-3 rounded-full flex-shrink-0 ${
                hasSpotify ? "bg-green-500" : "bg-gray-600"
              }`}
            />
            <span className="text-gray-300 flex-1 flex items-center gap-2">
              <FaSpotify className="text-green-500 text-xl" />
              Spotify{hasSpotify ? " — polaczono" : ""}
            </span>
            {!hasSpotify && (
              <form
                action={async () => {
                  "use server";
                  await signIn("spotify");
                }}
              >
                <button
                  type="submit"
                  className="bg-green-500 text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-green-400 transition-colors cursor-pointer"
                >
                  Polacz
                </button>
              </form>
            )}
          </div>

          {hasGoogle && hasSpotify && (
            <a
              href="/convert"
              className="block w-full text-center bg-green-500 text-black font-bold py-3 rounded-xl hover:bg-green-400 transition-colors mt-4"
            >
              Konwertuj playlisty
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
