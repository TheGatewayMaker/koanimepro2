import { useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";

export interface BannerItem {
  id: number;
  title: string;
  image: string;
  description?: string;
  rating?: number | null;
  subDub?: string | null;
  year?: number | null;
  type?: string | null;
}

export function BannerCarousel({ items }: { items: BannerItem[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    skipSnaps: false,
  });
  const timerRef = useRef<number | null>(null);
  const isHovering = useRef(false);

  const play = useCallback(() => {
    if (!emblaApi) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      if (!isHovering.current) emblaApi.scrollNext();
    }, 4000) as unknown as number;
  }, [emblaApi]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    play();
    const onSelect = () => {
      stop();
      play();
    };
    emblaApi.on("select", onSelect);
    emblaApi.on("pointerDown", () => {
      isHovering.current = true;
      stop();
    });
    emblaApi.on("pointerUp", () => {
      isHovering.current = false;
      play();
    });
    return () => stop();
  }, [emblaApi, play, stop]);

  return (
    <div
      className="relative"
      onMouseEnter={() => (isHovering.current = true)}
      onMouseLeave={() => (isHovering.current = false)}
    >
      <div className="overflow-hidden mx-auto max-w-7xl" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/anime/${item.id}`}
              className="relative w-full min-w-0 shrink-0 grow-0 basis-full cursor-grab md:basis-full md:min-w-full"
            >
              <div className="relative w-full overflow-hidden rounded-2xl">
                <div className="aspect-[16/6] w-full">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-full w-full object-cover brightness-90 transition-transform duration-500 hover:scale-[1.02]"
                  />
                </div>

                {/* subtle bottom gradient for contrast without opaque block */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/20 to-transparent" />

                {/* info at bottom-left with text drop shadow instead of a dark block */}
                <div className="absolute left-6 bottom-6 right-6 max-w-4xl">
                  <h3 className="line-clamp-1 text-white text-2xl font-extrabold md:text-5xl filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.7)]">
                    {item.title}
                  </h3>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/95 filter drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]">
                    {item.rating != null && (
                      <span className="rounded bg-black/10 px-2 py-1">
                        ⭐ {item.rating.toFixed(1)}
                      </span>
                    )}
                    {item.subDub && (
                      <span className="rounded bg-black/10 px-2 py-1">
                        {item.subDub}
                      </span>
                    )}
                    {item.type && (
                      <span className="rounded bg-black/10 px-2 py-1">
                        {item.type}
                      </span>
                    )}
                    {item.year && (
                      <span className="rounded bg-black/10 px-2 py-1">
                        {item.year}
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="mt-3 max-w-2xl text-sm text-white/90 filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)] line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
