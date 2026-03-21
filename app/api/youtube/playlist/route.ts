import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

function parsePlaylistId(input: string): string | null {
  try {
    const url = new URL(input);
    // youtube.com/playlist?list=...
    const list = url.searchParams.get("list");
    if (list) return list;
    // youtu.be or other formats
  } catch {
    // maybe raw playlist ID was passed
    if (/^[A-Za-z0-9_-]{10,}$/.test(input)) return input;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.googleAccessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  const playlistId = parsePlaylistId(url);
  if (!playlistId) {
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  const items: { title: string; videoId: string; thumbnail: string }[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      {
        headers: { Authorization: `Bearer ${session.googleAccessToken}` },
      }
    );

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json(
        { error: err?.error?.message ?? "YouTube API error" },
        { status: res.status }
      );
    }

    const data = await res.json();
    pageToken = data.nextPageToken;

    for (const item of data.items ?? []) {
      const snippet = item.snippet;
      // skip deleted/private videos
      if (
        snippet.title === "Deleted video" ||
        snippet.title === "Private video"
      )
        continue;

      items.push({
        title: snippet.title,
        videoId: snippet.resourceId?.videoId ?? "",
        thumbnail:
          snippet.thumbnails?.default?.url ??
          snippet.thumbnails?.medium?.url ??
          "",
      });
    }
  } while (pageToken && items.length < 500);

  return NextResponse.json({ items });
}
