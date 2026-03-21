"use client";

import { useState } from "react";
import { FaYoutube, FaCheck, FaTimes, FaSpotify } from "react-icons/fa";

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

type ExportResult = {
  totalInPlaylist: number;
  selectedByUser: number;
  foundOnSpotify: number;
  notFoundOnSpotify: number;
  deselectedByUser: number;
  playlistUrl: string;
};

function StatCard({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 text-center">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

export default function ConvertClient() {
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<Stage>("input");
  const [items, setItems] = useState<MatchedItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  const selectedCount = items.filter((i) => i.selectedTrack).length;
  const foundCount = items.filter((i) => i.spotifyTracks.length > 0).length;
  const notFoundCount = items.filter((i) => i.spotifyTracks.length === 0).length;

  async function handleAnalyze() {
    if (!url.trim()) return;
    setError("");
    setStage("loading");
    setProgress(0);
    setItems([]);

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
            }
          : item
      )
    );
  }

  function selectAll() {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        selectedTrack: item.spotifyTracks[0] ?? item.selectedTrack,
      }))
    );
  }

  function deselectAll() {
    setItems((prev) =>
      prev.map((item) => ({ ...item, selectedTrack: null }))
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
      totalInPlaylist: items.length,
      selectedByUser: selected.length,
      foundOnSpotify: selected.length,
      notFoundOnSpotify: items.filter((i) => i.spotifyTracks.length === 0).length,
      deselectedByUser: items.filter(
        (i) => i.spotifyTracks.length > 0 && !i.selectedTrack
      ).length,
      playlistUrl: result.playlistUrl,
    });
    setStage("done");
  }

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
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
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
      <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-2xl font-bold text-white">Eksport zakończony!</h2>
          <p className="text-gray-400 mt-1 text-sm">
            Playlista została utworzona na Spotify
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard
            value={exportResult.totalInPlaylist}
            label="w playliście YT"
            color="text-white"
          />
          <StatCard
            value={exportResult.selectedByUser}
            label="wybranych do eksportu"
            color="text-blue-400"
          />
          <StatCard
            value={exportResult.foundOnSpotify}
            label="dodanych do Spotify"
            color="text-green-400"
          />
          <StatCard
            value={exportResult.notFoundOnSpotify + exportResult.deselectedByUser}
            label="pominiętych"
            color="text-red-400"
          />
        </div>

        {/* Breakdown */}
        {(exportResult.notFoundOnSpotify > 0 || exportResult.deselectedByUser > 0) && (
          <div className="bg-gray-800 rounded-xl p-4 mb-6 space-y-2 text-sm">
            <p className="text-gray-400 font-medium mb-2">Szczegóły pominiętych:</p>
            {exportResult.notFoundOnSpotify > 0 && (
              <div className="flex items-center gap-2 text-gray-400">
                <FaTimes className="text-red-400 flex-shrink-0" />
                <span>
                  <span className="text-red-400 font-medium">{exportResult.notFoundOnSpotify}</span>
                  {" "}nie znaleziono na Spotify
                </span>
              </div>
            )}
            {exportResult.deselectedByUser > 0 && (
              <div className="flex items-center gap-2 text-gray-400">
                <FaTimes className="text-yellow-400 flex-shrink-0" />
                <span>
                  <span className="text-yellow-400 font-medium">{exportResult.deselectedByUser}</span>
                  {" "}odznaczonych ręcznie
                </span>
              </div>
            )}
          </div>
        )}

        <a
          href={exportResult.playlistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-green-500 text-black font-bold py-3 rounded-xl hover:bg-green-400 transition-colors mb-3"
        >
          <FaSpotify />
          Otwórz playlistę w Spotify
        </a>
        <button
          onClick={() => {
            setStage("input");
            setUrl("");
            setItems([]);
            setExportResult(null);
          }}
          className="w-full text-gray-400 hover:text-white text-sm py-2 border border-gray-700 rounded-xl hover:border-gray-500 transition-colors"
        >
          Konwertuj kolejną playlistę
        </button>
      </div>
    );
  }

  // --- Results stage ---
  return (
    <div>
      {/* Live stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-white">{items.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">w playliście</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-green-400">{foundCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">na Spotify</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-red-400">{notFoundCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">nie znaleziono</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={selectAll}
          className="flex-1 text-sm py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors cursor-pointer"
        >
          Zaznacz wszystkie
        </button>
        <button
          onClick={deselectAll}
          className="flex-1 text-sm py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors cursor-pointer"
        >
          Odznacz wszystkie
        </button>
        <button
          onClick={() => {
            setStage("input");
            setItems([]);
          }}
          className="text-sm py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-500 rounded-lg border border-gray-700 transition-colors cursor-pointer"
        >
          Wróć
        </button>
      </div>

      {/* Items list */}
      <div className="space-y-3 mb-4">
        {items.map((item, index) => (
          <div
            key={item.videoId || index}
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
            {item.spotifyTracks.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm px-1">
                <FaTimes className="text-red-500 flex-shrink-0" />
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

      {/* Export button */}
      <div className="sticky bottom-4">
        <button
          onClick={handleExport}
          disabled={selectedCount === 0 || stage === "exporting"}
          className="w-full bg-green-500 text-black font-bold py-3 rounded-xl hover:bg-green-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
        >
          {stage === "exporting"
            ? "Eksportowanie..."
            : `Eksportuj ${selectedCount} z ${items.length} utworów do Spotify`}
        </button>
      </div>
    </div>
  );
}
