"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ------------------------------------------------------------------ */
/*  Types matching the backend /info JSON response                    */
/* ------------------------------------------------------------------ */

interface AiFeature {
  name: string;
  description: string;
  endpoint: string;
  model: string;
  rate_limit: string | null;
  how_to_use: string[];
  example_queries?: string[];
  example_input?: string;
}

interface Feature {
  name: string;
  description: string;
}

interface Endpoint {
  method: string;
  path: string;
  auth: string;
  rate_limit?: string;
  purpose: string;
}

interface RateLimit {
  feature: string;
  endpoint: string;
  limit: string;
  type: string;
}

interface InfoData {
  name: string;
  version: string;
  description: string;
  tech_stack: Record<string, string>;
  architecture: { summary: string; flow: string[] };
  features: {
    core: Feature[];
    ai_powered: AiFeature[];
    librarian_tools: Feature[];
  };
  endpoints: Endpoint[];
  rate_limits: RateLimit[];
  walkthrough: {
    reader_flow: string[];
    librarian_flow: string[];
  };
}

/* ------------------------------------------------------------------ */
/*  Tab type                                                           */
/* ------------------------------------------------------------------ */

type TabKey = "core" | "ai" | "librarian" | "reference";

const TABS: { key: TabKey; label: string }[] = [
  { key: "core", label: "Core" },
  { key: "ai", label: "AI Features" },
  { key: "librarian", label: "Librarian" },
  { key: "reference", label: "Reference" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-green-100 text-green-800",
    POST: "bg-blue-100 text-blue-800",
    PUT: "bg-amber-100 text-amber-800",
    DELETE: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${colors[method] ?? "bg-gray-100 text-gray-700"}`}
    >
      {method}
    </span>
  );
}

function RateBadge({ text }: { text: string | null | undefined }) {
  if (!text) return <span className="text-gray-400">—</span>;
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
      {text}
    </span>
  );
}

function Badge({
  children,
  variant = "outline",
}: {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "outline";
}) {
  const styles: Record<string, string> = {
    default: "bg-indigo-600 text-white",
    secondary: "bg-purple-100 text-purple-700",
    outline: "border border-gray-300 text-gray-600",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature Cards                                                      */
/* ------------------------------------------------------------------ */

/** Simple feature card for Core / Librarian items */
function SimpleFeatureCard({
  feature,
  badgeLabel,
  badgeVariant,
}: {
  feature: Feature;
  badgeLabel: string;
  badgeVariant: "default" | "secondary" | "outline";
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg transition-all hover:shadow-md">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900">
            {feature.name}
          </h3>
          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
        </div>
        <p className="text-sm text-gray-500 mt-1">{feature.description}</p>
      </div>
    </div>
  );
}

/** Rich feature card for AI-powered items (how-to-use, endpoint, model, examples) */
function AiFeatureCard({
  feat,
}: {
  feat: AiFeature;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg transition-all hover:shadow-md">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900">{feat.name}</h3>
          <div className="flex items-center gap-2">
            {feat.rate_limit && <RateBadge text={feat.rate_limit} />}
            <Badge variant="secondary">AI</Badge>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">{feat.description}</p>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-gray-200" />

      {/* Details */}
      <div className="px-4 py-3 space-y-3 text-sm">
        {/* Endpoint + Model */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <span>
            <strong className="text-gray-600">Endpoint:</strong>{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">
              {feat.endpoint}
            </code>
          </span>
          <span>
            <strong className="text-gray-600">Model:</strong>{" "}
            <span className="text-gray-700">{feat.model}</span>
          </span>
        </div>

        {/* How to use */}
        {feat.how_to_use.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-800 mb-1">
              How to use:
            </p>
            <ol className="list-decimal list-inside space-y-0.5 text-gray-500">
              {feat.how_to_use.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Example queries */}
        {feat.example_queries && feat.example_queries.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-800 mb-1">
              Example queries:
            </p>
            <div className="flex flex-wrap gap-2">
              {feat.example_queries.map((q, i) => (
                <code
                  key={i}
                  className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs"
                >
                  {q}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Example input */}
        {feat.example_input && (
          <div>
            <p className="text-sm font-medium text-gray-800 mb-1">
              Example input:
            </p>
            <p className="bg-gray-50 border border-gray-200 rounded-lg p-3 italic text-gray-600 text-xs">
              {feat.example_input}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded bg-gray-200" />
        <div className="space-y-2">
          <div className="h-6 w-64 bg-gray-200 rounded" />
          <div className="h-4 w-96 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="border-t border-gray-200" />
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="h-20 rounded-lg bg-gray-200"
          />
        ))}
      </div>
      {/* Tabs skeleton */}
      <div className="h-10 bg-gray-200 rounded-lg" />
      {/* Cards skeleton */}
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-36 rounded-lg bg-gray-200" />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function InfoPage() {
  const [data, setData] = useState<InfoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("core");

  useEffect(() => {
    fetch(`${API_URL}/info?format=json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  /* ---------- Loading / Error states ---------- */

  if (loading) return <Skeleton />;

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 font-medium">
          Failed to load documentation: {error ?? "Unknown error"}
        </p>
        <Link href="/books" className="text-indigo-600 hover:underline text-sm">
          ← Back to catalog
        </Link>
      </div>
    );
  }

  /* ---------- Render ---------- */

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* ── Page Header ── */}
        <div className="flex items-center gap-3">
          <Link
            href="/books"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              📚 App Features & Guide
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                v{data.version}
              </span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Everything you can do with {data.name} — organized by category
              with step-by-step instructions.
            </p>
          </div>
        </div>

        {/* ── Separator ── */}
        <div className="border-t border-gray-200" />

        {/* ── Quick Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">
              {data.features.core.length}
            </p>
            <p className="text-xs text-gray-500">Core Features</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">
              {data.features.ai_powered.length}
            </p>
            <p className="text-xs text-gray-500">AI Features</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {data.features.librarian_tools.length}
            </p>
            <p className="text-xs text-gray-500">Librarian Tools</p>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-teal-600">
              {data.endpoints.length}
            </p>
            <p className="text-xs text-gray-500">API Endpoints</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div>
          {/* Tab triggers */}
          <div className="grid grid-cols-4 bg-gray-100 rounded-lg p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-2 text-sm font-medium rounded-md transition ${
                  activeTab === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="mt-4">
            {/* ── Core Features Tab ── */}
            {activeTab === "core" && (
              <div className="grid gap-4 md:grid-cols-2">
                {data.features.core.map((f) => (
                  <SimpleFeatureCard
                    key={f.name}
                    feature={f}
                    badgeLabel="Core"
                    badgeVariant="outline"
                  />
                ))}
              </div>
            )}

            {/* ── AI Features Tab ── */}
            {activeTab === "ai" && (
              <>
                <div className="mb-4 p-3 rounded-lg bg-purple-50 border border-purple-200">
                  <p className="text-sm text-purple-700 flex items-center gap-2">
                    ✨ These features are powered by Google Gemini AI and
                    LangChain to deliver intelligent library experiences.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {data.features.ai_powered.map((feat) => (
                    <AiFeatureCard key={feat.name} feat={feat} />
                  ))}
                </div>
              </>
            )}

            {/* ── Librarian Tools Tab ── */}
            {activeTab === "librarian" && (
              <>
                <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-sm text-amber-700 flex items-center gap-2">
                    🔧 Tools available to users with the Librarian role for
                    managing the catalog, readers, and checkout approvals.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {data.features.librarian_tools.map((f) => (
                    <SimpleFeatureCard
                      key={f.name}
                      feature={f}
                      badgeLabel="Librarian"
                      badgeVariant="default"
                    />
                  ))}
                </div>
              </>
            )}

            {/* ── Reference Tab ── */}
            {activeTab === "reference" && (
              <div className="space-y-10">
                {/* Tech Stack */}
                <section>
                  <h2 className="text-lg font-bold text-gray-900 mb-3">
                    Tech Stack
                  </h2>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="px-4 py-2 font-semibold text-gray-500 uppercase text-xs tracking-wider">
                            Layer
                          </th>
                          <th className="px-4 py-2 font-semibold text-gray-500 uppercase text-xs tracking-wider">
                            Technology
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(data.tech_stack).map(([k, v]) => (
                          <tr key={k} className="border-b border-gray-100">
                            <td className="px-4 py-2.5 font-semibold text-gray-800">
                              {k
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (c) => c.toUpperCase())}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Architecture */}
                <section>
                  <h2 className="text-lg font-bold text-gray-900 mb-3">
                    Architecture
                  </h2>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                    <p className="text-sm text-gray-700">
                      {data.architecture.summary}
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                      {data.architecture.flow.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </section>

                {/* All Endpoints */}
                <section>
                  <h2 className="text-lg font-bold text-gray-900 mb-3">
                    All Endpoints ({data.endpoints.length})
                  </h2>
                  <p className="text-gray-500 text-sm mb-3">
                    All endpoints require{" "}
                    <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">
                      Authorization: Bearer &lt;token&gt;
                    </code>{" "}
                    unless Auth column says &quot;None&quot;.
                  </p>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-xs">
                            Method
                          </th>
                          <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-xs">
                            Path
                          </th>
                          <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-xs">
                            Auth
                          </th>
                          <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-xs">
                            Limit
                          </th>
                          <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-xs">
                            Purpose
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.endpoints.map((ep, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="px-3 py-2">
                              <MethodBadge method={ep.method} />
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-gray-700">
                              {ep.path}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {ep.auth}
                            </td>
                            <td className="px-3 py-2">
                              <RateBadge text={ep.rate_limit} />
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {ep.purpose}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Rate Limits */}
                <section>
                  <h2 className="text-lg font-bold text-gray-900 mb-3">
                    Rate Limits
                  </h2>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="px-4 py-2 font-semibold text-gray-500 uppercase text-xs">
                            Feature
                          </th>
                          <th className="px-4 py-2 font-semibold text-gray-500 uppercase text-xs">
                            Endpoint
                          </th>
                          <th className="px-4 py-2 font-semibold text-gray-500 uppercase text-xs">
                            Limit
                          </th>
                          <th className="px-4 py-2 font-semibold text-gray-500 uppercase text-xs">
                            Implementation
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.rate_limits.map((r, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="px-4 py-2 font-semibold text-gray-800">
                              {r.feature}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-gray-700">
                              {r.endpoint}
                            </td>
                            <td className="px-4 py-2 text-gray-600">
                              {r.limit}
                            </td>
                            <td className="px-4 py-2 text-gray-500 text-xs">
                              {r.type}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Walkthrough */}
                <section>
                  <h2 className="text-lg font-bold text-gray-900 mb-3">
                    Feature Walkthrough
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Reader Flow */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                          R
                        </span>
                        Reader Flow
                      </h3>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                        {data.walkthrough.reader_flow.map((s, i) => (
                          <li key={i}>{s.replace(/^\d+\.\s*/, "")}</li>
                        ))}
                      </ol>
                    </div>
                    {/* Librarian Flow */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                          L
                        </span>
                        Librarian Flow
                      </h3>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                        {data.walkthrough.librarian_flow.map((s, i) => (
                          <li key={i}>{s.replace(/^\d+\.\s*/, "")}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="pt-6 border-t border-gray-200 text-center text-sm text-gray-400 space-x-3">
          <span>
            {data.name} v{data.version}
          </span>
          <span>·</span>
          <a
            href={`${API_URL}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-500 hover:underline"
          >
            Swagger UI
          </a>
          <span>·</span>
          <a
            href={`${API_URL}/info`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-500 hover:underline"
          >
            JSON
          </a>
          <span>·</span>
          <Link href="/books" className="text-indigo-500 hover:underline">
            Catalog
          </Link>
        </div>
      </div>
    </div>
  );
}
