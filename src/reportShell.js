/* ------------------------------------------------------------------
   A report is its own standalone HTML document, not a view inside the
   app — it has to survive being shared, opened in a new tab, or handed to
   iOS Safari's Print → Save as PDF, none of which carry the app's own
   stylesheet or its dark theme along with it. So it gets a fixed,
   print-safe light palette of its own, hardcoded here rather than
   borrowed from theme.js.
------------------------------------------------------------------ */

export const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderReportHtml({ title, vessel, generated, signee, bodyHtml }) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px; background: #FFFFFF; color: #10262E;
    font-family: -apple-system, "SF Pro Text", Helvetica, Arial, sans-serif;
    font-size: 13px; line-height: 1.5;
  }
  h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: -.01em; }
  .meta { font-size: 11px; color: #3E5B66; margin-bottom: 18px; }
  .meta div { margin-top: 1px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #E4EAEC; vertical-align: top; }
  th { font-size: 10px; letter-spacing: .06em; color: #6C848D; text-transform: uppercase; font-weight: 600; }
  .group-title { font-size: 12px; font-weight: 700; margin: 14px 0 4px; }
  .tag { display: inline-block; font-size: 9.5px; font-weight: 600; letter-spacing: .04em;
         padding: 1px 6px; border-radius: 10px; text-transform: uppercase; }
  .tag-open { background: #F3E3D8; color: #96650F; }
  .tag-done { background: #DCEFE9; color: #1C7A64; }
  .tag-dropped { background: #F3DCD6; color: #A2422A; }
  .photos { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 2px; }
  .photos figure { margin: 0; width: 140px; }
  .photos img { width: 140px; height: 105px; object-fit: cover; border: 1px solid #DCE5E8; border-radius: 4px; }
  .photos figcaption { font-size: 9.5px; color: #6C848D; text-align: center; margin-top: 2px; text-transform: uppercase; }
  .figure-line { font-size: 26px; font-weight: 700; letter-spacing: -.02em; }
  .note { font-size: 11.5px; color: #3E5B66; margin-top: 2px; }
  @media print {
    body { padding: 0; }
    .group { page-break-inside: avoid; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <div>${escapeHtml(vessel)}</div>
    <div>Generated ${escapeHtml(generated)}</div>
    <div>${escapeHtml(signee)}</div>
  </div>
  ${bodyHtml}
</body>
</html>`;
}
