import type { Node } from '../api'
import { MODE_LABEL, NAMED, TANGLE_EDGES, type ColorMode } from '../colorMode'
import { namedClause } from '../reportTables'
import { FORM, type Report } from './types'

/**
 * What the prose's `{slots}` and `{?gates}` fill with, for this repository — the methodology's
 * (`methodVars`) and the essays' (`lensVars`).
 */

/** Which lens pages this report has, as gates for the prose: a sentence comparing against a lens
 *  prints only where that lens's page does. `readings` is any lens a reading paints. */
function lensGates(o: Report): Record<string, string> {
  const has = (m: ColorMode) => (o.locks[m] ? '' : 'yes')
  const readings = (['surprise', 'legible', 'docs', 'traps'] as ColorMode[]).some((m) => has(m))
  const langs = new Set(o.stats.languages)
  const yes = (b: boolean) => (b ? 'yes' : '')
  return {
    surprise: has('surprise'),
    legible: has('legible'),
    docs: has('docs'),
    traps: has('traps'),
    readings: readings ? 'yes' : '',
    // **A caveat about a language prints where that language is.** sanity's report, of Rust and
    // TypeScript, explained how C headers and Nix are counted, on the page that is supposed to be
    // about this repository.
    rust: yes(langs.has('Rust')),
    nix: yes(langs.has('Nix')),
    cFamily: yes(['C', 'C++', 'Objective-C'].some((l) => langs.has(l))),
    manyLanguages: yes(langs.size > NAMED),
    // Only a report and a deck draw each group on a map of its own.
    groupMaps: yes(o.form !== 'brief'),
  }
}

/** The slots the methodology names, filled from this repository. */
export function methodVars(o: Report, findings: number, full: Node | null): Record<string, string> {
  const s = o.stats
  const n = (v: number) => v.toLocaleString()
  const langs =
    s.languages.length > 12
      ? `${s.languages.slice(0, 12).join(', ')} and ${s.languages.length - 12} more`
      : s.languages.join(', ') || 'none'
  const locked = (Object.keys(o.locks) as ColorMode[]).map((m) => MODE_LABEL[m])
  const reader =
    s.models.length === 0
      ? 'No readings have been taken in this repository.'
      : s.model
        ? `This corpus was read by ${s.model}${s.harness ? ` via ${s.harness}` : ''}.`
        : `This corpus mixes readings from ${s.models.map((m) => `${m.model} (${n(m.readings)})`).join(', ')}, and is therefore not on one scale.`
  const window = o.views.churn.windows[o.views.churn.at]
  return {
    ...lensGates(o),
    formNoun: FORM[o.form].noun,
    repoSlug: o.slug,
    commitClause: o.head
      ? `at commit ${o.head.sha}${o.head.dirty === true ? ', with uncommitted changes' : ''}`
      : 'as found on disk',
    functions: n(s.functions),
    files: n(s.files),
    lines: n(s.lines),
    grammarClause: s.grammars ? `${s.grammars} grammars in this build; present here: ${langs}` : `present here: ${langs}`,
    unparsed: s.unparsed == null ? 'not reported' : n(s.unparsed),
    churnWindow: window ? String(window) : '90',
    findings: n(findings),
    lockedClause: locked.length ? locked.join(', ') : 'none here',
    // Only a report has tables to name functions in, and an appendix.
    namedClause: o.form === 'report' ? namedClause(full) : '',
    appendix: o.form === 'report' ? 'yes' : '',
    readerClause: reader,
    assessed: n(s.assessed),
    readable: n(s.functions + s.files),
    stale: n(s.stale),
  }
}

/** `a`, `a and b`, `a, b and c`. */
function joinList(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * The facts an essay's tokens stand for, for this repo.
 *
 * **Each is a whole sentence or nothing.** A token with no fact behind it — a scan too old to
 * count resolved calls, a repo no one has read — fills as empty and its sentence goes with it,
 * so the essay never prints a number it does not have or a zero standing in for one.
 */
export function lensVars(o: Report, readerClause: string): Record<string, string> {
  const s = o.stats
  const n = (v: number) => v.toLocaleString()
  const band = (i: number) =>
    i >= TANGLE_EDGES.length
      ? `${n(TANGLE_EDGES[TANGLE_EDGES.length - 1] + 1)} lines and over`
      : `${n(i === 0 ? 1 : TANGLE_EDGES[i - 1] + 1)}–${n(TANGLE_EDGES[i])} lines`
  // A line each, set as a list: nine bands in one sentence was a table read aloud.
  const medians = s.tangleBands.flatMap((med, i) => (med == null ? [] : [`- ${band(i)}: ${n(med)}`]))
  const calls = (s.callsResolved ?? 0) + (s.callsUnresolved ?? 0)
  const window = o.views.churn.windows[o.views.churn.at]
  const readable = s.functions + s.files
  return {
    ...lensGates(o),
    // Which reading a deck line describes.
    rawTangle: o.views.tangle === 'raw' ? 'yes' : '',
    oldestAge: o.views.age.read === 'oldest' ? 'yes' : '',
    tangleMedians: medians.length ? `In ${o.slug} the median count per size band is:\n${medians.join('\n')}` : '',
    languageCount: s.languages.length
      ? `The function bodies of ${o.slug} are written in ${n(s.languages.length)} language${s.languages.length === 1 ? '' : 's'}.`
      : '',
    callsResolved:
      s.callsResolved != null && calls > 0
        ? `In ${o.slug}, ${n(s.callsResolved)} of ${n(calls)} call sites (${Math.round((s.callsResolved / calls) * 100)}%) resolved to a definition in the repository; the rest name code outside it or could not be matched.`
        : '',
    authorsCommits:
      s.commits > 0
        ? `${o.slug} has ${n(s.commits)} commit${s.commits === 1 ? '' : 's'} by ${n(s.authors)}${s.authors >= 64 ? ' or more' : ''} author${s.authors === 1 ? '' : 's'}.`
        : '',
    ageSpan:
      s.ageSpan != null && s.ageSpan > 0
        ? `The span of ${o.slug} is ${n(Math.round(s.ageSpan))} day${Math.round(s.ageSpan) === 1 ? '' : 's'}: its oldest surviving line is that old.`
        : '',
    churnWindows:
      s.churnWindows.length && window
        ? `The windows offered for ${o.slug} are ${joinList(s.churnWindows.map(n))} days, and the figure uses the ${n(window)}-day window.`
        : '',
    readingState:
      readable > 0
        ? `In ${o.slug}, ${n(s.assessed)} of ${n(readable)} functions and files have current readings, and ${n(s.stale)} ${s.stale === 1 ? 'is' : 'are'} stale. ${readerClause}`
        : '',
  }
}
