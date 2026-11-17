export type VideoSource = "youtube" | "vimeo";
export interface ParsedVideo { source: VideoSource; id: string; embedUrl: string; thumbnail: string | null; watchUrl: string }

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Accepts only YouTube and Vimeo URLs; returns a privacy-friendly embed URL. Anything else -> null. */
export function parseVideoUrl(raw: string): ParsedVideo | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else { const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/); id = m?.[1] ?? null; }
  }
  if (id && YT_ID.test(id)) return { source: "youtube", id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1`, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, watchUrl: `https://www.youtube.com/watch?v=${id}` };
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(?:video\/)?(\d{5,12})(?:\/|$)/);
    if (m) return { source: "vimeo", id: m[1], embedUrl: `https://player.vimeo.com/video/${m[1]}?autoplay=1&dnt=1`, thumbnail: null, watchUrl: `https://vimeo.com/${m[1]}` };
  }
  return null;
}
