import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col" style={{ background: "#000" }}>
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 pb-20 pt-16 text-center sm:pt-24">
        <img
          src="/logo.png"
          alt="World Cup Fantasy 2026"
          className="mb-10 w-72 object-contain sm:w-96"
        />

        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
          World Cup Fantasy
        </h1>
        <p className="mt-2 text-lg font-light tracking-widest uppercase text-white/40">
          2026 Bracket Predictor
        </p>

        <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-white/60">
          Predict exact scores for every match. Create private leagues, compete
          with friends, and follow the tournament with live score updates.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/login"
            className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
          >
            Get Started
          </Link>
          <Link
            href="/bracket"
            className="rounded-full border border-white/20 px-8 py-3 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5"
          >
            View Bracket
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/10 py-12">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-8 sm:flex-row sm:gap-16">
          <div className="text-center">
            <div className="text-4xl font-bold text-white">48</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-widest text-white/40">
              Teams
            </div>
          </div>
          <div className="hidden h-8 w-px bg-white/10 sm:block" />
          <div className="text-center">
            <div className="text-4xl font-bold text-white">104</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-widest text-white/40">
              Matches
            </div>
          </div>
          <div className="hidden h-8 w-px bg-white/10 sm:block" />
          <div className="text-center">
            <div className="text-4xl font-bold text-white">12</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-widest text-white/40">
              Groups
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-20">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10">
              <svg className="h-6 w-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white">Predict</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/40">
              Pick exact scores for all 104 matches. Earn bonus points for
              perfect predictions.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10">
              <svg className="h-6 w-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white">Compete</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/40">
              Create private leagues with friends. Share an invite code and climb
              the leaderboard.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10">
              <svg className="h-6 w-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white">Live Scores</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/40">
              Real-time match updates. Scores and standings refresh
              automatically as games unfold.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-white/20">
        FIFA World Cup 2026 &middot; USA &middot; Mexico &middot; Canada
      </footer>
    </div>
  );
}
