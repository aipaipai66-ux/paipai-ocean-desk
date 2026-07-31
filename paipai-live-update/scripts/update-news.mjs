import { readFile, writeFile } from "node:fs/promises";

const outputPath = new URL("../news-data.json", import.meta.url);

async function readExisting() {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch {
    return { china: [], world: [], ai: [], popular: [] };
  }
}

function relativeDate(value) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes || 1}分钟前`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}小时前`;
  return `${Math.round(minutes / 1440)}天前`;
}

function gdeltDate(value) {
  if (!value || value.length < 14) return "刚刚";
  return relativeDate(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}Z`);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "paipai-ocean-desk/1.0" },
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function getGdelt(query) {
  const params = new URLSearchParams({
    query, mode: "artlist", maxrecords: "20", format: "json", sort: "datedesc", timespan: "48h"
  });
  const data = await fetchJson(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`);
  return (data.articles || []).filter(item => item.title && item.url).slice(0, 12).map(item => ({
    title: item.title,
    url: item.url,
    source: item.domain || item.sourcecountry || "GDELT",
    date: gdeltDate(item.seendate)
  }));
}

async function getAi(popular = false) {
  const params = new URLSearchParams({
    query: "AI artificial intelligence LLM", tags: "story", hitsPerPage: "20"
  });
  const endpoint = popular ? "search" : "search_by_date";
  const data = await fetchJson(`https://hn.algolia.com/api/v1/${endpoint}?${params}`);
  return (data.hits || []).filter(item => item.title && (item.url || item.objectID)).slice(0, 12).map(item => ({
    title: item.title,
    url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
    source: item.url ? new URL(item.url).hostname.replace(/^www\./, "") : "Hacker News",
    date: relativeDate(item.created_at)
  }));
}

const existing = await readExisting();
const jobs = {
  china: () => getGdelt("sourcecountry:china"),
  world: () => getGdelt("(sourcecountry:unitedstates OR sourcecountry:unitedkingdom OR sourcecountry:japan OR sourcecountry:france OR sourcecountry:germany)"),
  ai: () => getAi(false),
  popular: () => getAi(true)
};

const next = { ...existing, updatedAt: new Date().toISOString() };
for (const [key, job] of Object.entries(jobs)) {
  try {
    const items = await job();
    if (items.length) next[key] = items;
  } catch (error) {
    console.warn(`${key} update failed:`, error.message);
  }
}

await writeFile(outputPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
