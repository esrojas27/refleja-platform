/** Extract only a video identifier; never forward user-controlled iframe parameters. */
export function youtubeVideoId(value: string): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const segments = url.pathname.split("/").filter(Boolean);
    let candidate: string | null = null;
    if (["youtu.be", "www.youtu.be"].includes(url.hostname) && segments.length === 1) {
      candidate = segments[0];
    } else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      if (url.pathname === "/watch") candidate = url.searchParams.get("v");
      else if (segments.length === 2 && ["shorts", "embed", "live"].includes(segments[0])) candidate = segments[1];
    } else if (["youtube-nocookie.com", "www.youtube-nocookie.com"].includes(url.hostname)
      && segments.length === 2 && segments[0] === "embed") candidate = segments[1];
    return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function isYoutubeVideoUrl(value: string) {
  return value === "" || youtubeVideoId(value) !== null;
}
