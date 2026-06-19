import { Link } from "react-router-dom";

// ── Decorative stars scoped to a section ──────────────────────────────────────

function SectionStars() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <span className="absolute top-[8%]  left-[5%]  text-coven-gold     text-xl  animate-twinkle">✦</span>
      <span className="absolute top-[15%] right-[8%] text-coven-lavender text-sm  animate-twinkle-slow">✦</span>
      <span className="absolute top-[40%] left-[12%] text-coven-ember    text-xs  animate-twinkle-fast">✦</span>
      <span className="absolute top-[60%] right-[15%] text-coven-gold    text-base animate-twinkle">✦</span>
      <span className="absolute top-[75%] left-[50%] text-coven-silver   text-xs  animate-twinkle-slow">✦</span>
      <span className="absolute top-[25%] right-[30%] text-coven-spelgold text-xs animate-twinkle">✦</span>
      <span className="absolute top-[85%] right-[42%] text-coven-mystic  text-xs  animate-twinkle-fast">✦</span>
    </div>
  );
}

// ── Mock: Book list ───────────────────────────────────────────────────────────

function MockBooks() {
  const books = [
    { title: "Circe", author: "Madeline Miller", genre: "Mythology", emoji: "🌿", votes: 5, winner: true },
    { title: "A Court of Thorns and Roses", author: "Sarah J. Maas", genre: "Romantasy", emoji: "🌹", votes: 4, voted: true },
    { title: "The Name of the Wind", author: "Patrick Rothfuss", genre: "Fantasy", emoji: "🧙", votes: 3 },
  ] as const;

  return (
    <div className="space-y-2">
      {books.map((b) => (
        <div
          key={b.title}
          className={`border rounded-xl p-3 flex items-start justify-between gap-3 ${
            "winner" in b && b.winner
              ? "border-coven-lavender/40 bg-coven-lavender/10"
              : "border-app-border bg-app-surface"
          }`}
        >
          <div className="text-lg shrink-0 mt-0.5">{b.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-white text-sm">{b.title}</p>
              {"winner" in b && b.winner && (
                <span className="text-xs bg-coven-mystic text-white px-2 py-0.5 rounded-full shrink-0">
                  Current pick 🎉
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">{b.author} · {b.genre}</p>
            <p className="text-xs text-gray-500 mt-0.5">{b.votes} votes</p>
          </div>
          <div
            className={`text-xs px-3 py-1.5 rounded-lg font-medium shrink-0 ${
              "voted" in b && b.voted
                ? "bg-coven-amethyst/30 text-coven-lavender"
                : "bg-app-raised text-gray-400"
            }`}
          >
            {"voted" in b && b.voted ? "Voted ✓" : "Vote"}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Mock: Active poll ─────────────────────────────────────────────────────────

function MockPoll() {
  const options = [
    { title: "Fourth Wing", author: "Rebecca Yarros", voted: true },
    { title: "Babel", author: "R.F. Kuang", voted: false },
    { title: "Piranesi", author: "Susanna Clarke", voted: false },
  ];

  return (
    <div className="bg-app-surface border border-app-border rounded-xl p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vote for next book</p>
        <p className="text-xs text-gray-500 mt-0.5">3 / 6 voted · 4d left</p>
        <p className="text-xs text-coven-flame mt-0.5">Results hidden until voting closes</p>
      </div>

      <div className="space-y-2">
        {options.map((opt) => (
          <div key={opt.title} className="rounded-lg border border-app-border bg-app-raised p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-white text-sm">{opt.title}</span>
              <span className="text-gray-400 text-xs">{opt.author}</span>
            </div>
            <div
              className={`inline-block text-xs px-3 py-1 rounded-md font-medium ${
                opt.voted
                  ? "bg-coven-amethyst/40 text-coven-lavender"
                  : "bg-app-border text-gray-400"
              }`}
            >
              {opt.voted ? "✓ Your vote" : "Vote"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mock: Group availability grid ─────────────────────────────────────────────

function MockAvailability() {
  const days   = ["Thu 19", "Fri 20", "Sat 21"];
  const slots  = ["Morning", "Afternoon", "Evening"];
  const dots   = ["🟣", "🔵", "🟡", "🟢"];

  // [day][slot] → which member indices are free
  const grid = [
    [[0, 1, 2],    [0, 2],       [1, 3]      ],
    [[1, 2, 3],    [0, 1, 2, 3], [0, 3]      ],
    [[0, 3],       [2, 3],       [0, 1, 2, 3]],
  ];

  return (
    <div className="bg-app-surface border border-app-border rounded-xl p-4">
      {/* Header row */}
      <div className="grid grid-cols-4 gap-1 mb-2">
        <div />
        {days.map((d) => (
          <div key={d} className="text-xs text-gray-400 text-center font-medium">{d}</div>
        ))}
      </div>

      {slots.map((slot, si) => (
        <div key={slot} className="grid grid-cols-4 gap-1 mb-1">
          <div className="text-xs text-gray-500 flex items-center">{slot}</div>
          {days.map((_, di) => {
            const available = grid[di][si];
            const isBest = available.length === dots.length;
            return (
              <div
                key={di}
                className={`rounded-lg p-1.5 flex flex-wrap gap-0.5 justify-center items-center min-h-[38px] ${
                  isBest
                    ? "bg-green-900/30 border border-green-700/40"
                    : "bg-app-raised border border-app-border"
                }`}
              >
                {available.map((mi) => (
                  <span key={mi} className="text-[10px] leading-none">{dots[mi]}</span>
                ))}
              </div>
            );
          })}
        </div>
      ))}

      <p className="text-[10px] text-gray-600 mt-2 text-center">
        Green = everyone available
      </p>
    </div>
  );
}

// ── Mock: Dashboard ───────────────────────────────────────────────────────────

function MockDashboard() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Books nominated", value: "8" },
          { label: "Proposed dates",  value: "3" },
          { label: "Members",          value: "6" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-app-surface border border-app-border rounded-xl p-3">
            <p className="text-2xl font-bold text-coven-spelgold">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-coven-gold/5 border border-coven-gold/20 rounded-xl p-4">
        <p className="text-xs font-semibold text-coven-amethyst uppercase tracking-wide mb-1">Current pick</p>
        <p className="text-base font-bold text-coven-lavender">Fourth Wing</p>
        <p className="text-xs text-gray-400">Rebecca Yarros · 517 pages</p>
      </div>

      <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-4">
        <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-1">Confirmed meeting</p>
        <p className="text-sm font-medium text-green-400">Sat, Jun 21 · 6:00 PM MT</p>
        <p className="text-xs text-gray-500 mt-0.5">All 6 members available</p>
      </div>
    </div>
  );
}

// ── Feature section wrapper ───────────────────────────────────────────────────

function Feature({
  tag,
  tagColor,
  title,
  body,
  mockup,
  flip = false,
}: {
  tag: string;
  tagColor: string;
  title: string;
  body: string;
  mockup: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
      <div className={flip ? "md:order-2" : ""}>
        <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${tagColor}`}>{tag}</p>
        <h2 className="text-2xl font-bold text-coven-gold mb-3">{title}</h2>
        <p className="text-gray-400 leading-relaxed">{body}</p>
      </div>
      <div className={`pointer-events-none select-none ${flip ? "md:order-1" : ""}`}>
        {mockup}
      </div>
    </section>
  );
}

// ── LandingPage ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen">

      {/* ── Fixed top nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 border-b border-app-border bg-[#0B132B]/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔮</span>
          <span className="font-script text-xl text-coven-gold hidden sm:inline">The Spicy Book Coven</span>
        </div>
        <Link
          to="/enter"
          className="bg-coven-flame hover:bg-coven-ember text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors shadow-lg"
        >
          Sign Up / Login →
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20 pb-16">
        <SectionStars />

        <div className="relative z-10 max-w-xl mx-auto">
          <div className="text-5xl mb-6 animate-float">🔮</div>
          <h1 className="font-script text-6xl sm:text-7xl text-coven-gold mb-4 leading-tight">
            The Spicy Book Coven
          </h1>
          <p className="text-lg text-coven-silver mb-3">Your book club, finally organized.</p>
          <p className="text-gray-400 text-base mb-10 max-w-md mx-auto leading-relaxed">
            Nominate books, vote on what to read next, coordinate schedules — and show up to every meeting ready.
          </p>
          <Link
            to="/enter"
            className="inline-block bg-coven-flame hover:bg-coven-ember text-white font-bold px-8 py-3.5 rounded-full text-base transition-colors shadow-xl"
          >
            Join your coven →
          </Link>
        </div>

        <div className="relative z-10 mt-12">
          <img
            src="/TheSpicyBookCovenArt.png"
            alt="The Spicy Book Coven"
            className="h-56 sm:h-72 object-contain animate-float opacity-90"
          />
        </div>
      </section>

      {/* ── Feature sections ── */}
      <div className="max-w-5xl mx-auto px-4 pb-24 space-y-24">

        <Feature
          tag="📚 Books"
          tagColor="text-coven-ember"
          title="Nominate and vote on your next read"
          body="Every member can suggest books. Vote for your favorites and drag them into a personal ranking — the admin uses everyone's rankings to put together fair, democratic polls."
          mockup={<MockBooks />}
        />

        <Feature
          tag="🗳️ Polls"
          tagColor="text-coven-lavender"
          title="Secret ballots, no bandwagon effect"
          body="When the admin starts a poll, three books are chosen based on everyone's rankings. Votes stay completely hidden until the deadline closes — so everyone votes honestly, not strategically."
          mockup={<MockPoll />}
          flip
        />

        <Feature
          tag="📅 Scheduling"
          tagColor="text-coven-dragon"
          title="Find a time that actually works for everyone"
          body="Mark your availability by morning, afternoon, and evening slots. The group availability view shows exactly where everyone overlaps — no more reply-all email chains or shared spreadsheets."
          mockup={<MockAvailability />}
        />

        <Feature
          tag="✦ Dashboard"
          tagColor="text-coven-silver"
          title="Everything at a glance"
          body="The dashboard keeps the whole coven in sync — current book pick, confirmed meeting time, active poll, and member count all in one place the moment you log in."
          mockup={<MockDashboard />}
          flip
        />

      </div>

      {/* ── Footer CTA ── */}
      <section className="relative py-24 text-center border-t border-app-border overflow-hidden">
        <SectionStars />
        <div className="relative z-10">
          <div className="text-4xl mb-4 animate-float">🔮</div>
          <h2 className="font-script text-4xl text-coven-gold mb-3">Ready to join the coven?</h2>
          <p className="text-gray-400 mb-8 text-sm">Ask your admin for the club password and you're in.</p>
          <Link
            to="/enter"
            className="inline-block bg-coven-flame hover:bg-coven-ember text-white font-bold px-8 py-3.5 rounded-full text-base transition-colors shadow-xl"
          >
            Sign Up / Login →
          </Link>
        </div>
      </section>

    </div>
  );
}
