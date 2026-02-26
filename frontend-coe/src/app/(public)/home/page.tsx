import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-linear-to-br from-violet-600 via-indigo-500 to-cyan-400" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.16),transparent_32%)]" />

      <section className="container mx-auto flex min-h-dvh items-center justify-center px-6 py-20">
        <div className="w-full max-w-6xl rounded-3xl border border-white/20 bg-black/25 p-8 text-white shadow-2xl backdrop-blur-md sm:p-12">
          <div className="flex flex-wrap items-center gap-3">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs tracking-wide uppercase">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Patch Pilot • Self-Healing CI
            </p>
            <p className="rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs tracking-wide uppercase">
              Live Agent Visibility
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
                Fix CI failures faster with AI + human control.
              </h1>

              <p className="mt-5 max-w-2xl text-base text-white/90 sm:text-lg">
                Patch Pilot gives a redirectable command center for failed pipelines,
                agent reasoning steps, PR actions, container validation, and real-time metrics.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-white text-black hover:bg-white/90">
                  <Link href="/ci-healing">Open CI Dashboard</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                  <Link href="#agent-thinking">Agent Thinking</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                  <Link href="#metrics-visibility">Metrics Visibility</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                  <Link href="#repo-board">Repo Fix Board</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 p-6">
              <div className="mb-4 flex items-center gap-3">
                <Image
                  src="/favicons/web-app-manifest-192x192.png"
                  alt="Patch Pilot Logo"
                  width={56}
                  height={56}
                  className="rounded-xl border border-white/20 bg-white/20 p-1"
                />
                <div>
                  <p className="text-sm text-white/70">Current Incident</p>
                  <p className="text-lg font-semibold">Pipeline #2481 • main branch</p>
                </div>
              </div>
              <div className="space-y-4 text-sm text-white/90">
                <div>
                  <p className="mb-1">Agent Diagnosis</p>
                  <div className="h-2 rounded-full bg-white/20">
                    <div className="h-2 w-11/12 animate-pulse rounded-full bg-emerald-300" />
                  </div>
                </div>
                <div>
                  <p className="mb-1">Container Validation</p>
                  <div className="h-2 rounded-full bg-white/20">
                    <div className="h-2 w-3/4 animate-pulse rounded-full bg-cyan-300" />
                  </div>
                </div>
                <div>
                  <p className="mb-1">PR Proposal</p>
                  <div className="h-2 rounded-full bg-white/20">
                    <div className="h-2 w-2/5 animate-pulse rounded-full bg-violet-300" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-3 text-sm text-white/90 sm:grid-cols-3">
            <div className="rounded-xl border border-white/20 bg-white/10 p-4 transition hover:-translate-y-0.5">
              <p className="font-semibold">Container-first PR Gate</p>
              <p>PR opens only after container validation succeeds.</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-4 transition hover:-translate-y-0.5">
              <p className="font-semibold">Agent Reasoning Timeline</p>
              <p>Diagnosis, patching, test attempts, and confidence are visible.</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-4 transition hover:-translate-y-0.5">
              <p className="font-semibold">Live Reliability Metrics</p>
              <p>Prometheus + Grafana panels update every run and action.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="agent-thinking" className="container mx-auto px-6 pb-10 text-white">
        <div className="rounded-3xl border border-white/20 bg-black/25 p-8 backdrop-blur-sm sm:p-10">
          <h2 className="text-2xl font-semibold sm:text-3xl">Agent Thinking Process Visibility</h2>
          <p className="mt-2 text-white/80">
            Every healing attempt keeps a transparent trail from incident intake to reviewer decision.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/20 bg-white/10 p-4">
              <p className="text-xs text-white/70">Step 01</p>
              <p className="font-semibold">Failure Ingested</p>
              <p className="text-sm text-white/85">Webhook payload, logs, and commit context collected.</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-4">
              <p className="text-xs text-white/70">Step 02</p>
              <p className="font-semibold">Patch Proposed</p>
              <p className="text-sm text-white/85">AI plan and diff generated with confidence scoring.</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-4">
              <p className="text-xs text-white/70">Step 03</p>
              <p className="font-semibold">Container Validated</p>
              <p className="text-sm text-white/85">Patch is tested in clean container before PR opening.</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-4">
              <p className="text-xs text-white/70">Step 04</p>
              <p className="font-semibold">Human Decision</p>
              <p className="text-sm text-white/85">Accept, reject, abort, or request escalation.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="metrics-visibility" className="container mx-auto px-6 pb-10 text-white">
        <div className="rounded-3xl border border-white/20 bg-black/25 p-8 backdrop-blur-sm sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold sm:text-3xl">Metrics Visibility</h2>
            <Button asChild variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
              <Link href="/ci-healing">Open Metrics Dashboard</Link>
            </Button>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/20 bg-white/10 p-4">
              <p className="text-sm text-white/70">Webhook Events</p>
              <p className="text-3xl font-bold">1,284</p>
              <p className="text-xs text-emerald-300">+8.2% last 24h</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-4">
              <p className="text-sm text-white/70">Auto-fixed Runs</p>
              <p className="text-3xl font-bold">76%</p>
              <p className="text-xs text-emerald-300">Within policy thresholds</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-4">
              <p className="text-sm text-white/70">Mean Recovery Time</p>
              <p className="text-3xl font-bold">14m</p>
              <p className="text-xs text-cyan-300">Agent + reviewer flow</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-4">
              <p className="text-sm text-white/70">PR Gate Pass Rate</p>
              <p className="text-3xl font-bold">92%</p>
              <p className="text-xs text-violet-300">Container checks enforced</p>
            </div>
          </div>
        </div>
      </section>

      <section id="repo-board" className="container mx-auto px-6 pb-20 text-white">
        <div className="rounded-3xl border border-white/20 bg-black/25 p-8 backdrop-blur-sm sm:p-10">
          <h2 className="text-2xl font-semibold sm:text-3xl">GitHub Repos: Fixed & In Progress</h2>
          <p className="mt-2 text-white/80">
            Quick links to repos where Patch Pilot already applied fixes or is actively trying now.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-emerald-300/40 bg-emerald-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-200">Fixed in past</p>
              <p className="mt-1 text-lg font-semibold">charan-happy/ci-fix-pilot</p>
              <p className="text-sm text-white/85">Resolved env split, container gate, and CI-healing dashboard regressions.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" className="bg-white text-black hover:bg-white/90">
                  <Link href="https://github.com/charan-happy/ci-fix-pilot" target="_blank" rel="noopener noreferrer">
                    Open Repository
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                  <Link href="/ci-healing">View Run Timeline</Link>
                </Button>
              </div>
            </article>

            <article className="rounded-xl border border-cyan-300/40 bg-cyan-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-100">Trying to fix now</p>
              <p className="mt-1 text-lg font-semibold">Current pipeline incident queue</p>
              <p className="text-sm text-white/85">Active attempts are visible with logs, proposed patches, and reviewer controls.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" className="bg-white text-black hover:bg-white/90">
                  <Link href="/ci-healing">Open Active Incidents</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                  <Link href="/reference">View API Signals</Link>
                </Button>
              </div>
            </article>
          </div>

          <div className="mt-6 flex items-center gap-4 rounded-xl border border-white/20 bg-white/10 p-4">
            <Image
              src="/favicons/favicon-96x96.png"
              alt="Patch Pilot Agent"
              width={48}
              height={48}
              className="rounded-lg border border-white/30 bg-white/20 p-1"
            />
            <p className="text-sm text-white/90">
              Need deeper drill-down? Go to the CI dashboard for attempt-by-attempt logs, human decisions,
              metrics counters, and PR lifecycle events.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
