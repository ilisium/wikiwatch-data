// WikiWatch's record as files, for a public data repository where git keeps every version: each
// article a folder of small JSON files, written the same way every time (keys sorted, no clocks
// that tick on their own), so a commit shows exactly what changed: a new difference found, a
// version's trust moving, a fact's checks coming in. Wikipedia's own text is not copied: each
// version is named by its revision, which Wikipedia keeps for ever.
//
//   node scripts/wiki-export.mjs [--api http://127.0.0.1:4010] [--out ../../.tmp/wikiwatch-data] [--limit N]
//
// Layout (docs/WIKIWATCH_DATA_REPO.md):
//   index.json                          every article in brief, sorted by id
//   articles/<sh>/<id>/article.json     the article and each language version, with its revision
//   articles/<sh>/<id>/differences.json the questions the versions answer differently
//   articles/<sh>/<id>/runs.json        who compared them, with which model and what it cost
//   articles/<sh>/<id>/trust.json       each version's integrity score, tier and reasons
//   articles/<sh>/<id>/readings.json    other encyclopedias read beside it
//   articles/<sh>/<id>/facts.json       facts taken out, with checks once each quorum is in
// <sh> is the id's first two letters, so no folder holds more than a few hundred articles.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const API = option("api", "http://127.0.0.1:4010").replace(/\/$/u, "");
const OUT = option(
  "out",
  new URL("../../../.tmp/wikiwatch-data/", import.meta.url).pathname.replace(
    /^\/([A-Za-z]:)/u,
    "$1",
  ),
);
const LIMIT = Number(option("limit", "100000"));
const PROJECT = "wikipedia-health-map";
const BASE = `${API}/api/workspace/projects/${PROJECT}/wiki`;
/** fields that change with every reading of the same thing, and say nothing new */
const CLOCKS = new Set(["computedAt", "checkedAt", "lastUsedAt", "readAt", "updatedAt"]);

async function get(path) {
  for (let tries = 0; ; tries += 1) {
    const response = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json", "User-Agent": "IlisiumExport/0.1 (WikiWatch data)" },
    });
    if (response.ok) return response.json();
    if ((response.status === 429 || response.status >= 500) && tries < 4) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** tries));
      continue;
    }
    throw new Error(`${path}: ${response.status}`);
  }
}

/** Keys sorted all the way down, clocks left out: the same record writes the same bytes. */
function steady(value) {
  if (Array.isArray(value)) return value.map(steady);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => !CLOCKS.has(key))
        .sort()
        .map((key) => [key, steady(value[key])]),
    );
  return value;
}
const write = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(steady(value), null, 1)}\n`);
};
const shard = (id) => id.slice(0, 2).padEnd(2, "_");

// every article, a page of the list at a time
const brief = [];
for (let offset = 0; offset < LIMIT; offset += 200) {
  const page = await get(`/articles?sort=name&limit=200&offset=${offset}`);
  brief.push(...page.articles);
  if (offset + 200 >= page.total) break;
}
brief.sort((a, b) => a.id.localeCompare(b.id));
await rm(join(OUT, "articles"), { recursive: true, force: true });
let files = 0;
for (const [at, row] of brief.slice(0, LIMIT).entries()) {
  const dir = join(OUT, "articles", shard(row.id), row.id);
  const [full, points, runs, trust, readings, claims] = await Promise.all([
    get(`/${row.id}`),
    get(`/points?page=${row.id}`).catch(() => ({ points: [] })),
    get(`/runs?page=${row.id}`).catch(() => ({ runs: [] })),
    get(`/${row.id}/integrity`).catch(() => null),
    get(`/${row.id}/readings`).catch(() => ({ readings: [] })),
    get(`/claims?page=${row.id}`).catch(() => ({ claims: [] })),
  ]);
  const page = full.page;
  await write(join(dir, "article.json"), {
    id: page.id,
    asked: page.asked,
    title: page.title,
    qid: page.qid,
    description: page.description,
    // each version as measured: its revision names the exact text that was read
    versions: (page.versions ?? []).map((one) => ({
      lang: one.lang,
      language: one.language,
      title: one.title,
      url: one.url,
      revid: one.revid ?? null,
      characters: one.characters,
      citations: one.citations,
      readers: one.readers ?? null,
      protection: one.protection ?? null,
    })),
    missing: page.missing ?? [],
  });
  await write(join(dir, "differences.json"), points.points ?? []);
  await write(join(dir, "runs.json"), runs.runs ?? []);
  if (trust)
    await write(join(dir, "trust.json"), { versions: trust.versions ?? trust.scores ?? trust });
  await write(join(dir, "readings.json"), readings.readings ?? []);
  // a fact's checks show only once its quorum is in: until then the API hides them, and so do these files
  await write(join(dir, "facts.json"), claims.claims ?? []);
  files += 6;
  if ((at + 1) % 25 === 0) console.log(`${at + 1} of ${brief.length}`);
}
await write(join(OUT, "index.json"), {
  project: "WikiWatch",
  source: "https://ilisium.xyz/workspace/wikiwatch",
  licence:
    "Measurements and research: CC BY-SA 4.0, like the Wikipedia articles they describe. Quotes are Wikipedia's words, under its licence.",
  articles: brief.map((row) => ({
    id: row.id,
    asked: row.asked,
    languages: row.versions,
    differences: row.points,
    runs: row.runs,
    tier: row.tier,
    path: `articles/${shard(row.id)}/${row.id}/`,
  })),
});
console.log(`${brief.length} articles, ${files + 1} files, in ${OUT}`);
