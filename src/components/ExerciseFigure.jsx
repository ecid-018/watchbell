import React, { useState } from "react";

/* ------------------------------------------------------------------
   ExerciseFigure — animated SVG demonstrations
   Offline. No images, no network. Drop into src/components/.

   <ExerciseFigure move="dead-bug" />
------------------------------------------------------------------ */

const CSS = `
  .xf line, .xf circle, .xf path { stroke-linecap: round; }
  .xf .bar { stroke-width: 3; }
  .xf .ground { stroke-width: 2; opacity:.35; }
  .xf .limb { stroke-width: 6; }
  .xf .torso { stroke-width: 7; }
  .xf .load { stroke-width: 8; }

  @keyframes db-armA { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(72deg)} }
  @keyframes db-armB { 0%,100%{transform:rotate(72deg)} 50%{transform:rotate(0deg)} }
  @keyframes db-legA { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(-68deg)} }
  @keyframes db-legB { 0%,100%{transform:rotate(-68deg)} 50%{transform:rotate(0deg)} }

  @keyframes hh-breathe { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }

  @keyframes gb-kneeA { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(-46deg)} }
  @keyframes gb-kneeB { 0%,100%{transform:rotate(-46deg)} 50%{transform:rotate(0deg)} }

  @keyframes pike-dip { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-11px,16px)} }
  @keyframes pike-arm { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(24deg)} }

  @keyframes bear-a { 0%,100%{transform:translateX(0)} 50%{transform:translateX(13px)} }
  @keyframes bear-b { 0%,100%{transform:translateX(13px)} 50%{transform:translateX(0)} }
  @keyframes bear-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }

  @keyframes row-pull { 0%,100%{transform:translateY(0)} 45%{transform:translateY(-19px)} }
  @keyframes row-elbow { 0%,100%{transform:rotate(0deg)} 45%{transform:rotate(-38deg)} }

  @keyframes bss-down { 0%,100%{transform:translateY(0)} 50%{transform:translateY(19px)} }
  @keyframes bss-shin { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(15deg)} }

  @keyframes hkr-knee { 0%,100%{transform:rotate(0deg)} 45%{transform:rotate(-88deg)} }
  @keyframes hkr-shin { 0%,100%{transform:rotate(0deg)} 45%{transform:rotate(-72deg)} }

  @keyframes wgs-lunge { 0%,100%{transform:translateY(0)} 50%{transform:translateY(11px)} }
  @keyframes wgs-reach { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(-115deg)} }

  @media (prefers-reduced-motion: reduce) {
    .xf * { animation: none !important; }
  }
`;

const A = (name, dur, delay = 0) => ({
  animation: `${name} ${dur}s ease-in-out ${delay}s infinite`,
});

/* ---------------------------------------------------------------- */

const Frame = ({ children, ground = true, c }) => (
  <svg className="xf" viewBox="0 0 200 140" width="100%" style={{ display: "block" }}>
    <g stroke={c.line} fill="none">
      {ground && <line className="ground" x1="12" y1="126" x2="188" y2="126" />}
    </g>
    <g stroke={c.fig} fill="none">{children}</g>
  </svg>
);

const FIGURES = {
  "dead-bug": {
    label: "Dead bug",
    cue: "Lower back stays pressed flat to the deck the whole time. Opposite arm and leg. If the back arches, shorten the range.",
    render: (c) => (
      <Frame c={c}>
        <circle cx="52" cy="112" r="9" strokeWidth="5" />
        <line className="torso" x1="63" y1="114" x2="128" y2="114" />
        {/* arms pivot at shoulder */}
        <g style={{ ...A("db-armA", 3), transformOrigin: "70px 112px" }}>
          <line className="limb" x1="70" y1="112" x2="70" y2="72" />
        </g>
        <g style={{ ...A("db-armB", 3), transformOrigin: "76px 112px" }}>
          <line className="limb" x1="76" y1="112" x2="76" y2="76" opacity=".45" />
        </g>
        {/* legs pivot at hip */}
        <g style={{ ...A("db-legA", 3), transformOrigin: "126px 114px" }}>
          <line className="limb" x1="126" y1="114" x2="126" y2="80" />
          <line className="limb" x1="126" y1="80" x2="156" y2="78" />
        </g>
        <g style={{ ...A("db-legB", 3), transformOrigin: "126px 114px" }} opacity=".45">
          <line className="limb" x1="126" y1="114" x2="126" y2="84" />
          <line className="limb" x1="126" y1="84" x2="154" y2="84" />
        </g>
      </Frame>
    ),
  },

  "hollow-hold": {
    label: "Hollow hold",
    cue: "Only the lower back and hips touch the deck. Shoulders and heels both hover. Ribs pulled down, not flared.",
    render: (c) => (
      <Frame c={c}>
        <g style={{ ...A("hh-breathe", 3.4), transformOrigin: "100px 110px" }}>
          <path className="torso" d="M62 100 Q100 122 142 100" />
          <circle cx="54" cy="96" r="9" strokeWidth="5" />
          <line className="limb" x1="58" y1="90" x2="34" y2="76" />
          <line className="limb" x1="142" y1="100" x2="176" y2="86" />
        </g>
      </Frame>
    ),
  },

  "glute-bridge-march": {
    label: "Glute bridge march",
    cue: "Hips stay locked high the entire set — that's the point. Squeeze the glutes, then lift one knee without letting the hip drop.",
    render: (c) => (
      <Frame c={c}>
        <circle cx="42" cy="116" r="9" strokeWidth="5" />
        <line className="torso" x1="53" y1="114" x2="106" y2="88" />
        <line className="limb" x1="60" y1="112" x2="52" y2="124" />
        <g style={{ ...A("gb-kneeA", 2.6), transformOrigin: "106px 88px" }}>
          <line className="limb" x1="106" y1="88" x2="140" y2="94" />
          <line className="limb" x1="140" y1="94" x2="140" y2="124" />
        </g>
        <g style={{ ...A("gb-kneeB", 2.6), transformOrigin: "106px 88px" }} opacity=".45">
          <line className="limb" x1="106" y1="88" x2="134" y2="98" />
          <line className="limb" x1="134" y1="98" x2="134" y2="124" />
        </g>
      </Frame>
    ),
  },

  "pike-push-up": {
    label: "Pike push-up",
    cue: "Hips high — an upside-down V. The crown of the head goes toward the deck just in front of your hands, not your chest.",
    render: (c) => (
      <Frame c={c}>
        <g style={{ ...A("pike-dip", 2.8), transformOrigin: "100px 60px" }}>
          <circle cx="58" cy="72" r="9" strokeWidth="5" />
          <line className="torso" x1="66" y1="68" x2="104" y2="46" />
        </g>
        <g style={{ ...A("pike-arm", 2.8), transformOrigin: "68px 66px" }}>
          <line className="limb" x1="68" y1="66" x2="56" y2="124" />
        </g>
        <line className="limb" x1="104" y1="46" x2="146" y2="124" />
      </Frame>
    ),
  },

  "bear-crawl": {
    label: "Bear crawl",
    cue: "Knees hover an inch off the deck and stay there. Short steps, opposite hand and foot together. Hips must not sway.",
    render: (c) => (
      <Frame c={c}>
        <g style={{ ...A("bear-bob", 2.2), transformOrigin: "100px 80px" }}>
          <circle cx="52" cy="76" r="9" strokeWidth="5" />
          <line className="torso" x1="62" y1="78" x2="132" y2="78" />
        </g>
        <g style={{ ...A("bear-a", 2.2), transformOrigin: "70px 78px" }}>
          <line className="limb" x1="70" y1="78" x2="66" y2="122" />
        </g>
        <g style={{ ...A("bear-b", 2.2), transformOrigin: "128px 78px" }}>
          <line className="limb" x1="128" y1="78" x2="132" y2="100" />
          <line className="limb" x1="132" y1="100" x2="150" y2="120" />
        </g>
        <g style={{ ...A("bear-b", 2.2), transformOrigin: "78px 78px" }} opacity=".4">
          <line className="limb" x1="78" y1="78" x2="82" y2="120" />
        </g>
      </Frame>
    ),
  },

  "renegade-row": {
    label: "Renegade row",
    cue: "Feet wide for balance. Row the weight to your ribs while refusing to let your hips rotate — the anti-twist is the exercise.",
    render: (c) => (
      <Frame c={c}>
        <circle cx="48" cy="86" r="9" strokeWidth="5" />
        <line className="torso" x1="58" y1="90" x2="140" y2="104" />
        <line className="limb" x1="66" y1="91" x2="62" y2="122" />
        <line className="limb" x1="140" y1="104" x2="168" y2="124" />
        <line className="limb" x1="140" y1="104" x2="158" y2="124" opacity=".4" />
        <g style={{ ...A("row-elbow", 2.6), transformOrigin: "76px 92px" }}>
          <line className="limb" x1="76" y1="92" x2="88" y2="120" />
        </g>
        <g style={{ ...A("row-pull", 2.6), transformOrigin: "88px 120px" }}>
          <line className="load" x1="80" y1="120" x2="96" y2="120" stroke={c.accent} />
        </g>
      </Frame>
    ),
  },

  "bulgarian-split-squat": {
    label: "Bulgarian split squat",
    cue: "Rear foot on the bunk, most of the weight on the front leg. Lower slowly. Front shin stays near vertical.",
    render: (c) => (
      <Frame c={c}>
        <line className="ground" x1="132" y1="96" x2="184" y2="96" stroke={c.line} />
        <line className="ground" x1="140" y1="96" x2="140" y2="126" stroke={c.line} />
        <g style={{ ...A("bss-down", 3), transformOrigin: "92px 60px" }}>
          <circle cx="88" cy="46" r="9" strokeWidth="5" />
          <line className="torso" x1="90" y1="56" x2="96" y2="88" />
          <line className="limb" x1="90" y1="62" x2="80" y2="88" />
        </g>
        <g style={{ ...A("bss-shin", 3), transformOrigin: "96px 88px" }}>
          <line className="limb" x1="96" y1="88" x2="72" y2="106" />
          <line className="limb" x1="72" y1="106" x2="76" y2="126" />
        </g>
        <line className="limb" x1="96" y1="88" x2="126" y2="94" />
        <line className="limb" x1="126" y1="94" x2="140" y2="92" />
      </Frame>
    ),
  },

  "hanging-knee-raise": {
    label: "Hanging knee raise",
    cue: "No swing. Curl the pelvis up rather than just lifting the thighs, and lower under control — the lowering is where it works.",
    render: (c) => (
      <Frame c={c} ground={false}>
        <line className="bar" x1="46" y1="22" x2="154" y2="22" stroke={c.line} />
        <line className="limb" x1="96" y1="24" x2="98" y2="48" />
        <circle cx="98" cy="58" r="9" strokeWidth="5" />
        <line className="torso" x1="98" y1="68" x2="98" y2="96" />
        <g style={{ ...A("hkr-knee", 2.8), transformOrigin: "98px 96px" }}>
          <line className="limb" x1="98" y1="96" x2="98" y2="120" />
          <g style={{ ...A("hkr-shin", 2.8), transformOrigin: "98px 120px" }}>
            <line className="limb" x1="98" y1="120" x2="98" y2="138" />
          </g>
        </g>
      </Frame>
    ),
  },

  "worlds-greatest-stretch": {
    label: "World's greatest stretch",
    cue: "Deep lunge, plant the opposite hand inside the front foot, then rotate and reach the free arm straight up. Follow the hand with your eyes.",
    render: (c) => (
      <Frame c={c}>
        <g style={{ ...A("wgs-lunge", 3.6), transformOrigin: "100px 70px" }}>
          <circle cx="86" cy="62" r="9" strokeWidth="5" />
          <line className="torso" x1="90" y1="71" x2="104" y2="96" />
          <line className="limb" x1="92" y1="76" x2="84" y2="122" />
          <g style={{ ...A("wgs-reach", 3.6), transformOrigin: "94px 78px" }}>
            <line className="limb" x1="94" y1="78" x2="112" y2="118" stroke={c.accent} />
          </g>
          <line className="limb" x1="104" y1="96" x2="76" y2="112" />
          <line className="limb" x1="76" y1="112" x2="74" y2="126" />
          <line className="limb" x1="104" y1="96" x2="146" y2="122" />
        </g>
      </Frame>
    ),
  },
};

/* ---------------------------------------------------------------- */

export function ExerciseFigure({ move, colors }) {
  const f = FIGURES[move];
  const c = colors || { fig: "#E9F0EF", line: "#48646E", accent: "#E9B255" };
  if (!f) return null;
  return (
    <>
      <style>{CSS}</style>
      {f.render(c)}
    </>
  );
}

export const EXERCISE_KEYS = Object.keys(FIGURES);
export const exerciseCue = (k) => FIGURES[k]?.cue;
export const exerciseLabel = (k) => FIGURES[k]?.label;

/* ---- demo gallery, so you can flip through them ---- */

export default function Gallery() {
  const [i, setI] = useState(0);
  const keys = EXERCISE_KEYS;
  const k = keys[i];
  const C = { bg: "#08151A", card: "#0E1C22", panel: "#0B1A20", line: "#24404A", dim: "#48646E", text: "#E9F0EF", text2: "#9DB2B8", amber: "#E9B255" };
  const F = { ui: '-apple-system, "SF Pro Text", BlinkMacSystemFont, sans-serif', mono: 'ui-monospace, "SF Mono", Menlo, monospace' };

  return (
    <div className="min-h-screen w-full flex justify-center py-6 px-3" style={{ background: C.bg, fontFamily: F.ui }}>
      <div className="w-full max-w-sm rounded-[22px] overflow-hidden" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        <div className="px-5 pt-5 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: ".14em", color: C.dim }}>WATCHBELL · FORM</div>
          <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: "-.02em", color: C.text, marginTop: 4 }}>
            {exerciseLabel(k)}
          </div>
        </div>

        <div className="px-4 py-5" style={{ background: C.panel }}>
          <ExerciseFigure move={k} colors={{ fig: C.text, line: C.dim, accent: C.amber }} />
        </div>

        <div className="px-5 py-4">
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim }}>THE CUE</div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: C.text2, marginTop: 6 }}>{exerciseCue(k)}</div>
        </div>

        <div className="px-4 pb-5 flex flex-wrap gap-1.5">
          {keys.map((key, n) => (
            <button key={key} onClick={() => setI(n)} className="px-2.5 py-1.5 rounded-full"
              style={{
                fontSize: 11, fontWeight: 500,
                background: n === i ? C.amber : "transparent",
                color: n === i ? "#0E1C22" : C.dim,
                border: `1px solid ${n === i ? C.amber : C.line}`,
              }}>
              {exerciseLabel(key)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
