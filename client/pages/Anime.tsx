import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import {
  fetchAnimeInfo,
  fetchEpisodes,
  ApiAnimeSummary,
  EpisodeItem,
  fetchStreams,
  StreamLink,
} from "../lib/anime";
import { toast } from "sonner";

export default function AnimePage() {
  const params = useParams();
  const id = Number(params.id);
  const [info, setInfo] = useState<ApiAnimeSummary | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [episodesPagination, setEpisodesPagination] = useState<any>(null);
  const [seasonPage, setSeasonPage] = useState<number>(1); // default season 1
  const [streams, setStreams] = useState<StreamLink[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingInfo(true);
      try {
        const [i, s] = await Promise.all([
          fetchAnimeInfo(id),
          fetchStreams(id).catch(() => []),
        ]);
        if (!i) {
          toast("Failed to load anime info", {
            description: "Could not fetch anime details from the API.",
          });
        }
        setInfo(i);
        setStreams(s || []);
      } catch (e) {
        console.error(e);
        toast("Network error", {
          description: "Failed to fetch anime data. Please try again later.",
        });
      } finally {
        setLoadingInfo(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    (async () => {
      setLoadingEpisodes(true);
      try {
        const resp = await fetchEpisodes(id, seasonPage);
        if (!resp || !Array.isArray(resp.episodes)) {
          toast("Failed to load episodes", {
            description: "Could not fetch episodes for this season.",
          });
          setEpisodes([]);
          setEpisodesPagination(null);
        } else {
          setEpisodes(resp.episodes || []);
          setEpisodesPagination(resp.pagination || null);
        }
      } catch (e) {
        console.error(e);
        toast("Network error", {
          description: "Failed to fetch episodes. Please try again later.",
        });
        setEpisodes([]);
        setEpisodesPagination(null);
      } finally {
        setLoadingEpisodes(false);
      }
    })();
  }, [id, seasonPage]);

  const banner = useMemo(() => info?.image ?? "", [info]);
  const loading = loadingInfo || loadingEpisodes;

  return (
    <Layout>
      {loading ? (
        <div className="container mx-auto px-4 py-8">
          <div className="aspect-[16/6] w-full animate-pulse rounded-md bg-muted" />
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-3">
              <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-64 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ) : info || episodes.length > 0 ? (
        <div>
          {info && (
            <div className="relative">
              <div className="absolute inset-0 -z-10">
                <img
                  src={banner}
                  alt="banner"
                  className="h-full w-full object-cover opacity-30 blur-sm"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-background/30 to-background" />
              </div>
              <div className="container mx-auto px-4 py-6 md:py-10">
                <div className="flex flex-col gap-6 md:flex-row">
                  <img
                    src={info.image}
                    alt={info.title}
                    className="h-[300px] w-[220px] rounded-md border object-cover"
                  />
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold md:text-4xl">
                      {info.title}
                    </h1>
                    <div className="mt-2 text-sm text-foreground/70">
                      {info.type} {info.year ? `• ${info.year}` : ""}
                      {info.rating != null && (
                        <span className="ml-2 rounded bg-black/30 px-2 py-0.5 text-xs">
                          ⭐ {info.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {info.genres && info.genres.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {info.genres.map((g) => (
                          <span
                            key={g}
                            className="rounded bg-accent px-2 py-1 text-xs"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                    {info.synopsis && (
                      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-foreground/80">
                        {info.synopsis}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="container mx-auto px-4 pb-10">
            {streams.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-3 text-lg font-semibold">Where to watch</h2>
                <div className="flex flex-wrap gap-2">
                  {streams.map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-accent"
                    >
                      {s.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <h2 className="mb-3 text-lg font-semibold">Episodes</h2>

            <div className="mb-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Season</label>
                <div className="relative inline-block">
                  <select
                    value={seasonPage}
                    onChange={(e) => setSeasonPage(Number(e.target.value))}
                    className="appearance-none rounded-md border bg-background px-4 py-2 pr-8 text-sm transition-shadow duration-150 hover:shadow-sm focus:shadow-md focus:outline-none"
                    aria-label="Select season"
                  >
                    {(() => {
                      const totalItems =
                        (episodesPagination?.items?.total as number) ||
                        info?.episodes_count ||
                        episodes.length ||
                        0;
                      const last =
                        episodesPagination?.last_visible_page ??
                        Math.max(1, Math.ceil(totalItems / 24));
                      const count = Math.max(1, Number(last || 1));
                      return Array.from({ length: count }).map((_, i) => (
                        <option key={i} value={i + 1}>
                          {`Season ${i + 1}`}
                        </option>
                      ));
                    })()}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="text-foreground/70"
                    >
                      <path
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 9l6 6 6-6"
                      />
                    </svg>
                  </span>
                </div>
              </div>
            </div>

            {loadingEpisodes ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] animate-pulse rounded-md bg-muted"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {episodes.map((ep) => (
                  <button
                    key={ep.id + "-" + ep.number}
                    className="rounded border px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() =>
                      toast("Streaming not available in-app", {
                        description:
                          streams.length > 0
                            ? "Use the streaming links above to watch legally."
                            : "Streaming providers not reported for this title.",
                        duration: 3000,
                      })
                    }
                  >
                    <div className="font-medium">Episode {ep.number}</div>
                    {ep.title && (
                      <div className="line-clamp-1 text-xs text-foreground/60">
                        {ep.title}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-10">Not found</div>
      )}
    </Layout>
  );
}
