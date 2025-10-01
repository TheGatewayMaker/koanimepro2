import { RequestHandler } from "express";

const JIKAN_BASE = "https://api.jikan.moe/v4";

function mapAnime(a: any) {
  const images = a.images?.jpg || a.images?.webp || {};
  return {
    id: a.mal_id,
    title: a.title || a.title_english || a.title_japanese,
    image: images.large_image_url || images.image_url || images.small_image_url,
    type: a.type || undefined,
    year: a.year ?? a.aired?.prop?.from?.year ?? null,
    rating: typeof a.score === "number" ? a.score : null,
    subDub: "SUB", // Jikan doesn't provide sub/dub; default to SUB
    genres: Array.isArray(a.genres) ? a.genres.map((g: any) => g.name) : [],
    synopsis: a.synopsis || "",
  };
}

function slugify(input: string) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[:"'.,!?&/()\[\]]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

export const getTrending: RequestHandler = async (_req, res) => {
  try {
    const r = await fetch(`${JIKAN_BASE}/top/anime?limit=24`);
    const json = await r.json();
    const results = (json.data || []).map(mapAnime);
    res.json({ results });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to fetch trending" });
  }
};

export const getSearch: RequestHandler = async (req, res) => {
  try {
    const q = String(req.query.q || "");
    if (!q) return res.json({ results: [] });
    const r = await fetch(
      `${JIKAN_BASE}/anime?q=${encodeURIComponent(q)}&limit=20&sfw`,
    );
    const json = await r.json();
    const results = (json.data || []).map((a: any) => ({
      mal_id: a.mal_id,
      title: a.title,
      image_url: a.images?.jpg?.image_url || a.images?.jpg?.small_image_url,
      type: a.type,
      year: a.year ?? a.aired?.prop?.from?.year ?? null,
    }));
    res.json({ results });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Search failed" });
  }
};

export const getInfo: RequestHandler = async (req, res) => {
  try {
    const raw = String(req.params.id || "");

    // Helper to fetch full info by mal id
    async function fetchByMal(malId: string) {
      const r = await fetch(`${JIKAN_BASE}/anime/${malId}/full`);
      if (!r.ok) return null;
      const json = await r.json();
      return json.data ?? null;
    }

    // If numeric id provided, try Jikan directly
    if (/^\d+$/.test(raw)) {
      const data = await fetchByMal(raw);
      if (data) return res.json(mapAnime(data));
    }

    // Not numeric or initial fetch failed: try searching Jikan by title (replace hyphens with spaces)
    const titleQuery = raw.replace(/-/g, " ");
    try {
      const sr = await fetch(
        `${JIKAN_BASE}/anime?q=${encodeURIComponent(titleQuery)}&limit=5`,
      );
      if (sr.ok) {
        const sj = await sr.json();
        const first = (sj.data || [])[0];
        if (first && first.mal_id) {
          const data = await fetchByMal(String(first.mal_id));
          if (data) return res.json(mapAnime(data));
        }
      }
    } catch (e) {
      // ignore
    }

    // Try consumet info lookup by slug across providers
    try {
      const CONSUMET = "https://api.consumet.org";
      const providers = ["gogoanime", "zoro", "animepahe"];
      for (const p of providers) {
        try {
          const url = `${CONSUMET}/anime/${p}/info/${raw}`;
          const r = await fetch(url);
          if (!r.ok) continue;
          const j = await r.json();
          const ep =
            j?.id || j?.mal_id || j?.data?.mal_id || j?.data?.id || null;
          // If we can find mal_id, fetch full from Jikan
          if (ep) {
            const data = await fetchByMal(String(ep));
            if (data) return res.json(mapAnime(data));
          }
          // Otherwise try to map consumet info fields
          const title = j?.title || j?.data?.title || j?.name || null;
          const image = j?.image || j?.poster || j?.data?.image || null;
          if (title) {
            return res.json({
              id: j?.mal_id || null,
              title,
              image,
              type: j?.type || null,
              year: j?.year || null,
              rating: null,
              subDub: null,
              genres: j?.genres || [],
              synopsis: j?.description || j?.data?.description || null,
            });
          }
        } catch (e) {
          // ignore provider errors
        }
      }
    } catch (e) {
      // ignore
    }

    return res.status(404).json({ error: "Not found" });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Info failed" });
  }
};

export const getEpisodes: RequestHandler = async (req, res) => {
  try {
    const id = req.params.id;
    const page = Math.max(1, Number(req.query.page || 1) || 1);

    const r = await fetch(`${JIKAN_BASE}/anime/${id}/episodes?page=${page}`);
    if (!r.ok) {
      return res.status(r.status).json({ episodes: [], pagination: null });
    }
    const json = await r.json();

    const episodes = (json.data || []).map((ep: any) => ({
      id: String(ep.mal_id ?? `${id}-${ep.episode ?? ""}`),
      number:
        typeof ep.episode === "number" ? ep.episode : Number(ep.episode) || 0,
      title: ep.title || ep.title_romanji || ep.title_japanese || undefined,
      air_date: ep.aired || null,
    }));

    const pagination = json.pagination || null;
    return res.json({ episodes, pagination });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Episodes failed" });
  }
};

// Fetch genres from Jikan and cache in-memory for a few minutes
let genresCache: { at: number; items: { id: number; name: string }[] } | null =
  null;
async function getGenresList(): Promise<{ id: number; name: string }[]> {
  const now = Date.now();
  if (genresCache && now - genresCache.at < 5 * 60 * 1000)
    return genresCache.items;
  const r = await fetch(`${JIKAN_BASE}/genres/anime`);
  const json = await r.json();
  const items = (json.data || []).map((g: any) => ({
    id: g.mal_id,
    name: g.name,
  }));
  genresCache = { at: now, items };
  return items;
}

export const getGenres: RequestHandler = async (_req, res) => {
  try {
    const items = await getGenresList();
    res.json({ genres: items });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to fetch genres" });
  }
};

export const getDiscover: RequestHandler = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const order_by = String(req.query.order_by || "popularity");
    const sort = String(req.query.sort || "desc");
    const genre = String(req.query.genre || "").trim();

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("sfw", "true");
    params.set("limit", "24");
    if (q) params.set("q", q);
    if (order_by) params.set("order_by", order_by);
    if (sort) params.set("sort", sort);

    if (genre) {
      const list = await getGenresList();
      const wanted = list.filter(
        (g) => g.name.toLowerCase() === genre.toLowerCase(),
      );
      if (wanted.length > 0)
        params.set("genres", wanted.map((g) => g.id).join(","));
    }

    const r = await fetch(`${JIKAN_BASE}/anime?${params.toString()}`);
    const json = await r.json();
    const results = (json.data || []).map(mapAnime);
    const pagination = json.pagination || {};
    res.json({
      results,
      pagination: {
        page,
        has_next_page: !!pagination.has_next_page,
        last_visible_page: pagination.last_visible_page ?? null,
        items: pagination.items || null,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Discover failed" });
  }
};

export const getStreaming: RequestHandler = async (req, res) => {
  const CONSUMET = "https://api.consumet.org";
  try {
    const id = req.params.id;
    // get title from jikan
    const infoRes = await fetch(`${JIKAN_BASE}/anime/${id}`);
    const infoJson = await infoRes.json();
    const title =
      infoJson?.data?.title ||
      infoJson?.data?.title_english ||
      infoJson?.data?.title_japanese;
    if (!title) return res.json({ links: [] });
    const slug = slugify(title);
    const providers = ["gogoanime", "zoro", "animepahe"];
    const links: { name: string; url: string }[] = [];
    for (const p of providers) {
      try {
        // Some providers have a watch endpoint pattern
        const watchUrl = `${CONSUMET}/anime/${p}/watch/${slug}-episode-1`;
        const r = await fetch(watchUrl);
        if (!r.ok) continue;
        const j = await r.json();
        const sources =
          j?.sources || j?.mirrors || j?.streaming || j?.data || null;
        if (Array.isArray(sources)) {
          // collect provider name and URL(s)
          for (const s of sources) {
            if (s?.url) links.push({ name: p, url: s.url });
            else if (typeof s === "string") links.push({ name: p, url: s });
          }
        } else if (j?.url) {
          links.push({ name: p, url: j.url });
        }
      } catch (e) {
        // ignore provider errors
      }
    }

    // Fallback to Jikan streaming
    if (links.length === 0) {
      try {
        const r2 = await fetch(`${JIKAN_BASE}/anime/${id}/streaming`);
        const j2 = await r2.json();
        const jlinks = (j2.data || []).map((s: any) => ({
          name: s.name,
          url: s.url,
        }));
        links.push(...jlinks);
      } catch (e) {}
    }

    res.json({ links });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Streaming providers failed" });
  }
};

// New releases (current season)
export const getNewReleases: RequestHandler = async (_req, res) => {
  try {
    const r = await fetch(`${JIKAN_BASE}/seasons/now`);
    const json = await r.json();
    const results = (json.data || []).map(mapAnime);
    res.json({ results });
  } catch (e: any) {
    res
      .status(500)
      .json({ error: e?.message || "Failed to fetch new releases" });
  }
};
