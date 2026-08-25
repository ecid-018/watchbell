/* ------------------------------------------------------------------
   Highlighters.

   A mark is a colour against one verse, and it means whatever you decide it
   means — the app does not name the colours or count them. They are keyed by
   book, chapter and verse rather than by reading day, so a verse stays marked
   however you come back to it: through the plan, through the reader, or on
   the next voyage.
------------------------------------------------------------------ */

export const COLOURS = [
  { id: "gold", token: "gold" },
  { id: "foam", token: "foam" },
  { id: "oxide", token: "oxide" },
];

export const markKey = (ref, verse) => `${ref.book}.${ref.chapter}.${verse}`;

export const colourOf = (marks, ref, verse) => marks[markKey(ref, verse)] || null;

export const toggleMark = (marks, ref, verse, colour) => {
  const key = markKey(ref, verse);
  const next = { ...marks };
  if (!colour || next[key] === colour) delete next[key];
  else next[key] = colour;
  return next;
};

/** Everything marked in a chapter, in verse order, with the words attached. */
export function marksIn(marks, ref, lines) {
  const out = [];
  for (const line of lines || []) {
    if (line.kind !== "verse") continue;
    const colour = colourOf(marks, ref, line.n);
    if (colour) out.push({ verse: line.n, text: line.text, colour, ref });
  }
  return out;
}

/** How a marked verse reads once it is sitting in a reflection. */
export const quote = (mark) => `"${mark.text}" — ${mark.ref.label}:${mark.verse}`;
