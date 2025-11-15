import { Link } from "react-router-dom";

export interface AnimeSummary {
  id: number;
  title: string;
  image: string;
  type?: string;
  year?: number | null;
  rating?: number | null; // 0-10
  subDub?: "SUB" | "DUB" | "SUB/DUB" | null;
  genres?: string[];
  isNewSeason?: boolean;
}

export function AnimeCard({ anime }: { anime: AnimeSummary }) {
  return (
    <Link to={`/anime/${anime.id}`} className="group block hover-raise">
      <div className="relative aspect-[3/4] overflow-hidden rounded-md border">
        <img
          src={anime.image}
          alt={anime.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-80" />
        {anime.rating != null && (
          <div className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white">
            ⭐ {anime.rating.toFixed(1)}
          </div>
        )}
        {anime.subDub && (
          <div className="absolute right-2 top-2 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
            {anime.subDub}
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1">
        <div className="line-clamp-1 text-sm font-medium group-hover:text-primary">
          {anime.title}
        </div>
        <div className="text-xs text-foreground/60">
          {anime.type ?? ""} {anime.year ? `• ${anime.year}` : ""}
        </div>
        {(anime.genres && anime.genres.length > 0) || anime.isNewSeason ? (
          <div className="flex flex-wrap gap-1">
            {anime.isNewSeason && (
              <span className="rounded bg-yellow-400/90 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                New Season
              </span>
            )}
            {anime.genres?.slice(0, 3).map((g) => (
              <span
                key={g}
                className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground/80"
              >
                {g}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
