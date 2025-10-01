import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function Header() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent/60"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              className="text-foreground"
            >
              <path
                fill="currentColor"
                d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"
              />
            </svg>
          </button>
          <Link
            to="/"
            className="flex items-center gap-2 font-extrabold text-lg tracking-tight"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow">
              K
            </span>
            <span className="hidden sm:inline">KoAnime</span>
          </Link>
        </div>

        <div className="hidden md:flex flex-1 items-center gap-6">
          <nav className="flex items-center gap-2 text-sm">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `px-3 py-2 rounded hover:bg-accent ${isActive ? "text-primary" : "text-foreground/80"}`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/discover"
              className={({ isActive }) =>
                `px-3 py-2 rounded hover:bg-accent ${isActive ? "text-primary" : "text-foreground/80"}`
              }
            >
              Discover
            </NavLink>
            <NavLink
              to="/schedule"
              className={({ isActive }) =>
                `px-3 py-2 rounded hover:bg-accent ${isActive ? "text-primary" : "text-foreground/80"}`
              }
            >
              Schedule
            </NavLink>
            <NavLink
              to="/watchlist"
              className={({ isActive }) =>
                `px-3 py-2 rounded hover:bg-accent ${isActive ? "text-primary" : "text-foreground/80"}`
              }
            >
              Watchlist
            </NavLink>
          </nav>
          <div className="flex-1 max-w-xl">
            <SearchBar onSelect={(item) => navigate(`/anime/${item.mal_id}`)} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/login"
            className="hidden sm:inline-flex rounded-md border px-3 py-2 hover:bg-accent"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="hidden sm:inline-flex rounded-md bg-primary px-3 py-2 text-primary-foreground hover:opacity-90"
          >
            Sign up
          </Link>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-4 md:hidden">
          <div className="mb-4 flex items-center justify-between">
            <Link
              to="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 font-extrabold text-lg"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                K
              </span>
              KoAnime
            </Link>
          </div>
          <div className="mb-3">
            <SearchBar
              onSelect={(item) => {
                setOpen(false);
                navigate(`/anime/${item.mal_id}`);
              }}
            />
          </div>
          <nav className="grid gap-1 text-sm">
            <NavLink
              to="/"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rounded px-3 py-2 hover:bg-accent ${isActive ? "text-primary" : ""}`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/discover"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rounded px-3 py-2 hover:bg-accent ${isActive ? "text-primary" : ""}`
              }
            >
              Discover
            </NavLink>
            <NavLink
              to="/schedule"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rounded px-3 py-2 hover:bg-accent ${isActive ? "text-primary" : ""}`
              }
            >
              Schedule
            </NavLink>
            <NavLink
              to="/watchlist"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rounded px-3 py-2 hover:bg-accent ${isActive ? "text-primary" : ""}`
              }
            >
              Watchlist
            </NavLink>
            <div className="mt-4 flex gap-2">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="inline-flex flex-1 items-center justify-center rounded-md border px-3 py-2 hover:bg-accent"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                onClick={() => setOpen(false)}
                className="inline-flex flex-1 items-center justify-center rounded-md bg-primary px-3 py-2 text-primary-foreground hover:opacity-90"
              >
                Sign up
              </Link>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
