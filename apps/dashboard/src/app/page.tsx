'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  parseSDP,
  validateSDP,
  diffSDPs,
  runDiagnostics,
  type ParsedSDP,
  type SDPSource,
  type SDPDiffResult,
  type DiagnosticIssue,
} from '@signalflow/shared';
import { SdpTextarea } from '@/components/SdpTextarea';
import { IssuesPanel } from '@/components/IssuesPanel';
import { ShareButton } from '@/components/ShareButton';
import { BrowserBadge } from '@/components/BrowserBadge';
import { saveToHash, loadFromHash } from '@/lib/share';

// ── Diff display helpers ────────────────────────────────────────────

function DiffSummaryBar({ diff }: { diff: SDPDiffResult }) {
  const { summary } = diff;
  const total =
    summary.changes + summary.additions + summary.removals + summary.errors + summary.warnings;
  if (total === 0) {
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
        <p className="text-sm font-medium text-green-400">
          ✓ SDPs are identical — no differences found
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {summary.changes > 0 && (
        <span className="rounded bg-amber-500/20 px-2 py-0.5 font-medium text-amber-300">
          {summary.changes} changed
        </span>
      )}
      {summary.additions > 0 && (
        <span className="rounded bg-green-500/20 px-2 py-0.5 font-medium text-green-300">
          {summary.additions} added
        </span>
      )}
      {summary.removals > 0 && (
        <span className="rounded bg-red-500/20 px-2 py-0.5 font-medium text-red-300">
          {summary.removals} removed
        </span>
      )}
    </div>
  );
}

function DiffItemsList({ diff }: { diff: SDPDiffResult }) {
  if (diff.items.length === 0) return null;

  const typeColor: Record<string, string> = {
    changed: 'border-l-amber-500',
    added: 'border-l-green-500',
    removed: 'border-l-red-500',
    unchanged: 'border-l-zinc-700',
  };

  return (
    <div className="flex flex-col gap-2">
      {diff.items.map((item, i) => (
        <div
          key={`${item.path}-${i}`}
          className={`rounded-lg border border-zinc-800 bg-zinc-900/50 border-l-4 ${typeColor[item.type] ?? 'border-l-zinc-700'}`}
        >
          <div className="px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-500">{item.path}</span>
              <span className="text-xs font-semibold text-zinc-200">{item.label}</span>
            </div>
            {(item.valueBefore || item.valueAfter) && (
              <div className="mt-1 flex flex-wrap gap-3 text-xs font-mono">
                {item.valueBefore && (
                  <span className="text-red-400">
                    − {item.valueBefore}
                  </span>
                )}
                {item.valueAfter && (
                  <span className="text-green-400">
                    + {item.valueAfter}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────

export default function Home() {
  const [sdp1Raw, setSdp1Raw] = useState('');
  const [sdp2Raw, setSdp2Raw] = useState('');
  const [error1, setError1] = useState<string | null>(null);
  const [error2, setError2] = useState<string | null>(null);
  const [parsed1, setParsed1] = useState<ParsedSDP | null>(null);
  const [parsed2, setParsed2] = useState<ParsedSDP | null>(null);
  const [diff, setDiff] = useState<SDPDiffResult | null>(null);
  const [issues, setIssues] = useState<DiagnosticIssue[]>([]);
  const [activeTab, setActiveTab] = useState<'diff' | 'diagnostics'>('diagnostics');

  // Load from URL hash on mount
  useEffect(() => {
    const saved = loadFromHash();
    if (saved) {
      setSdp1Raw(saved.sdp1);
      setSdp2Raw(saved.sdp2);
    }
  }, []);

  // Analyze whenever inputs change
  const analyze = useCallback(() => {
    // Validate & parse SDP 1
    const v1 = validateSDP(sdp1Raw);
    if (!v1.valid) {
      setError1(v1.error ?? 'Invalid SDP');
      setParsed1(null);
    } else {
      setError1(null);
      setParsed1(parseSDP(sdp1Raw));
    }

    // Validate & parse SDP 2
    const v2 = validateSDP(sdp2Raw);
    if (!v2.valid) {
      setError2(v2.error ?? 'Invalid SDP');
      setParsed2(null);
    } else {
      setError2(null);
      setParsed2(parseSDP(sdp2Raw));
    }
  }, [sdp1Raw, sdp2Raw]);

  // Run analysis when parsed results change
  useEffect(() => {
    if (parsed1 && parsed2) {
      setDiff(diffSDPs(parsed1, parsed2));
      setIssues(runDiagnostics(parsed1, parsed2));
      saveToHash(sdp1Raw, sdp2Raw);
    } else {
      setDiff(null);
      setIssues([]);
    }
  }, [parsed1, parsed2, sdp1Raw, sdp2Raw]);

  // Re-analyze when text changes (debounced feel via useEffect)
  useEffect(() => {
    if (!sdp1Raw && !sdp2Raw) return;
    analyze();
  }, [sdp1Raw, sdp2Raw, analyze]);

  const hasResults = parsed1 && parsed2;

  return (
    <div className="flex min-h-full flex-col bg-zinc-950">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="border-b border-zinc-800/60 bg-zinc-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <span className="text-sm font-bold text-white">SF</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-100">SignalFlow</h1>
              <p className="text-xs text-zinc-500">WebRTC SDP Analyzer</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasResults && <ShareButton />}
            {parsed1 && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                Source: <BrowserBadge source={parsed1.source} />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── SDP Input Area ──────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <SdpTextarea
            label="Offer SDP"
            value={sdp1Raw}
            onChange={setSdp1Raw}
            error={error1}
            source={parsed1?.source}
          />
          <SdpTextarea
            label="Answer SDP"
            value={sdp2Raw}
            onChange={setSdp2Raw}
            error={error2}
            source={parsed2?.source}
          />
        </div>

        {/* ── Results ───────────────────────────────────────────── */}
        {hasResults && (
          <div className="mt-10">
            {/* Tab bar */}
            <div className="flex items-center gap-1 border-b border-zinc-800/60 pb-px">
              <button
                onClick={() => setActiveTab('diagnostics')}
                className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'diagnostics'
                    ? 'bg-zinc-800/60 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Diagnostics
                {issues.length > 0 && (
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/20 px-1.5 text-xs font-semibold text-red-300">
                    {issues.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('diff')}
                className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'diff'
                    ? 'bg-zinc-800/60 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Diff
                {diff && diff.items.length > 0 && (
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-xs font-semibold text-amber-300">
                    {diff.items.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab content */}
            <div className="mt-6">
              {activeTab === 'diagnostics' && (
                <IssuesPanel issues={issues} />
              )}

              {activeTab === 'diff' && diff && (
                <div className="flex flex-col gap-4">
                  <DiffSummaryBar diff={diff} />
                  <DiffItemsList diff={diff} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasResults && !sdp1Raw && !sdp2Raw && (
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/50">
              <span className="text-2xl">📡</span>
            </div>
            <h2 className="text-xl font-semibold text-zinc-200">
              Paste your WebRTC SDPs
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-zinc-500">
              Paste an Offer SDP on the left and an Answer SDP on the right.
              SignalFlow will detect the source browser, diff the two, and run
              18 diagnostic rules to surface issues with ICE, DTLS, codecs,
              simulcast, and BUNDLE.
            </p>
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/40 py-4">
        <p className="text-center text-xs text-zinc-600">
          SignalFlow — Open-source WebRTC SDP debugger
        </p>
      </footer>
    </div>
  );
}
