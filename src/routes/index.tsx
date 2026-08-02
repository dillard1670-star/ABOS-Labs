import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { useState, type FormEvent, type ReactNode } from "react";
import { sql } from "~/db";
import heroImage from "~/assets/hero.webp";

export const Route = createFileRoute("/")({
  component: Home,
});

/**
 * Waitlist signup — runs server-side only.
 * Captures { name, email } plus attribution (source/medium/campaign from the
 * page's query string, referrer from the browser) by appending to
 * data/waitlist.json (an array of entries). Attribution fields tolerate
 * empty/missing values. No email is sent — capture only. The file path
 * resolves from process.cwd(), which publish.sh sets to the site root (the
 * same convention the placeholder used for site.json).
 */
const submitWaitlist = createServerFn({ method: "POST" })
  .validator(
    (data: unknown) =>
      data as {
        name: string;
        email: string;
        source?: unknown;
        medium?: unknown;
        campaign?: unknown;
        referrer?: unknown;
      },
  )
  .handler(async ({ data }) => {
    const name = data.name.trim().slice(0, 200);
    const email = data.email.trim().toLowerCase().slice(0, 320);
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name || !EMAIL_RE.test(email)) {
      return { ok: false as const, error: "Please provide your name and a valid email address." };
    }
    // Attribution is measurement-only; never required, never validated.
    const clean = (v: unknown) =>
      typeof v === "string" ? v.trim().slice(0, 500) : "";
    const source = clean(data.source);
    const medium = clean(data.medium);
    const campaign = clean(data.campaign);
    const referrer = clean(data.referrer);
    try {
      const db = sql();
      await db`CREATE TABLE IF NOT EXISTS waitlist (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL DEFAULT '',
        medium TEXT NOT NULL DEFAULT '',
        campaign TEXT NOT NULL DEFAULT '',
        referrer TEXT NOT NULL DEFAULT '',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await db`
        INSERT INTO waitlist (name, email, source, medium, campaign, referrer)
        VALUES (${name}, ${email}, ${source}, ${medium}, ${campaign}, ${referrer})
        ON CONFLICT (email) DO NOTHING
      `;
      return { ok: true as const };
    } catch {
      // Keep the original JSON capture path available if the database is
      // unavailable (including before DATABASE_URL is configured).
      const file = join(process.cwd(), "data", "waitlist.json");
      try {
        await mkdir(dirname(file), { recursive: true });
        let entries: unknown[] = [];
        try {
          const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
          if (Array.isArray(parsed)) entries = parsed;
        } catch {
          // First entry — the file doesn't exist yet.
        }
        entries.push({ name, email, source, medium, campaign, referrer, joinedAt: new Date().toISOString() });
        await writeFile(file, JSON.stringify(entries, null, 2) + "\n", "utf8");
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: "Something went wrong on our end — please try again." };
      }
    }
  });

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Logo() {
  return (
    <a href="#top" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/25">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" aria-hidden="true">
          <path d="M12 3l7 18h-3.4L12 8.2 8.4 21H5z" fill="white" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight text-white">ABOS</span>
    </a>
  );
}

function Section({
  id,
  children,
  className = "",
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`mx-auto max-w-6xl scroll-mt-24 px-6 py-20 sm:py-24 ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      {sub ? <p className="mt-4 text-lg text-slate-400">{sub}</p> : null}
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ClockIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Icon>
);

const ZapIcon = () => (
  <Icon>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </Icon>
);

const ChartIcon = () => (
  <Icon>
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </Icon>
);

const RepeatIcon = () => (
  <Icon>
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Icon>
);

const TrendIcon = () => (
  <Icon>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </Icon>
);

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const navLinks = [
  { href: "#how", label: "How it works" },
  { href: "#board", label: "The board" },
  { href: "#why", label: "Why ABOS" },
  { href: "#audience", label: "Who it's for" },
];

const steps = [
  {
    num: "01",
    title: "Plan",
    body: "The board turns your direction into goals, priorities, and a plan of record — built from your input and your data.",
  },
  {
    num: "02",
    title: "Build",
    body: "Plans become work that ships: systems, campaigns, product iterations, and processes, executed end-to-end.",
  },
  {
    num: "03",
    title: "Operate",
    body: "The system runs the day-to-day — execution, coordination, customer follow-through, and reporting — so nothing falls through the cracks.",
  },
  {
    num: "04",
    title: "Optimize",
    body: "It measures what happened, learns what moved the needle, and feeds the next cycle.",
  },
];

const board = [
  { code: "ST", role: "Strategy", title: "CEO", desc: "Sets direction — goals, priorities, and the moves that matter most." },
  { code: "OP", role: "Operations", title: "COO", desc: "Runs the machine — processes, coordination, and daily execution." },
  { code: "FN", role: "Finance", title: "CFO", desc: "Watches the numbers — cash, cost, and unit economics." },
  { code: "MK", role: "Marketing", title: "CMO", desc: "Owns message and reach — positioning, campaigns, and demand." },
  { code: "PD", role: "Product", title: "CPO", desc: "Shapes what you ship — roadmap, feedback, and iteration." },
  { code: "RV", role: "Revenue", title: "CRO", desc: "Grows the top line — pricing, pipeline, conversion, and retention." },
  { code: "CS", role: "Customer Success", title: "CCO", desc: "Keeps customers winning — onboarding, support, and health." },
  { code: "DA", role: "Data", title: "CDO", desc: "Turns signals into decisions — metrics, reporting, and insight." },
  { code: "LR", role: "Legal & Risk", title: "CLRO", desc: "Keeps you safe — contracts, compliance, and risk." },
];

const reasons = [
  {
    icon: <ClockIcon />,
    title: "Works around the clock",
    body: "Your board never sleeps. Plans execute, work ships, and metrics get reviewed — nights, weekends, and holidays included.",
  },
  {
    icon: <ZapIcon />,
    title: "Automation built in",
    body: "Repetitive operations — follow-ups, reconciliations, reports, reviews — run themselves once the operating layer owns them.",
  },
  {
    icon: <ChartIcon />,
    title: "Decisions driven by data",
    body: "Every recommendation is grounded in your own numbers. The board shows its reasoning; you keep the final call.",
  },
  {
    icon: <RepeatIcon />,
    title: "Recurring-revenue mechanics",
    body: "Pricing, billing, retention, and churn are first-class systems — built for businesses that compound by subscription.",
  },
  {
    icon: <TrendIcon />,
    title: "Compounds over time",
    body: "ABOS keeps a memory of your business. Every cycle makes the next one faster, sharper, and more your own.",
  },
];

const audiences = [
  "B2B SaaS founders with a live product and paying customers — who need operating capacity before they can hire it.",
  "E-commerce brands whose storefront, marketing, and operations have outgrown a pile of tabs and tools.",
  "Productized services and agencies that want delivery, client success, and reporting to run themselves.",
  "Anyone who would rather subscribe to an operating system than hire a headcount.",
];

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-400 transition hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <a
          href="#waitlist"
          className="hidden rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 md:inline-flex"
        >
          Join the waitlist
        </a>
        <a
          href="#waitlist"
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 md:hidden"
        >
          Join
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-[-22rem] h-[42rem] w-[62rem] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute right-[-10rem] top-44 h-[30rem] w-[30rem] rounded-full bg-violet-600/15 blur-3xl" />
        <div className="absolute left-[-8rem] top-[30rem] h-[24rem] w-[24rem] rounded-full bg-indigo-500/10 blur-3xl" />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-24 sm:pt-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            An operating system, not another AI tool
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            An{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-indigo-400 bg-clip-text text-transparent">
              operating system
            </span>{" "}
            for your business, run by your AI executive board
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-400 sm:text-xl">
            ABOS is an operating layer for your business, not another AI tool:
            an executive board of nine AI specialists that plans, builds, runs,
            and optimizes your operations end to end. Subscribe instead of
            hiring — you keep the final call.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#waitlist"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              Join the waitlist
            </a>
            <a
              href="#how"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-slate-200 transition hover:bg-white/10"
            >
              See how it works
            </a>
          </div>
        </div>
        <div className="relative mx-auto mt-16 max-w-3xl">
          <div
            aria-hidden="true"
            className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-indigo-500/20 blur-2xl"
          />
          <img
            src={heroImage}
            alt="Abstract visualization of the ABOS operating system — an AI executive board of specialist nodes around a shared core running your business"
            className="relative w-full rounded-2xl border border-white/10 shadow-2xl shadow-indigo-950/60"
            fetchPriority="high"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <Section id="how">
      <SectionHeading
        eyebrow="How it works"
        title="One operating system, one continuous cycle"
        sub="ABOS isn't another tool to check — it's the layer that runs the recurring work of your business, end to end."
      />
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <div
            key={s.num}
            className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-indigo-400/40 hover:bg-white/[0.06]"
          >
            <span className="text-sm font-bold text-indigo-400">{s.num}</span>
            <h3 className="mt-3 text-xl font-semibold text-white">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {s.body}
            </p>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 flex max-w-3xl flex-col items-center gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 px-6 py-5 text-center">
        <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-300">
          Guided by MABO v11
        </span>
        <p className="text-sm leading-relaxed text-slate-400">
          Every cycle runs on the MABO v11 operating framework — the discipline
          of a seasoned operator, applied continuously instead of quarterly.
        </p>
      </div>
    </Section>
  );
}

function Board() {
  return (
    <Section id="board">
      <SectionHeading
        eyebrow="The executive board"
        title="Nine AI specialists, one board"
        sub="Nine AI specialists — strategy, operations, finance, marketing, product, revenue, customer success, data, and legal & risk — working from one shared plan and one set of numbers. They run the operations; you hold the final authority."
      />
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {board.map((m) => (
          <div
            key={m.code}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-indigo-400/40 hover:bg-white/[0.06]"
          >
            <div className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 text-sm font-bold text-indigo-300">
                {m.code}
              </span>
              <div>
                <h3 className="font-semibold text-white">{m.role}</h3>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  {m.title}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              {m.desc}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Why() {
  return (
    <Section id="why">
      <SectionHeading
        eyebrow="Why ABOS"
        title="An operating system, not another stack of tools"
        sub="Subscribe instead of hiring. Here's what the system buys you."
      />
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {reasons.map((r) => (
          <div
            key={r.title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-indigo-400/40 hover:bg-white/[0.06]"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 text-indigo-300">
              {r.icon}
            </span>
            <h3 className="mt-4 text-lg font-semibold text-white">{r.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {r.body}
            </p>
          </div>
        ))}
        <a
          href="#waitlist"
          className="group flex flex-col justify-between rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 p-6 transition hover:border-indigo-400/60 hover:from-indigo-500/20 hover:to-violet-500/15"
        >
          <div>
            <h3 className="text-lg font-semibold text-white">
              Run your business on ABOS
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Join the waitlist and be first in line when ABOS opens for early
              access.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-300 transition group-hover:text-indigo-200">
            Join the waitlist
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </a>
      </div>
    </Section>
  );
}

function Audience() {
  return (
    <Section id="audience">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Who it's for
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Built for any business that runs on software
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            ABOS is for founders and small businesses — B2B SaaS, e-commerce,
            productized services, agencies — that have outgrown what one founder
            can run alone, and don't want to spend the next two years hiring a
            management team.
          </p>
        </div>
        <ul className="space-y-4">
          {audiences.map((a) => (
            <li
              key={a}
              className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckIcon />
              </span>
              <p className="text-sm leading-relaxed text-slate-300">{a}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function WaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const normalizedName = name.trim();
    const normalizedEmail = email.trim();
    if (!normalizedName || !normalizedEmail) {
      setStatus("error");
      setMessage("Please provide your name and a valid email address.");
      return;
    }
    setStatus("sending");
    try {
      // Attribution: read UTM params from this page's query string and the
      // browser's referrer, and pass them along with the submit payload.
      const params = new URLSearchParams(window.location.search);
      const result = await submitWaitlist({
        data: {
          name: normalizedName,
          email: normalizedEmail,
          source: params.get("utm_source") ?? "",
          medium: params.get("utm_medium") ?? "",
          campaign: params.get("utm_campaign") ?? "",
          referrer: document.referrer ?? "",
        },
      });
      if (result.ok) {
        setStatus("success");
        setMessage(
          "You're on the list — we'll reach out when ABOS opens for early access.",
        );
        setName("");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(result.error);
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong — please try again.");
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30";

  return (
    <Section id="waitlist">
      <SectionHeading
        eyebrow="Early access"
        title="Get on the list"
        sub="ABOS is in private development. Join the waitlist — we'll reach out when ABOS is open for early access."
      />
      <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="wl-name"
              className="block text-sm font-medium text-slate-300"
            >
              Name
            </label>
            <input
              id="wl-name"
              type="text"
              autoComplete="name"
              placeholder="Ada Lovelace"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="wl-email"
              className="block text-sm font-medium text-slate-300"
            >
              Email
            </label>
            <input
              id="wl-email"
              type="email"
              autoComplete="email"
              placeholder="ada@yourcompany.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={status === "sending"}
            className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "sending" ? "Joining…" : "Join the waitlist"}
          </button>
        </form>
        <div
          role="status"
          aria-live="polite"
          className="mt-5 min-h-5 text-center text-sm"
        >
          {status === "success" ? (
            <p className="font-medium text-emerald-400">{message}</p>
          ) : status === "error" ? (
            <p className="font-medium text-rose-400">{message}</p>
          ) : (
            <p className="text-slate-500">
              No spam — we only use this to contact you about early access.
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <Logo />
          <p className="max-w-md text-sm leading-relaxed text-slate-500">
            The Autonomous Business Operating System. An AI executive board that
            plans, builds, runs, measures, and optimizes your business — so you
            can operate like a bigger company without hiring one.
          </p>
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} ABOS Labs. ABOS is in private
            development.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function Home() {
  return (
    <div className="min-h-dvh bg-slate-950 font-sans text-slate-300">
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Board />
        <Why />
        <Audience />
        <WaitlistForm />
      </main>
      <Footer />
    </div>
  );
}
