"use client";

import { useState, useRef } from "react";
import { FaYoutube, FaCheck, FaTimes, FaSpotify, FaPlay, FaPause } from "react-icons/fa";

type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  image: string;
  url: string;
  previewUrl: string | null;
};

type MatchedItem = {
  ytTitle: string;
  ytThumbnail: string;
  videoId: string;
  spotifyTracks: SpotifyTrack[];
  selectedTrack: SpotifyTrack | null;
};

type Stage = "input" | "loading" | "results" | "exporting" | "done";
type Filter = "all" | "found" | "notfound" | "deselected";

type ExportResult = {
  totalInPlaylist: number;
  selectedByUser: number;
  notFoundOnSpotify: number;
  deselectedByUser: number;
  playlistUrl: string;
};

const PAGE_SIZE = 25;

function StatCard({ value, label, color, active, onClick }: {
  value: number; label: string; color: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl p-3 text-center transition-all ${onClick ? "cursor-pointer" : "cursor-default"} ${
        active ? "ring-2 ring-white/40 bg-gray-700" : "bg-gray-900 border border-gray-800"
      }`}
    >
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </button>
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
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedCount = items.filter((i) => i.selectedTrack).length;
  const foundCount = items.filter((i) => i.spotifyTracks.length > 0).length;
  const notFoundCount = items.filter((i) => i.spotifyTracks.length === 0).length;
  const deselectedCount = items.filter((i) => i.spotifyTracks.length > 0 && !i.selectedTrack).length;

  const filteredItems = items.filter((item) => {
    if (filter === "found") return item.spotifyTracks.length > 0;
    if (filter === "notfound") return item.spotifyTracks.length === 0;
    if (filter === "deselected") return item.spotifyTracks.length > 0 && !item.selectedTrack;
    return true;
  });

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const pagedItems = showAll ? filteredItems : filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function changeFilter(f: Filter) {
    setFilter(f);
    setPage(1);
    setShowAll(false);
  }

  function playPreview(previewUrl: string) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingUrl === previewUrl) {
      setPlayingUrl(null);
      return;
    }
    const audio = new Audio(previewUrl);
    audio.play();
    audio.onended = () => setPlayingUrl(null);
    audioRef.current = audio;
    setPlayingUrl(previewUrl);
  }

  async function handleAnalyze() {
    if (!url.trim()) return;
    setError("");
    setStage("loading");
    setProgress(0);
    setItems([]);
    setFilter("all");
    setPage(1);
    setShowAll(false);

    const ytRes = await fetch(`/api/youtube/playlist?url=${encodeURIComponent(url)}`);
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

      const spRes = await fetch(`/api/spotify/search?title=${encodeURIComponent(yt.title)}`);
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
      });
    }

    setItems(matched);
    setStage("results");
  }

  function toggleSelect(globalIndex: number, track: SpotifyTrack) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === globalIndex
          ? { ...item, selectedTrack: item.selectedTrack?.id === track.id ? null : track }
          : item
      )
    );
  }

  function selectAll() {
    setItems((prev) => prev.map((item) => ({
      ...item,
      selectedTrack: item.spotifyTracks[0] ?? item.selectedTrack,
    })));
  }

  function deselectAll() {
    setItems((prev) => prev.map((item) => ({ ...item, selectedTrack: null })));
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
      notFoundOnSpotify: items.filter((i) => i.spotifyTracks.length === 0).length,
      deselectedByUser: items.filter((i) => i.spotifyTracks.length > 0 && !i.selectedTrack).length,
      playlistUrl: result.playlistUrl,
    });
    setStage("done");
  }

  // --- Input ---
  if (stage === "input") {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-xl text-red-300 text-sm">{error}</div>
        )}
        <label className="block text-sm font-medium text-gray-300 mb-2">Link do playlisty YouTube</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          placeholder="https://www.youtube.com/playlist?list=..."
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
        />
        <button
          onClick={() => { setUrl("https://www.youtube.com/playlist?list=LL"); setTimeout(handleAnalyze, 0); }}
          className="mt-3 w-full text-sm py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl border border-gray-700 transition-colors cursor-pointer"
        >
          Polubione filmy (LL)
        </button>
        <button
          onClick={handleAnalyze}
          disabled={!url.trim()}
          className="mt-3 w-full bg-green-500 text-black font-bold py-3 rounded-xl hover:bg-green-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Analizuj playlistę
        </button>
      </div>
    );
  }

  // --- Loading ---
  if (stage === "loading") {
    const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
    return (
      <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
        <div className="mb-4 text-gray-300">
          {total === 0 ? "Pobieranie playlisty..." : `Wyszukiwanie na Spotify: ${progress} / ${total}`}
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        {total > 0 && <div className="mt-2 text-sm text-gray-500">{pct}%</div>}
      </div>
    );
  }

  // --- Done ---
  if (stage === "done" && exportResult) {
    return (
      <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-2xl font-bold text-white">Eksport zakończony!</h2>
          <p className="text-gray-400 mt-1 text-sm">Playlista została utworzona na Spotify</p>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard value={exportResult.totalInPlaylist} label="w playliście YT" color="text-white" />
          <StatCard value={exportResult.selectedByUser} label="dodanych do Spotify" color="text-green-400" />
          <StatCard value={exportResult.notFoundOnSpotify} label="nie znaleziono" color="text-red-400" />
          <StatCard value={exportResult.deselectedByUser} label="odznaczonych ręcznie" color="text-yellow-400" />
        </div>
        <a
          href={exportResult.playlistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-green-500 text-black font-bold py-3 rounded-xl hover:bg-green-400 transition-colors mb-3"
        >
          <FaSpotify /> Otwórz playlistę w Spotify
        </a>
        <button
          onClick={() => { setStage("input"); setUrl(""); setItems([]); setExportResult(null); }}
          className="w-full text-gray-400 hover:text-white text-sm py-2 border border-gray-700 rounded-xl hover:border-gray-500 transition-colors"
        >
          Konwertuj kolejną playlistę
        </button>
      </div>
    );
  }

  // --- Results ---
  return (
    <div>
      {/* Stats + filtry */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatCard value={items.length} label="wszystkie" color="text-white"
          active={filter === "all"} onClick={() => changeFilter("all")} />
        <StatCard value={foundCount} label="na Spotify" color="text-green-400"
          active={filter === "found"} onClick={() => changeFilter("found")} />
        <StatCard value={notFoundCount} label="nie znaleziono" color="text-red-400"
          active={filter === "notfound"} onClick={() => changeFilter("notfound")} />
        <StatCard value={deselectedCount} label="odznaczone" color="text-yellow-400"
          active={filter === "deselected"} onClick={() => changeFilter("deselected")} />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <button onClick={selectAll}
          className="flex-1 text-sm py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors cursor-pointer">
          Zaznacz wszystkie
        </button>
        <button onClick={deselectAll}
          className="flex-1 text-sm py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors cursor-pointer">
          Odznacz wszystkie
        </button>
        <button onClick={() => { setStage("input"); setItems([]); }}
          className="text-sm py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-500 rounded-lg border border-gray-700 transition-colors cursor-pointer">
          Wróć
        </button>
      </div>

      {/* Items list */}
      <div className="space-y-3 mb-4">
        {pagedItems.map((item) => {
          const globalIndex = items.indexOf(item);
          return (
            <div key={item.videoId || globalIndex} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              {/* YouTube row */}
              <div className="flex items-center gap-3 mb-3">
                {item.ytThumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.ytThumbnail} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                )}
                <div className="flex items-center gap-2 min-w-0">
                  <FaYoutube className="text-red-500 flex-shrink-0" />
                  <span className="text-sm text-gray-300 truncate">{item.ytTitle}</span>
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
                    const isPlaying = playingUrl === track.previewUrl;
                    return (
                      <div
                        key={track.id}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                          isSelected ? "border-green-500 bg-green-500/10" : "border-gray-700 hover:border-gray-500"
                        }`}
                      >
                        {/* Album art */}
                        {track.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={track.image} alt="" className="w-10 h-10 rounded flex-shrink-0" />
                        )}

                        {/* Track info — clickable to select */}
                        <button
                          onClick={() => toggleSelect(globalIndex, track)}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <div className="text-sm text-white truncate">{track.name}</div>
                          <div className="text-xs text-gray-400 truncate">{track.artist} · {track.album}</div>
                        </button>

                        {/* Preview button */}
                        <button
                          onClick={() => track.previewUrl && playPreview(track.previewUrl)}
                          disabled={!track.previewUrl}
                          title={track.previewUrl ? "Odtwórz 30s" : "Brak podglądu"}
                          className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                            track.previewUrl
                              ? isPlaying
                                ? "bg-green-500 text-black"
                                : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                              : "bg-gray-800 text-gray-600 cursor-not-allowed"
                          }`}
                        >
                          {isPlaying ? <FaPause className="text-xs" /> : <FaPlay className="text-xs" />}
                        </button>

                        {isSelected && <FaCheck className="text-green-500 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Paginacja */}
      {!showAll && filteredItems.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            ← Poprzednia
          </button>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>{page} / {totalPages}</span>
            <button
              onClick={() => setShowAll(true)}
              className="text-gray-500 hover:text-white underline text-xs"
            >
              Pokaż wszystkie ({filteredItems.length})
            </button>
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Następna →
          </button>
        </div>
      )}
      {showAll && (
        <div className="text-center mb-4">
          <button onClick={() => { setShowAll(false); setPage(1); }}
            className="text-xs text-gray-500 hover:text-white underline">
            Powróć do paginacji
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-xl text-red-300 text-sm">{error}</div>
      )}

      {/* Export button */}
      <div className="sticky bottom-4">
        <button
          onClick={handleExport}
          disabled={selectedCount === 0 || stage === "exporting"}
          className="w-full bg-green-500 text-black font-bold py-3 rounded-xl hover:bg-green-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
        >
          {stage === "exporting" ? "Eksportowanie..." : `Eksportuj ${selectedCount} z ${items.length} utworów do Spotify`}
        </button>
      </div>
    </div>
  );
}
