import { RequestHandler } from "express";

const JIKAN_BASE = "https://api.jikan.moe/v4";

// Simple in-memory cache for episodes to mitigate upstream rate limits
const EPISODES_TTL_MS = 3 * 60 * 1000;
const episodesCache: Record<
  string,
  { at: number; data: { episodes: any[]; pagination: any } }
> = {};

function normalizeBaseTitle(title: string) {
  let s = String(title || "").trim();
  s = s.replace(/\s*-\s*(Season|Cour|Part)\s*\d+$/i, "");
  s = s.replace(/\s*\(\s*(Season|Cour|Part)\s*\d+\s*\)$/i, "");
  s = s.replace(/\s*\b(\d+)(st|nd|rd|th)\s+Season\b.*$/i, "");
  s = s.replace(/\s*\bSeason\s+\d+(?:\s*Part\s*\d+)?\b.*$/i, "");
  s = s.replace(/\s*\bFinal Season(?:\s*Part\s*\d+)?\b.*$/i, "");
  s = s.replace(/\s+(?:II|III|IV|V|VI|VII|VIII|IX|X)$/i, "");
  s = s.replace(/\s+\d+$/i, "");
  return s.trim();
}

function mapAnime(a: any) {
  const images = a.images?.jpg || a.images?.webp || {};
  const originalTitle = a.title || a.title_english || a.title_japanese || "";
  const baseTitle = normalizeBaseTitle(originalTitle);
  const nowYear = new Date().getFullYear();
  const year = a.year ?? a.aired?.prop?.from?.year ?? null;
  const airing = a.airing === true || a.status === "Currently Airing";
  const seasonMarker =
    /(season\s*\d+|part\s*\d+|cour\s*\d+|final\s*season|\bii\b|\biii\b|\biv\b|\bv\b|\bvi\b|\bvii\b|\bviii\b|\bix\b|\bx\b|\d+\s*$)/i.test(
      originalTitle,
    );
  const isNewSeason = seasonMarker && (airing || year === nowYear);
  return {
    id: a.mal_id,
    title: baseTitle,
    image: images.large_image_url || images.image_url || images.small_image_url,
    type: a.type || undefined,
    year,
    rating: typeof a.score === "number" ? a.score : null,
    subDub: "SUB",
    genres: Array.isArray(a.genres) ? a.genres.map((g: any) => g.name) : [],
    synopsis: a.synopsis || "",
    isNewSeason,
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

    function pickRelation(rel: any) {
      if (!rel || !Array.isArray(rel.entry)) return null;
      const tv = rel.entry.find((x: any) => x.type === "TV");
      const chosen = tv || rel.entry[0];
      return chosen ? { id: chosen.mal_id, title: chosen.name } : null;
    }

    async function buildSeasonsChain(
      startData: any,
    ): Promise<{ ids: number[]; titles: Record<number, string> }> {
      const seen = new Set<number>();
      const titles: Record<number, string> = {};
      let current = startData;
      let currentId = Number(current.mal_id);
      titles[currentId] =
        current.title || current.title_english || current.title_japanese;

      // Walk back to base via prequels
      const back: number[] = [];
      let node = current;
      for (let i = 0; i < 8; i++) {
        const preRel = node.relations?.find?.(
          (r: any) => r.relation === "Prequel",
        );
        const pre = pickRelation(preRel);
        if (!pre || seen.has(pre.id)) break;
        seen.add(pre.id);
        back.push(pre.id);
        const full = await fetchByMal(String(pre.id));
        if (!full) break;
        titles[pre.id] =
          full.title || full.title_english || full.title_japanese;
        node = full;
      }

      // Base is last back or current
      const chain: number[] = [...back.reverse(), currentId];

      // Walk forward from current/base via sequels
      node = current;
      for (let i = 0; i < 8; i++) {
        const seqRel = node.relations?.find?.(
          (r: any) => r.relation === "Sequel",
        );
        const seq = pickRelation(seqRel);
        if (!seq || seen.has(seq.id)) break;
        seen.add(seq.id);
        const full = await fetchByMal(String(seq.id));
        if (!full) break;
        titles[seq.id] =
          full.title || full.title_english || full.title_japanese;
        chain.push(seq.id);
        node = full;
      }

      return { ids: chain, titles };
    }

    // If numeric id provided, try Jikan directly
    if (/^\d+$/.test(raw)) {
      const data = await fetchByMal(raw);
      if (data) {
        const base = mapAnime(data);
        const chain = await buildSeasonsChain(data).catch(() => null);
        const seasons = chain
          ? chain.ids.map((id, i) => ({
              id,
              number: i + 1,
              title: normalizeBaseTitle(chain.titles[id] || ""),
            }))
          : [];
        return res.json({ ...base, seasons });
      }
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
            if (data) {
              const base = mapAnime(data);
              const chain = await buildSeasonsChain(data).catch(() => null);
              const seasons = chain
                ? chain.ids.map((id, i) => ({
                    id,
                    number: i + 1,
                    title: normalizeBaseTitle(chain.titles[id] || ""),
                  }))
                : [];
              return res.json({ ...base, seasons });
            }
          }
          // Otherwise try to map consumet info fields
          const title = j?.title || j?.data?.title || j?.name || null;
          const image = j?.image || j?.poster || j?.data?.image || null;
          if (title) {
            return res.json({
              id: j?.mal_id || null,
              title: normalizeBaseTitle(title),
              image,
              type: j?.type || null,
              year: j?.year || null,
              rating: null,
              subDub: null,
              genres: j?.genres || [],
              synopsis: j?.description || j?.data?.description || null,
              seasons: [],
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
    const cacheKey = `${id}:${page}`;
    const now = Date.now();
    const cached = episodesCache[cacheKey];
    if (cached && now - cached.at < EPISODES_TTL_MS) {
      return res.json(cached.data);
    }

    // Helper: fetch with timeout and simple 429 retry
    async function fetchJson(url: string, timeoutMs = 8000, retries = 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const r = await fetch(url, { signal: controller.signal });
        if (r.status === 429 && retries > 0) {
          await new Promise((r) => setTimeout(r, 500));
          return fetchJson(url, timeoutMs, retries - 1);
        }
        if (!r.ok) return { ok: false, status: r.status, json: null } as const;
        const j = await r.json();
        return { ok: true, status: r.status, json: j } as const;
      } finally {
        clearTimeout(timer);
      }
    }

    // 1) Primary: Jikan episodes
    const primary = await fetchJson(
      `${JIKAN_BASE}/anime/${id}/episodes?page=${page}`,
    );
    if (primary.ok) {
      const j = primary.json as any;
      const episodes = (j.data || []).map((ep: any, idx: number) => {
        const numRaw = ep.episode;
        const num = typeof numRaw === "number" ? numRaw : Number(numRaw) || 0;
        return {
          id: String(ep.mal_id ?? `${id}-${num || idx + 1}`),
          number: num > 0 ? num : idx + 1,
          title: ep.title || ep.title_romanji || ep.title_japanese || undefined,
          air_date: ep.aired || null,
        };
      });
      const payload = { episodes, pagination: j.pagination || null };
      // Cache even empty to avoid hammering the API
      episodesCache[cacheKey] = { at: now, data: payload };
      // If we have results, return immediately
      if (episodes.length > 0) return res.json(payload);
    }

    // 2) Fallback: derive slug from Jikan title and try a single provider list via Consumet
    const infoRes = await fetchJson(`${JIKAN_BASE}/anime/${id}`);
    const title =
      infoRes.ok && (infoRes.json as any)?.data
        ? (infoRes.json as any).data.title ||
          (infoRes.json as any).data.title_english ||
          (infoRes.json as any).data.title_japanese
        : null;
    if (title) {
      const slug = slugify(title);
      const providers = ["gogoanime", "zoro", "animepahe"];
      for (const p of providers) {
        const infoUrl = `https://api.consumet.org/anime/${p}/info/${slug}`;
        const c = await fetchJson(infoUrl, 8000, 0);
        if (c.ok) {
          const arr =
            (c.json as any)?.episodes ||
            (c.json as any)?.data?.episodes ||
            (c.json as any)?.results ||
            null;
          if (Array.isArray(arr) && arr.length > 0) {
            const episodes = arr.map((ep: any) => {
              const number =
                ep.number ?? ep.episode ?? ep.ep ?? ep.index ?? null;
              const title =
                ep.title ||
                ep.name ||
                ep.episodeTitle ||
                ep.title_english ||
                undefined;
              const air_date = ep.air_date ?? ep.aired ?? ep.date ?? null;
              const eid = ep.id ?? `${id}-${number ?? "0"}`;
              return {
                id: String(eid),
                number:
                  typeof number === "number" ? number : Number(number) || 0,
                title,
                air_date,
              };
            });
            const perPage = 24;
            const total = arr.length;
            const pagination = {
              page,
              has_next_page: total > page * perPage,
              last_visible_page: Math.max(1, Math.ceil(total / perPage)),
              items: {
                count: Math.min(perPage, total - (page - 1) * perPage),
                total,
                per_page: perPage,
              },
            };
            const payload = { episodes, pagination };
            episodesCache[cacheKey] = { at: now, data: payload };
            return res.json(payload);
          }
        }
      }
    }

    // 3) No data
    const empty = { episodes: [], pagination: null };
    episodesCache[cacheKey] = { at: now, data: empty };
    return res.json(empty);
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
