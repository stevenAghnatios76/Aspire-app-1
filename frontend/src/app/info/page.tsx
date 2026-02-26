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

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="text-2xl font-bold text-gray-900 mt-12 mb-4 pb-2 border-b-2 border-gray-200 scroll-mt-20"
    >
      {children}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/*  Collapsible AI Feature Card                                        */
/* ------------------------------------------------------------------ */

function AiFeatureCard({ feat }: { feat: AiFeature }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
      >
        <span className="font-bold text-gray-900">{feat.name}</span>
        <div className="flex items-center gap-2">
          <RateBadge text={feat.rate_limit} />
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3 text-sm">
          <p className="text-gray-700">{feat.description}</p>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span>
              <strong className="text-gray-600">Endpoint:</strong>{" "}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded">
                {feat.endpoint}
              </code>
            </span>
            <span>
              <strong className="text-gray-600">Model:</strong> {feat.model}
            </span>
          </div>

          {feat.how_to_use.length > 0 && (
            <div>
              <p className="font-semibold text-gray-800 mb-1">How to use:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-gray-700">
                {feat.how_to_use.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {feat.example_queries && feat.example_queries.length > 0 && (
            <div>
              <p className="font-semibold text-gray-800 mb-1">
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

          {feat.example_input && (
            <div>
              <p className="font-semibold text-gray-800 mb-1">Example input:</p>
              <p className="bg-gray-50 border border-gray-200 rounded-lg p-3 italic text-gray-600">
                {feat.example_input}
              </p>
            </div>
          )}
        </div>
      )}
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-lg">
          Loading documentation…
        </div>
      </div>
    );
  }

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
      {/* Hero */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-extrabold text-gray-900">
              {data.name}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
              v{data.version}
            </span>
          </div>
          <p className="text-gray-500 text-lg max-w-2xl">{data.description}</p>

          {/* Badge images */}
          <div className="flex flex-wrap gap-1.5 mt-5">
            {[
              ["Python-3.11+-3776AB?logo=python&logoColor=white", "Python"],
              ["FastAPI-0.115-009688?logo=fastapi&logoColor=white", "FastAPI"],
              ["Next.js-14-000000?logo=next.js&logoColor=white", "Next.js"],
              ["React-18-61DAFB?logo=react&logoColor=black", "React"],
              ["TypeScript-5-3178C6?logo=typescript&logoColor=white", "TS"],
              ["Tailwind_CSS-3.4-38B2AC?logo=tailwindcss&logoColor=white", "TW"],
              ["Supabase-Auth+Postgres-3ECF8E?logo=supabase&logoColor=white", "Supa"],
              ["Google_Gemini-AI-4285F4?logo=google&logoColor=white", "Gemini"],
              ["pgvector-Vector_Search-8B5CF6", "pgvector"],
            ].map(([badge, alt]) => (
              <img
                key={alt}
                src={`https://img.shields.io/badge/${badge}`}
                alt={alt}
                className="h-5"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Table of Contents */}
        <nav className="bg-white border border-gray-200 rounded-lg p-5 mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            On this page
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              ["tech-stack", "Tech Stack"],
              ["architecture", "Architecture"],
              ["core-features", "Core Features"],
              ["ai-features", "AI Features"],
              ["librarian-tools", "Librarian Tools"],
              ["endpoints", "All Endpoints"],
              ["rate-limits", "Rate Limits"],
              ["walkthrough", "Walkthrough"],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        {/* ---- Tech Stack ---- */}
        <SectionHeading id="tech-stack">Tech Stack</SectionHeading>
        <div className="overflow-x-auto">
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
                    {k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---- Architecture ---- */}
        <SectionHeading id="architecture">Architecture</SectionHeading>
        <p className="text-gray-700 mb-4">{data.architecture.summary}</p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
          {data.architecture.flow.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>

        {/* ---- Core Features ---- */}
        <SectionHeading id="core-features">Core Features</SectionHeading>
        <ul className="space-y-3">
          {data.features.core.map((f) => (
            <li key={f.name} className="text-sm">
              <strong className="text-gray-900">{f.name}</strong>
              <span className="text-gray-500"> — {f.description}</span>
            </li>
          ))}
        </ul>

        {/* ---- AI Features (collapsible cards) ---- */}
        <SectionHeading id="ai-features">AI-Powered Features</SectionHeading>
        <p className="text-gray-500 text-sm mb-4">
          Click each card to expand full details, usage instructions, and
          examples.
        </p>
        {data.features.ai_powered.map((feat) => (
          <AiFeatureCard key={feat.name} feat={feat} />
        ))}

        {/* ---- Librarian Tools ---- */}
        <SectionHeading id="librarian-tools">Librarian Tools</SectionHeading>
        <ul className="space-y-3">
          {data.features.librarian_tools.map((f) => (
            <li key={f.name} className="text-sm">
              <strong className="text-gray-900">{f.name}</strong>
              <span className="text-gray-500"> — {f.description}</span>
            </li>
          ))}
        </ul>

        {/* ---- Endpoints ---- */}
        <SectionHeading id="endpoints">
          All Endpoints ({data.endpoints.length})
        </SectionHeading>
        <p className="text-gray-500 text-sm mb-3">
          All endpoints require{" "}
          <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
            Authorization: Bearer &lt;token&gt;
          </code>{" "}
          unless Auth column says &quot;None&quot;.
        </p>
        <div className="overflow-x-auto">
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
                  <td className="px-3 py-2 text-gray-600">{ep.auth}</td>
                  <td className="px-3 py-2">
                    <RateBadge text={ep.rate_limit} />
                  </td>
                  <td className="px-3 py-2 text-gray-600">{ep.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---- Rate Limits ---- */}
        <SectionHeading id="rate-limits">Rate Limits</SectionHeading>
        <div className="overflow-x-auto">
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
                  <td className="px-4 py-2 text-gray-600">{r.limit}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{r.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---- Walkthrough ---- */}
        <SectionHeading id="walkthrough">Feature Walkthrough</SectionHeading>

        <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">
          Reader Flow
        </h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 mb-6">
          {data.walkthrough.reader_flow.map((s, i) => (
            <li key={i}>{s.replace(/^\d+\.\s*/, "")}</li>
          ))}
        </ol>

        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Librarian Flow
        </h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
          {data.walkthrough.librarian_flow.map((s, i) => (
            <li key={i}>{s.replace(/^\d+\.\s*/, "")}</li>
          ))}
        </ol>

        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-gray-200 text-center text-sm text-gray-400 space-x-3">
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
