// Canonical schools, and the messy reality of the Google Form behind them.
//
// The form's School column is a dropdown WITH an "Other" escape hatch, and the
// sheet shows what that produces: Hopkins High alone arrives as "hhs", "HHs",
// "HHS/", "Hopkins High", "Hopkins High School", "Hopkins High/North Middle
// School" and "HHS/NMS/WMS", plus "meadowbrook" beside "Meadowbrook" and at
// least one row reading "Late dropping".
//
// Subscribers pick from a fixed list; delays arrive as that free text. Matching
// one against the other RAW would silently deliver nothing, which is the worst
// failure this app has — it looks healthy and nobody is told their bus is late.
// So every sheet value is resolved to canonical ids here, and matching happens
// on ids alone.
//
// A value may resolve to SEVERAL schools, which is not an edge case: one bus
// serves the high school and both middle schools, and "HHS/NMS/WMS" means all
// three. A parent subscribed to any one of them should be told.

export interface School {
  id: string;
  label: string;
}

/** The subscribe form's dropdown, in the order it renders.
 *
 *  Derived from what the sheet has actually reported rather than from a
 *  district roster, so a school nobody has ever reported late is missing. Add
 *  one here and to ALIASES below; nothing else needs to change. */
export const SCHOOLS: School[] = [
  { id: "alice-smith", label: "Alice Smith Elementary" },
  { id: "eisenhower", label: "Eisenhower Elementary (IKE)" },
  { id: "gatewood", label: "Gatewood Elementary" },
  { id: "glen-lake", label: "Glen Lake Elementary" },
  { id: "meadowbrook", label: "Meadowbrook Elementary" },
  { id: "tanglen", label: "Tanglen Elementary" },
  { id: "help", label: "H.E.L.P." },
  { id: "north-middle", label: "North Middle School" },
  { id: "west-middle", label: "West Middle School" },
  { id: "hopkins-high", label: "Hopkins High School" },
];

const SCHOOL_IDS = new Set(SCHOOLS.map((s) => s.id));

/** Patterns tested against the NORMALIZED form of a raw value (lowercased,
 *  every run of non-alphanumerics collapsed to a single space). All of them are
 *  tested, not just the first — that is what lets one value name three schools.
 *
 *  Abbreviations are matched as whole words. "wms" must not fire on "north
 *  middle school", and "high school" is deliberately NOT a pattern for
 *  hopkins-high: it appears inside "North Middle School"'s neighbours often
 *  enough that it would over-match. */
const ALIASES: Record<string, RegExp[]> = {
  "alice-smith": [/\balice\b/],
  eisenhower: [/\beisenhower\b/, /\bike\b/],
  gatewood: [/\bgatewood\b/],
  "glen-lake": [/\bglen\b/],
  meadowbrook: [/\bmeadowbrook\b/, /\bmeadow brook\b/],
  tanglen: [/\btanglen\b/],
  help: [/\bh e l p\b/, /\bhelp\b/, /\bharley\b/],
  "north-middle": [/\bnms\b/, /\bnorth middle\b/, /\bnorth junior\b/],
  "west-middle": [/\bwms\b/, /\bwest middle\b/, /\bwest junior\b/],
  "hopkins-high": [/\bhhs\b/, /\bhopkins high\b/],
};

export function normalizeSchoolText(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Every canonical school a raw sheet value refers to.
 *
 *  Returns [] for junk ("Late dropping") and for a school not in the list. An
 *  empty result is why `notify.ts` logs the raw value: a bus reported late at a
 *  school nobody can subscribe to is a gap in SCHOOLS, and the log is the only
 *  place it would ever show up. */
export function resolveSchools(raw: string): string[] {
  const text = normalizeSchoolText(raw);
  if (!text) return [];
  const hits: string[] = [];
  for (const [id, patterns] of Object.entries(ALIASES)) {
    if (patterns.some((p) => p.test(text))) hits.push(id);
  }
  return hits;
}

/** True if `id` is one this app knows — the guard on anything a client sends. */
export function isKnownSchool(id: string): boolean {
  return SCHOOL_IDS.has(id);
}

export function schoolLabel(id: string): string {
  return SCHOOLS.find((s) => s.id === id)?.label ?? id;
}
