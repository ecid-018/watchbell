import React, { useEffect, useMemo, useState } from "react";

/* ------------------------------------------------------------------
   The reading, and what you make of it.

   The reflection is not a door you go through any more — it sits beside the
   text in landscape and under your thumb in portrait, so a thought can be
   written the moment it arrives rather than after you have finished and
   gone looking for somewhere to put it.

   Marking a verse and sending it across is the same idea: the words you
   want to keep should arrive in the reflection without you retyping them.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { COLOURS, colourOf, marksIn, quote, toggleMark } from "./marks.js";
import { TRANSLATION_NAME, readCached, toLines } from "./bible.js";

/** A reflection is a sentence, not a keystroke. Roughly seven or eight words. */
export const REFLECT_MIN = 40;

export default function WordTab({
  C, dark, wide, plan, readDay, isRead, reflection, marks,
  onReflect, onRead, onUnread, onMarks,
  refs, aboard, loading, online, onCarry, onCarryAll, books, browse, onBrowse,
}) {
  const [draft, setDraft] = useState(reflection ?? "");
  const [pen, setPen] = useState(null); // the marker in your hand, or none
  const [text, setText] = useState(null);
  // A saved reflection opens locked; Edit reopens it. Keyed to readDay alone
  // (not isRead/reflection, which also change on the onBlur autosave below) —
  // otherwise typing a single character would silently drop you out of edit.
  const [editing, setEditing] = useState(!isRead);

  // A different day is a different reflection; keep the editor honest.
  useEffect(() => { setDraft(reflection ?? ""); }, [readDay, reflection]);
  useEffect(() => { setEditing(!isRead); }, [readDay]);

  useEffect(() => {
    let alive = true;
    setText(null);
    (async () => {
      const loaded = [];
      for (const ref of refs) {
        const payload = await readCached(ref);
        loaded.push({ ref, lines: payload ? toLines(payload) : null });
      }
      if (alive) setText(loaded);
    })();
    return () => { alive = false; };
  }, [refs, aboard?.have]);

  const body = draft.trim();
  const short = Math.max(0, REFLECT_MIN - body.length);
  const enough = short === 0;
  const locked = isRead && !editing;

  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };

  const shownRefs = refs;

  const marked = useMemo(
    () => (text || []).flatMap(({ ref, lines }) => marksIn(marks, ref, lines)),
    [text, marks],
  );

  const append = (mark) => {
    const line = quote(mark);
    setDraft((d) => (d.trim() ? `${d.replace(/\s+$/, "")}\n\n${line}` : line));
    // A note sent to a saved reflection needs to be visible to be worth sending.
    if (isRead) setEditing(true);
  };

  /* -------- the marker -------- */

  const markerRow = (
    <div className="flex items-center gap-2">
      <span style={eyebrow}>MARKER</span>
      {COLOURS.map((c) => (
        <button key={c.id} onClick={() => setPen(pen === c.id ? null : c.id)}
          aria-label={`Highlighter ${c.id}`}
          className="wb-t rounded-full" style={{
            width: 20, height: 20, background: C[c.token],
            border: `2px solid ${pen === c.id ? C.text : "transparent"}`,
            opacity: pen && pen !== c.id ? 0.4 : 1,
          }} />
      ))}
      <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, marginLeft: 2 }}>
        {pen ? "tap a verse" : "off"}
      </span>
    </div>
  );

  /* -------- the text -------- */

  const chapter = ({ ref, lines }) => (
    <div key={ref.label} className="mb-4">
      <div style={{ ...eyebrow, marginBottom: 4 }}>{ref.label.toUpperCase()}</div>
      {!lines && (
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.dim }}>
          Not aboard. The reference stands; carry the text next time you have a link.
        </div>
      )}
      {lines && lines.map((l, i) => {
        if (l.kind !== "verse") {
          return (
            <p key={i} style={{
              margin: l.kind === "heading" ? "12px 0 5px" : "0 0 6px",
              fontFamily: F.serif, fontSize: l.kind === "heading" ? 15 : 13,
              fontWeight: l.kind === "heading" ? 600 : 400,
              fontStyle: l.kind === "subtitle" ? "italic" : "normal",
              color: l.kind === "heading" ? C.gold : C.dim,
            }}>{l.text}</p>
          );
        }
        const colour = colourOf(marks, ref, l.n);
        return (
          <p key={i}
            onClick={() => pen && onMarks(toggleMark(marks, ref, l.n, pen))}
            style={{
              margin: "0 0 5px", padding: colour ? "2px 5px" : "2px 0",
              borderRadius: 5,
              fontFamily: F.serif, fontSize: 15.5, lineHeight: 1.62,
              color: C.text,
              background: colour ? `${C[colour]}${dark ? "33" : "2E"}` : "transparent",
              boxShadow: colour ? `inset 2px 0 0 ${C[colour]}` : "none",
              cursor: pen ? "pointer" : "default",
            }}>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim2, marginRight: 5, verticalAlign: "super" }}>
              {l.n}
            </span>
            {l.text}
          </p>
        );
      })}
    </div>
  );

  /* -------- the reflection -------- */

  const reflectionPanel = (
    <div className="wb-t rounded-2xl p-4" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
      <div className="flex items-baseline justify-between">
        <span style={eyebrow}>REFLECTION · READING DAY {String(readDay).padStart(2, "0")}</span>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: enough ? C.foam : C.dim }}>
          {enough ? "logged in full" : `${short} more`}
        </span>
      </div>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onReflect(readDay, draft)}
        readOnly={locked}
        rows={wide ? 8 : 3}
        placeholder="What it said. What you will do."
        className="wb-t w-full rounded-xl mt-2 px-3 py-2" style={{
          fontFamily: F.serif, fontSize: 16, lineHeight: 1.5, color: locked ? C.text2 : C.text,
          background: locked ? C.panel : C.card, border: `1px solid ${C.line2}`,
          resize: "none", WebkitAppearance: "none",
        }} />
      <div className="flex gap-2 mt-2">
        {locked ? (
          <>
            <div className="flex-1 rounded-xl py-2.5 text-center" style={{
              fontSize: 13.5, fontWeight: 600, color: C.foam, border: `1px solid ${C.foam}66`,
            }}>
              Saved
            </div>
            <button onClick={() => setEditing(true)} className="wb-t rounded-xl px-4"
              style={{ fontSize: 13, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
              Edit
            </button>
          </>
        ) : (
          <button onClick={() => { if (enough) { onRead(readDay, draft); setEditing(false); } }} disabled={!enough}
            className="wb-t flex-1 rounded-xl py-2.5" style={{
              fontSize: 13.5, fontWeight: 600,
              background: enough ? C.gold : "transparent",
              color: enough ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim2,
              border: `1px solid ${enough ? C.gold : C.line2}`,
            }}>
            {isRead ? "Save" : "Mark read"}
          </button>
        )}
        {isRead && (
          <button onClick={() => onUnread(readDay)} className="wb-t rounded-xl px-4"
            style={{ fontSize: 12.5, color: C.oxide, border: `1px solid ${C.line2}` }}>
            Unread
          </button>
        )}
      </div>

      {marked.length > 0 && (
        <>
          <div style={{ ...eyebrow, marginTop: 14, marginBottom: 4 }}>MARKED · {marked.length}</div>
          {/* Its own scroll, capped short, so the field above never has to move
              out from under you just because the marked list grew. */}
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {marked.map((m) => {
              const noted = draft.includes(quote(m));
              return (
                <div key={`${m.ref.book}${m.ref.chapter}:${m.verse}`} className="flex items-start gap-2 py-1">
                  <span className="shrink-0 rounded-full" style={{ width: 7, height: 7, marginTop: 6, background: C[m.colour] }} />
                  <span className="flex-1" style={{ fontFamily: F.serif, fontSize: 12.5, lineHeight: 1.45, color: C.text2 }}>
                    <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.dim2, marginRight: 4 }}>{m.verse}</span>
                    {m.text}
                  </span>
                  <button onClick={() => !noted && append(m)} className="wb-t shrink-0 rounded-md px-2 py-0.5"
                    style={{
                      fontFamily: F.mono, fontSize: 9.5,
                      color: noted ? C.foam : C.text2,
                      border: `1px solid ${noted ? `${C.foam}66` : C.line2}`,
                    }}>
                    {noted ? "✓ ADDED" : "→ NOTE"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  /* -------- carrying it aboard -------- */

  const carryStrip = aboard && (
    <div className="wb-t rounded-2xl p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.line2}` }}>
      <div className="flex items-baseline justify-between">
        <span style={{ ...eyebrow, color: aboard.have >= aboard.total ? C.foam : C.dim2 }}>
          {aboard.have >= aboard.total ? "THE PASSAGE IS ABOARD" : "TEXT ABOARD"}
        </span>
        <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.dim }}>{aboard.have} / {aboard.total}</span>
      </div>

      {loading ? (
        <>
          <div className="rounded-full mt-2" style={{ height: 4, background: C.track }}>
            <div className="rounded-full" style={{
              height: 4, background: C.gold,
              width: `${loading.total ? (loading.done / loading.total) * 100 : 0}%`,
            }} />
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 4, color: C.dim }}>
            carrying {loading.done} of {loading.total}{loading.at ? ` · ${loading.at}` : ""}
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-2 mt-2">
            {aboard.have < aboard.total && (
              <button onClick={onCarry} disabled={online === false} className="wb-t flex-1 rounded-xl py-2.5"
                style={{
                  fontSize: 12.5, fontWeight: 600,
                  background: online === false ? "transparent" : C.gold,
                  color: online === false ? C.dim2 : dark ? "#0E1C22" : "#FFFFFF",
                  border: `1px solid ${online === false ? C.line2 : C.gold}`,
                }}>
                {online === false ? "No link" : "Carry this passage"}
              </button>
            )}
            <button onClick={onCarryAll} disabled={online === false} className="wb-t flex-1 rounded-xl py-2.5"
              style={{ fontSize: 12.5, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
              Carry the whole Bible
            </button>
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, marginTop: 6, color: C.dim }}>
            The whole {TRANSLATION_NAME} is 1,189 chapters, about 13 MB, and it only ever
            downloads what is not already aboard. Do it alongside.
          </div>
          {aboard.failed > 0 && (
            <div style={{ fontSize: 11.5, lineHeight: 1.45, marginTop: 6, color: C.oxide }}>
              {aboard.failed} chapter{aboard.failed === 1 ? "" : "s"} would not come down. Tap again
              while the link is up — nothing already aboard is fetched twice.
            </div>
          )}
        </>
      )}
    </div>
  );

  /* -------- the reader -------- */

  const picker = books.length > 0 && (
    <div className="flex gap-2 mb-3">
      <select value={browse?.book || ""} onChange={(e) => onBrowse(e.target.value ? { book: e.target.value, chapter: 1 } : null)}
        className="wb-t flex-[1.6] rounded-xl px-2" style={{
          fontFamily: F.ui, fontSize: 15, color: C.text, height: 40, minWidth: 0,
          background: C.sub, border: `1px solid ${C.line2}`, colorScheme: dark ? "dark" : "light",
        }}>
        <option value="">Today's reading</option>
        {books.map((b) => <option key={b.id} value={b.id}>{b.commonName || b.name}</option>)}
      </select>
      {browse && (
        <select value={browse.chapter} onChange={(e) => onBrowse({ ...browse, chapter: Number(e.target.value) })}
          className="wb-t flex-1 rounded-xl px-2" style={{
            fontFamily: F.mono, fontSize: 15, color: C.text, height: 40, minWidth: 0,
            background: C.sub, border: `1px solid ${C.line2}`, colorScheme: dark ? "dark" : "light",
          }}>
          {Array.from({ length: books.find((b) => b.id === browse.book)?.numberOfChapters || 1 },
            (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
      )}
    </div>
  );

  // Frozen: what you are reading and what you are marking with stay put while
  // the chapter goes past underneath. The carry strip and the book picker are
  // setup rather than reference, so they scroll away with everything else.
  const frozenHead = (
    <div style={{ position: "sticky", top: 0, zIndex: 3, background: C.card, paddingBottom: 8 }}>
      <div className="wb-t rounded-2xl px-4 py-3" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
        {browse ? (
          <div className="flex items-baseline justify-between gap-3">
            <span style={{ fontFamily: F.serif, fontSize: 19, color: C.text }}>
              {shownRefs[0]?.label}
            </span>
            <span style={eyebrow}>READING</span>
          </div>
        ) : (
          <>
            <div style={eyebrow}>TODAY</div>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span style={{ fontFamily: F.serif, fontSize: 21, lineHeight: 1.25, color: C.gold }}>{plan.psalm}</span>
              <span style={{ fontFamily: F.serif, fontSize: 21, lineHeight: 1.25, color: C.text }}>{plan.nt}</span>
            </div>
          </>
        )}
        <div className="mt-2">{markerRow}</div>
      </div>
    </div>
  );

  const reading = (
    <div>
      {carryStrip}
      {picker}
      {frozenHead}
      {text ? text.map(chapter) : (
        <div style={{ fontSize: 12.5, color: C.dim, padding: "4px 2px" }}>Reading…</div>
      )}
    </div>
  );

  if (wide) {
    return (
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "1.35fr 1fr" }}>
        {reading}
        <div style={{ position: "sticky", top: 0, zIndex: 3 }}>{reflectionPanel}</div>
      </div>
    );
  }

  return (
    <div>
      {reading}
      {/* Under the thumb rather than at the end of the chapter: a thought
          arrives while you are reading, not once you have finished. */}
      <div style={{ position: "sticky", bottom: 0, paddingTop: 6, background: C.card, zIndex: 2 }}>
        {reflectionPanel}
      </div>
    </div>
  );
}
