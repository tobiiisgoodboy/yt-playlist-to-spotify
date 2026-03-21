"use client";

import { useState } from "react";
import { FaYoutube, FaCheck, FaTimes } from "react-icons/fa";

type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  image: string;
  url: string;
};

type MatchedItem = {
  ytTitle: string;
  ytThumbnail: string;
  videoId: string;
  spotifyTracks: SpotifyTrack[];
  selectedTrack: SpotifyTrack | null;
  notFound: boolean;
};

type Stage = "input" | "loading" | "results" | "exporting" | "done";

export default function ConvertClient() {
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<Stage>("input");
  const [items, setItems] = useState<MatchedItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [exportResult, setExportResult] = useState<{
    added: number;
    notFound: number;
    playlistUrl: string;
  } | null>(null);

  async function handleAnalyze() {
    if (!url.trim()) return;
    setError("");
    setStage("loading");
    setProgress(0);
    setItems([]);

    // 1. Fetch YouTube playlist
    const ytRes = await fetch(
      `/api/youtube/playlist?url=${encodeURIComponent(url)}`
    );
    if (!ytRes.ok) {
      const e = await ytRes.json();
      setError(e.error ?? "Blad pobierania playlisty YouTube");
      setStage("input");
      return;
    }
    const { items: ytItems } = await ytRes.json();
    setTotal(ytItems.length);

    // 2. Search Spotify for each track
    const matched: MatchedItem[] = [];
    for (let i = 0; i < ytItems.length; i++) {
      const yt = ytItems[i];
      setProgress(i + 1);

      const spRes = await fetch(
        `/api/spotify/search?title=${encodeURIComponent(yt.title)}`
      );
      let spotifyTracks: SpotifyTrack[] = [];
      if (spRes.ok) {
        const d = await spRes.json();
        spotifyTracks = d.tracks ?? [];
      }

      matched.push({
        ytTitle: yt.title,
        ytThumbnail: yt.thumbnail,
        videoId: yt.videoId,
        spotifyTracks,
        selectedTrack: spotifyTracks[0] ?? null,
        notFound: spotifyTracks.length === 0,
      });
    }

    setItems(matched);
    setStage("results");
  }

  function toggleSelect(index: number, track: SpotifyTrack) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              selectedTrack:
                item.selectedTrack?.id === track.id ? null : track,
              notFound: false,
            }
          : item
      )
    );
  }

  async function handleExport() {
    const selected = items.filter((i) => i.selectedTrack);
    if (selected.length === 0) return;

    setStage("exporting");

    const res = await fetch("/api/spotify/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uris: selected.map((i) => i.selectedTrack!.uri),
        playlistName: `YT Import ${new Date().toLocaleDateString("pl-PL")}`,
      }),
    });

    if (!res.ok) {
      setError("Blad eksportu do Spotify");
      setStage("results");
      return;
    }

    const result = await res.json();
    setExportResult({
      added: selected.length,
      notFound: items.filter((i) => !i.selectedTrack).length,
      playlistUrl: result.playlistUrl,
    });
    setStage("done");
  }

  const selectedCount = items.filter((i) => i.selectedTrack).length;

  // --- Input stage ---
  if (stage === "input") {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Link do playlisty YouTube
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          placeholder="https://www.youtube.com/playlist?list=..."
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
        />
        <button
          onClick={handleAnalyze}
          disabled={!url.trim()}
          className="mt-4 w-full bg-green-500 text-black font-bold py-3 rounded-xl hover:bg-green-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Analizuj playlist
        </button>
      </div>
    );
  }

  // --- Loading stage ---
  if (stage === "loading") {
    const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
    return (
      <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
        <div className="mb-4 text-gray-300">
          {total === 0
            ? "Pobieranie playlisty..."
            : `Wyszukiwanie na Spotify: ${progress} / ${total}`}
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {total > 0 && (
          <div className="mt-2 text-sm text-gray-500">{pct}%</div>
        )}
      </div>
    );
  }

  // --- Done stage ---
  if (stage === "done" && exportResult) {
    return (
      <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-white mb-2">Gotowe!</h2>
        <p className="text-gray-400 mb-6">
          Dodano <span className="text-green-400 font-bold">{exportResult.added}</span> utworow
          {exportResult.notFound > 0 && (
            <>, nie znaleziono <span className="text-red-400 font-bold">{exportResult.notFound}</span></>
          )}
        </p>
        <a
          href={exportResult.playlistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-green-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-green-400 transition-colors mb-4"
        >
          Otworz w Spotify
        </a>
        <br />
        <button
          onClick={() => { setStage("input"); setUrl(""); setItems([]); }}
          className="text-gray-400 hover:text-white text-sm underline"
        >
          Konwertuj kolejna playlisty
        </button>
      </div>
    );
  }

  // --- Results stage ---
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400 text-sm">
          Znaleziono <span className="text-white font-medium">{selectedCount}</span> z{" "}
          <span className="text-white font-medium">{items.length}</span> utworow
        </p>
        <button
          onClick={() => { setStage("input"); setItems([]); }}
          className="text-gray-500 hover:text-white text-sm underline"
        >
          Wróc
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {items.map((item, index) => (
          <div
            key={item.videoId}
            className="bg-gray-900 rounded-xl border border-gray-800 p-4"
          >
            {/* YouTube source */}
            <div className="flex items-center gap-3 mb-3">
              {item.ytThumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.ytThumbnail}
                  alt=""
                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                />
              )}
              <div className="flex items-center gap-2 min-w-0">
                <FaYoutube className="text-red-500 flex-shrink-0" />
                <span className="text-sm text-gray-300 truncate">
                  {item.ytTitle}
                </span>
              </div>
            </div>

            {/* Spotify matches */}
            {item.notFound && item.spotifyTracks.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm px-1">
                <FaTimes className="text-red-500" />
                Nie znaleziono na Spotify
              </div>
            ) : (
              <div className="space-y-2">
                {item.spotifyTracks.map((track) => {
                  const isSelected = item.selectedTrack?.id === track.id;
                  return (
                    <button
                      key={track.id}
                      onClick={() => toggleSelect(index, track)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-colors text-left cursor-pointer ${
                        isSelected
                          ? "border-green-500 bg-green-500/10"
                          : "border-gray-700 hover:border-gray-500"
                      }`}
                    >
                      {track.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={track.image}
                          alt=""
                          className="w-10 h-10 rounded flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">
                          {track.name}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {track.artist} · {track.album}
                        </div>
                      </div>
                      {isSelected && (
                        <FaCheck className="text-green-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={selectedCount === 0 || stage === "exporting"}
        className="w-full bg-green-500 text-black font-bold py-3 rounded-xl hover:bg-green-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {stage === "exporting"
          ? "Eksportowanie..."
          : `Eksportuj ${selectedCount} utworow do Spotify`}
      </button>
    </div>
  );
}
