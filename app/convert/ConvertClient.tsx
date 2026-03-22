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

type YtItem = { title: string; thumbnail: string; videoId: string };

type SpotifyPlaylist = { id: string; name: string; tracksCount: number; image: string };

type Stage = "input" | "yt-preview" | "searching" | "results" | "export-setup" | "exporting" | "done";
type Filter = "all" | "found" | "notfound" | "deselected";

type ExportResult = {
  totalInPlaylist: number;
  selectedByUser: number;
  notFoundOnSpotify: number;
  deselectedByUser: number;
  playlistUrl: string;
};

const PAGE_SIZE = 25;

const STEP_LABELS = ["YouTube", "Szukanie", "Weryfikacja", "Eksport"];

function StepIndicator({ stage }: { stage: Stage }) {
  const stepMap: Record<Stage, number> = {
    "input": 1, "yt-preview": 1, "searching": 2, "results": 3,
    "export-setup": 4, "exporting": 4, "done": 4,
  };
  const current = stepMap[stage];
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                done ? "bg-green-500 text-black" : active ? "bg-green-500 text-black" : "bg-gray-800 text-gray-500 border border-gray-700"
              }`}>
                {done ? <FaCheck className="text-xs" /> : step}
              </div>
              <span className={`text-xs mt-1 whitespace-nowrap ${active ? "text-white" : "text-gray-500"}`}>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-4 ${done ? "bg-green-500" : "bg-gray-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Pagination({ page, totalPages, showAll, filteredCount, onPrev, onNext, onShowAll, onCollapse }: {
  page: number; totalPages: number; showAll: boolean; filteredCount: number;
  onPrev: () => void; onNext: () => void; onShowAll: () => void; onCollapse: () => void;
}) {
  if (filteredCount <= PAGE_SIZE) return null;
  if (showAll) {
    return (
      <div className="text-center mb-4">
        <button onClick={onCollapse} className="text-xs text-gray-500 hover:text-white underline">
          Powróć do paginacji
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between mb-4">
      <button onClick={onPrev} disabled={page === 1}
        className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
        ← Poprzednia
      </button>
      <div className="flex items-center gap-3 text-sm text-gray-400">
        <span>{page} / {totalPages}</span>
        <button onClick={onShowAll} className="text-gray-500 hover:text-white underline text-xs">
          Pokaż wszystkie ({filteredCount})
        </button>
      </div>
      <button onClick={onNext} disabled={page === totalPages}
        className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
        Następna →
      </button>
    </div>
  );
}

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
  const [ytItems, setYtItems] = useState<YtItem[]>([]);
  const [items, setItems] = useState<MatchedItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [authExpired, setAuthExpired] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Krok 4 state
  const [playlistChoice, setPlaylistChoice] = useState<"new" | "existing">("new");
  const [playlistName, setPlaylistName] = useState("");
  const [existingPlaylists, setExistingPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

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

  function resetAll() {
    setStage("input");
    setUrl("");
    setYtItems([]);
    setItems([]);
    setExportResult(null);
    setFilter("all");
    setPage(1);
    setShowAll(false);
    setPlaylistChoice("new");
    setPlaylistName("");
    setExistingPlaylists([]);
    setSelectedPlaylistId("");
  }

  async function handleFetchYT(targetUrl?: string) {
    const fetchUrl = targetUrl ?? url;
    if (!fetchUrl.trim()) return;
    setError("");
    setStage("yt-preview");
    setYtItems([]);

    const ytRes = await fetch(`/api/youtube/playlist?url=${encodeURIComponent(fetchUrl)}`);
    if (!ytRes.ok) {
      const e = await ytRes.json();
      if (e.code === "AUTH_EXPIRED") {
        setAuthExpired(true);
        setStage("input");
        return;
      }
      setError(e.error ?? "Blad pobierania playlisty YouTube");
      setStage("input");
      return;
    }
    const { items: fetched } = await ytRes.json();
    setYtItems(fetched);
  }

  async function handleStartSpotifySearch() {
    setStage("searching");
    setProgress(0);
    setItems([]);
    setFilter("all");
    setPage(1);
    setShowAll(false);
    setSpotifyError(null);

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const matched: MatchedItem[] = [];
    for (let i = 0; i < ytItems.length; i++) {
      const yt = ytItems[i];
      setProgress(i + 1);

      // Small delay to avoid rate limiting
      if (i > 0) await delay(120);

      let spRes = await fetch(`/api/spotify/search?title=${encodeURIComponent(yt.title)}`);

      // Auto-retry once on 429 after Retry-After seconds
      if (spRes.status === 429) {
        const errData = await spRes.json().catch(() => ({}));
        const waitSec = errData.retryAfter ?? 5;
        setSpotifyError(`Rate limit Spotify — czekam ${waitSec}s i ponawiam... (${i + 1}/${ytItems.length})`);
        await delay(waitSec * 1000);
        setSpotifyError(null);
        spRes = await fetch(`/api/spotify/search?title=${encodeURIComponent(yt.title)}`);
      }

      let spotifyTracks: SpotifyTrack[] = [];

      if (spRes.ok) {
        const d = await spRes.json();
        spotifyTracks = d.tracks ?? [];
      } else if (spRes.status === 429) {
        setSpotifyError(`Spotify nadal blokuje zapytania po ${i} utworach. Poczekaj kilka minut i ponów wyszukiwanie.`);
        for (let j = i; j < ytItems.length; j++) {
          matched.push({ ytTitle: ytItems[j].title, ytThumbnail: ytItems[j].thumbnail, videoId: ytItems[j].videoId, spotifyTracks: [], selectedTrack: null });
        }
        setItems(matched);
        setStage("results");
        return;
      } else if (spRes.status === 401) {
        setSpotifyError("Token Spotify wygasł. Rozłącz i połącz Spotify ponownie.");
        for (let j = i; j < ytItems.length; j++) {
          matched.push({ ytTitle: ytItems[j].title, ytThumbnail: ytItems[j].thumbnail, videoId: ytItems[j].videoId, spotifyTracks: [], selectedTrack: null });
        }
        setItems(matched);
        setStage("results");
        return;
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

  async function handleGoToExportSetup() {
    const defaultName = `YT Import ${new Date().toLocaleDateString("pl-PL")}`;
    setPlaylistName(defaultName);
    setPlaylistChoice("new");
    setSelectedPlaylistId("");
    setStage("export-setup");
    setLoadingPlaylists(true);

    const res = await fetch("/api/spotify/playlists");
    if (res.ok) {
      const data = await res.json();
      setExistingPlaylists(data.playlists ?? []);
      if (data.playlists?.length > 0) setSelectedPlaylistId(data.playlists[0].id);
    }
    setLoadingPlaylists(false);
  }

  async function handleExport() {
    const selected = items.filter((i) => i.selectedTrack);
    if (selected.length === 0) return;
    setStage("exporting");

    const body: Record<string, unknown> = {
      uris: selected.map((i) => i.selectedTrack!.uri),
    };
    if (playlistChoice === "existing" && selectedPlaylistId) {
      body.playlistId = selectedPlaylistId;
    } else {
      body.playlistName = playlistName || `YT Import ${new Date().toLocaleDateString("pl-PL")}`;
    }

    const res = await fetch("/api/spotify/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setError("Blad eksportu do Spotify");
      setStage("export-setup");
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

  // --- Krok 1a: Input ---
  if (stage === "input") {
    return (
      <div>
        <StepIndicator stage={stage} />
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          {authExpired && (
            <div className="mb-4 p-4 bg-yellow-900/40 border border-yellow-700 rounded-xl">
              <p className="text-yellow-300 text-sm font-medium mb-3">
                Sesja Google wygasła. Zaloguj się ponownie, aby kontynuować.
              </p>
              <button
                onClick={() => { window.location.href = "/api/auth/signin"; }}
                className="bg-white text-gray-900 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Zaloguj się ponownie
              </button>
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-xl text-red-300 text-sm">{error}</div>
          )}
          <label className="block text-sm font-medium text-gray-300 mb-2">Link do playlisty YouTube</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFetchYT()}
            placeholder="https://www.youtube.com/playlist?list=..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
          />
          <button
            onClick={() => { const ll = "https://www.youtube.com/playlist?list=LL"; setUrl(ll); handleFetchYT(ll); }}
            className="mt-3 w-full text-sm py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl border border-gray-700 transition-colors cursor-pointer"
          >
            Polubione filmy (LL)
          </button>
          <button
            onClick={() => handleFetchYT()}
            disabled={!url.trim()}
            className="mt-3 w-full bg-green-500 text-black font-bold py-3 rounded-xl hover:bg-green-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Pobierz listę YouTube
          </button>
        </div>
      </div>
    );
  }

  // --- Krok 1b: YT Preview ---
  if (stage === "yt-preview") {
    return (
      <div>
        <StepIndicator stage={stage} />
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-4">
          {ytItems.length === 0 ? (
            <div className="text-center text-gray-400 py-4">Pobieranie playlisty...</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-gray-300 text-sm">
                  Znaleziono <span className="text-white font-semibold">{ytItems.length}</span> filmów
                </p>
                <button
                  onClick={() => { setStage("input"); setYtItems([]); }}
                  className="text-xs text-gray-500 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
                >
                  ← Zmień playlistę
                </button>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {ytItems.map((yt, i) => (
                  <div key={yt.videoId || i} className="flex items-center gap-3">
                    {yt.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={yt.thumbnail} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="flex items-center gap-2 min-w-0">
                      <FaYoutube className="text-red-500 flex-shrink-0 text-sm" />
                      <span className="text-sm text-gray-300 truncate">{yt.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {ytItems.length > 0 && (
          <button
            onClick={handleStartSpotifySearch}
            className="w-full bg-green-500 text-black font-bold py-3 rounded-xl hover:bg-green-400 transition-colors cursor-pointer"
          >
            Dalej — szukaj na Spotify ({ytItems.length} utworów) →
          </button>
        )}
      </div>
    );
  }

  // --- Krok 2: Szukanie Spotify ---
  if (stage === "searching") {
    const pct = ytItems.length > 0 ? Math.round((progress / ytItems.length) * 100) : 0;
    return (
      <div>
        <StepIndicator stage={stage} />
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
          {spotifyError ? (
            <div className="mb-4 text-yellow-400 text-sm">{spotifyError}</div>
          ) : (
            <div className="mb-4 text-gray-300">
              Wyszukiwanie na Spotify: {progress} / {ytItems.length}
            </div>
          )}
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 text-sm text-gray-500">{pct}%</div>
        </div>
      </div>
    );
  }

  // --- Krok 4: Export Setup ---
  if (stage === "export-setup" || stage === "exporting") {
    const selectedPlaylist = existingPlaylists.find((p) => p.id === selectedPlaylistId);
    return (
      <div>
        <StepIndicator stage={stage} />
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-5">Gdzie zapisać playlistę?</h2>

          {/* Choice */}
          <div className="space-y-3 mb-6">
            <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
              playlistChoice === "new" ? "border-green-500 bg-green-500/10" : "border-gray-700 hover:border-gray-500"
            }`}>
              <input
                type="radio"
                name="playlist-choice"
                value="new"
                checked={playlistChoice === "new"}
                onChange={() => setPlaylistChoice("new")}
                className="accent-green-500"
              />
              <span className="text-white font-medium">Nowa playlista</span>
            </label>

            <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
              playlistChoice === "existing" ? "border-green-500 bg-green-500/10" : "border-gray-700 hover:border-gray-500"
            }`}>
              <input
                type="radio"
                name="playlist-choice"
                value="existing"
                checked={playlistChoice === "existing"}
                onChange={() => setPlaylistChoice("existing")}
                className="accent-green-500"
              />
              <span className="text-white font-medium">Istniejąca playlista</span>
            </label>
          </div>

          {/* New playlist name */}
          {playlistChoice === "new" && (
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Nazwa playlisty</label>
              <input
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>
          )}

          {/* Existing playlist picker */}
          {playlistChoice === "existing" && (
            <div className="mb-6">
              {loadingPlaylists ? (
                <div className="text-gray-500 text-sm text-center py-4">Ładowanie playlist...</div>
              ) : existingPlaylists.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-4">Brak playlist na Spotify</div>
              ) : (
                <>
                  <label className="block text-sm text-gray-400 mb-2">Wybierz playlistę</label>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {existingPlaylists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => setSelectedPlaylistId(pl.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left cursor-pointer ${
                          selectedPlaylistId === pl.id
                            ? "border-green-500 bg-green-500/10"
                            : "border-gray-700 hover:border-gray-500"
                        }`}
                      >
                        {pl.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pl.image} alt="" className="w-10 h-10 rounded flex-shrink-0 object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-700 flex-shrink-0 flex items-center justify-center">
                            <FaSpotify className="text-gray-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate">{pl.name}</div>
                          <div className="text-xs text-gray-500">{pl.tracksCount} utworów</div>
                        </div>
                        {selectedPlaylistId === pl.id && <FaCheck className="text-green-500 flex-shrink-0 ml-auto" />}
                      </button>
                    ))}
                  </div>
                  {selectedPlaylist && (
                    <p className="text-xs text-gray-500 mt-2">
                      Utwory zostaną dodane do istniejącej playlisty &ldquo;{selectedPlaylist.name}&rdquo;
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-xl text-red-300 text-sm">{error}</div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStage("results")}
              disabled={stage === "exporting"}
              className="flex-1 text-sm py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl border border-gray-700 transition-colors cursor-pointer disabled:opacity-40"
            >
              ← Wróć
            </button>
            <button
              onClick={handleExport}
              disabled={
                stage === "exporting" ||
                (playlistChoice === "existing" && !selectedPlaylistId) ||
                selectedCount === 0
              }
              className="flex-2 flex-grow-[2] bg-green-500 text-black font-bold py-3 rounded-xl hover:bg-green-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {stage === "exporting"
                ? "Eksportowanie..."
                : `Eksportuj ${selectedCount} utworów do Spotify`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Krok 4: Done ---
  if (stage === "done" && exportResult) {
    return (
      <div>
        <StepIndicator stage={stage} />
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
            onClick={resetAll}
            className="w-full text-gray-400 hover:text-white text-sm py-2 border border-gray-700 rounded-xl hover:border-gray-500 transition-colors"
          >
            Konwertuj kolejną playlistę
          </button>
        </div>
      </div>
    );
  }

  // --- Krok 3: Results ---
  return (
    <div>
      <StepIndicator stage="results" />

      {/* Spotify error banner */}
      {spotifyError && (
        <div className="mb-4 p-4 bg-yellow-900/40 border border-yellow-700 rounded-xl">
          <p className="text-yellow-300 text-sm mb-3">{spotifyError}</p>
          <button
            onClick={handleStartSpotifySearch}
            className="bg-green-500 text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-green-400 transition-colors cursor-pointer"
          >
            Ponów wyszukiwanie Spotify
          </button>
        </div>
      )}

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
        <button onClick={() => setStage("yt-preview")}
          className="text-sm py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-500 rounded-lg border border-gray-700 transition-colors cursor-pointer">
          ← Wróć
        </button>
      </div>

      <Pagination page={page} totalPages={totalPages} showAll={showAll} filteredCount={filteredItems.length}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        onShowAll={() => setShowAll(true)}
        onCollapse={() => { setShowAll(false); setPage(1); }} />

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
                        {track.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={track.image} alt="" className="w-10 h-10 rounded flex-shrink-0" />
                        )}
                        <button
                          onClick={() => toggleSelect(globalIndex, track)}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <div className="text-sm text-white truncate">{track.name}</div>
                          <div className="text-xs text-gray-400 truncate">{track.artist} · {track.album}</div>
                        </button>
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

      <Pagination page={page} totalPages={totalPages} showAll={showAll} filteredCount={filteredItems.length}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        onShowAll={() => setShowAll(true)}
        onCollapse={() => { setShowAll(false); setPage(1); }} />

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-xl text-red-300 text-sm">{error}</div>
      )}

      {/* Export button */}
      <div className="sticky bottom-4">
        <button
          onClick={handleGoToExportSetup}
          disabled={selectedCount === 0}
          className="w-full bg-green-500 text-black font-bold py-3 rounded-xl hover:bg-green-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
        >
          Dalej — eksportuj {selectedCount} z {items.length} utworów →
        </button>
      </div>
    </div>
  );
}
