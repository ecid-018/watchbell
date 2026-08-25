/* ------------------------------------------------------------------
   The text of the day's reading, carried rather than fetched.

   Everything here is cache-first and stays that way: nothing in this file
   touches the network unless you tapped a button that says it will. The
   passage is loaded while there is a satellite and read for the next forty
   days without one.

   Text comes from the Free Use Bible API (bible.helloao.org), which needs
   no key, sets no limits, and serves the Berean Standard Bible under terms
   that permit keeping a copy. That last part is why it is this API and not
   a better-known one: API.Bible requires cached text be refreshed every
   thirty days and the ESV API caps a cache at five hundred verses, and a
   forty-day passage breaks both.
------------------------------------------------------------------ */

const CACHE = "watchbell-bible-v1";
const API = "https://bible.helloao.org/api";

export const TRANSLATION = "BSB";
export const TRANSLATION_NAME = "Berean Standard Bible";

/** Only what the reading plan actually names. */
const BOOKS = { Psalm: "PSA", Psalms: "PSA", Matthew: "MAT", Mark: "MRK" };

export const parseRef = (ref) => {
  const m = /^\s*([A-Za-z]+)\s+(\d+)\s*$/.exec(String(ref || ""));
  const book = m && BOOKS[m[1]];
  return book ? { book, chapter: Number(m[2]), label: String(ref).trim() } : null;
};

export const urlFor = (ref) => `${API}/${TRANSLATION}/${ref.book}/${ref.chapter}.json`;

const openCache = async () => {
  try {
    return typeof caches === "undefined" ? null : await caches.open(CACHE);
  } catch (e) {
    return null; // no storage, no cache — the reference alone still shows
  }
};

/** Cache only. Never reaches the network, whatever the connection is doing. */
export async function readCached(ref) {
  if (!ref) return null;
  const cache = await openCache();
  if (!cache) return null;
  try {
    const hit = await cache.match(urlFor(ref));
    return hit ? await hit.json() : null;
  } catch (e) {
    return null;
  }
}

/**
 * Every URL already aboard, in one read.
 *
 * Asking the cache 1,189 separate questions to draw a progress bar is slower
 * than the download it is describing; cache.keys() answers all of them at once.
 */
export async function cachedUrls() {
  const cache = await openCache();
  if (!cache) return new Set();
  try {
    return new Set((await cache.keys()).map((r) => r.url));
  } catch (e) {
    return new Set();
  }
}

export async function countCached(refs) {
  const have = await cachedUrls();
  return refs.reduce((n, ref) => n + (have.has(urlFor(ref)) ? 1 : 0), 0);
}

/** The whole canon, with chapter counts. Cached like everything else. */
export async function listBooks() {
  const url = `${API}/${TRANSLATION}/books.json`;
  const cache = await openCache();
  try {
    const hit = cache && (await cache.match(url));
    if (hit) return (await hit.json()).books || [];
  } catch (e) { /* fall through to the network */ }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    if (cache) await cache.put(url, res.clone());
    return (await res.json()).books || [];
  } catch (e) {
    return [];
  }
}

/** Every chapter of every book, in canonical order. */
export const allRefs = (books) =>
  books.flatMap((b) =>
    Array.from({ length: b.numberOfChapters }, (_, i) => ({
      book: b.id, chapter: i + 1, label: `${b.commonName || b.name} ${i + 1}`,
    })),
  );

/**
 * The only function in the app that goes out to the network, and it runs on a
 * tap. One chapter at a time rather than in parallel: a satellite link is not
 * helped by forty simultaneous requests, and a slow success beats a fast
 * failure when the alternative is forty days without the text.
 */
export async function fetchInto(refs, onProgress, opts = {}) {
  const cache = await openCache();
  const have = await cachedUrls();
  // The key listing is the fast path. Where it comes back empty — a genuinely
  // empty cache, or a browser that would not enumerate it — fall back to asking
  // per URL, so a resumed download never re-fetches what is already down.
  const aboard = async (url) =>
    have.size ? have.has(url) : !!(cache && (await cache.match(url)));
  const tally = { got: 0, already: 0, failed: 0, done: 0, total: refs.length };
  const stop = opts.signal;

  // A handful at a time. One at a time is three minutes for a whole Bible;
  // all of them at once is a satellite link asked to do something unkind.
  const lanes = Math.max(1, Math.min(8, opts.concurrency || 1));
  let next = 0;

  const worker = async () => {
    while (next < refs.length) {
      if (stop?.aborted) return;
      const ref = refs[next++];
      const url = urlFor(ref);
      try {
        if (await aboard(url)) {
          tally.already++;
        } else {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          if (cache) await cache.put(url, res.clone());
          else await res.json();
          tally.got++;
        }
      } catch (e) {
        tally.failed++;
      }
      tally.done++;
      onProgress?.({ ...tally, at: ref.label });
    }
  };

  await Promise.all(Array.from({ length: lanes }, worker));
  return tally;
}

/** Drop the lot — the only way this cache ever shrinks. */
export async function clearCached() {
  try { return typeof caches === "undefined" ? false : await caches.delete(CACHE); }
  catch (e) { return false; }
}

/** A chapter payload flattened into lines the page can lay out. */
export function toLines(payload) {
  const out = [];
  for (const item of payload?.chapter?.content || []) {
    if (item.type === "heading") {
      out.push({ kind: "heading", text: (item.content || []).join(" ") });
    } else if (item.type === "hebrew_subtitle") {
      out.push({ kind: "subtitle", text: (item.content || []).join(" ") });
    } else if (item.type === "verse") {
      // Footnote markers arrive as {noteId} and carry no words; drop them.
      const text = (item.content || [])
        .map((c) => (typeof c === "string" ? c : c && c.text))
        .filter(Boolean)
        .join(" ");
      if (text) out.push({ kind: "verse", n: item.number, text });
    }
  }
  return out;
}
