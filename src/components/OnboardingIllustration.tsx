"use client";

import type { ReactElement } from "react";

/**
 * Illustrationen für das Onboarding – reine Inline-SVGs, keine Fremd-Assets.
 *
 * Warum so:
 * - Farbe kommt ausschließlich aus den Design-Tokens (Klassen `.i-*` in
 *   `globals.css`). Dadurch genügt **eine** Zeichnung für hell und dunkel
 *   statt zweier Bildsätze.
 * - Vektor statt Raster: scharf auf jedem Display, wenige Kilobyte, und die
 *   Bewegung kann an einzelnen Gruppen hängen.
 * - Jede Zeichnung ist **ohne** Bewegung vollständig: die Bewegung liegt nur in
 *   Keyframes (fill-mode `both`), nie als Ausgangszustand im Markup – sonst
 *   bliebe bei `prefers-reduced-motion` etwas unsichtbar.
 * - In SVG wird **nur** verschoben und geblendet (`translate`/`opacity`) sowie
 *   `stroke-dashoffset` gezeichnet. `scale`/`rotate` in Keyframes würden am
 *   `transform-origin` der viewBox hängen und die Figuren verschieben.
 *
 * Bildgrammatik: Papierkarten mit großem Radius, 2-px-Linien, Terrakotta nur
 * für das aktive Element, Tiefe über `surface`/`surface-3`. Die fünf Schritte
 * erzählen eine Reise: Rezepte sammeln → Link wird Rezept → planen und
 * einkaufen → weitergeben → loskochen.
 */
type Step = 1 | 2 | 3 | 4 | 5;

/** Staffelung: gleichmäßige Verzögerung für nacheinander erscheinende Teile. */
const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

/** Der Topf aus dem echten Ladezustand – als Bildzitat, damit man ihn beim
 *  ersten Import wiedererkennt. */
function Pot({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        className="i-card"
        d="M24 98 H108 V118 A28 28 0 0 1 80 146 H52 A28 28 0 0 1 24 118 Z"
      />
      {/* Deckel mit Knauf: erst dadurch liest sich die Form als Topf */}
      <rect className="i-card" x={46} y={80} width={40} height={14} rx={7} />
      <circle className="i-ink" cx={66} cy={78} r={3.4} />
      <path className="i-stroke-strong" d="M18 98 H114" />
      <path className="i-stroke-strong" d="M18 112 H8" />
      <path className="i-stroke-strong" d="M114 112 H124" />
    </g>
  );
}

/** Dampf über dem Topf – dieselbe Bewegung wie im Ladezustand. */
function Steam({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 22, 44].map((offset, i) => (
        <path
          key={offset}
          className="i-steam"
          style={delay(i * 300)}
          d={`M${offset + 6} 18 C${offset + 2} 12 ${offset + 10} 10 ${offset + 6} 4`}
        />
      ))}
    </g>
  );
}

/** Karte mit Schreiblinien – das Grundmotiv für „Rezept". */
function RecipeCard({
  x,
  y,
  rotate = 0,
  width = 104,
  height = 72,
  className = "i-card",
  animate,
}: {
  x: number;
  y: number;
  rotate?: number;
  width?: number;
  height?: number;
  className?: string;
  animate?: string;
}) {
  const inner = (
    <g>
      <rect className={className} width={width} height={height} rx={14} />
      <rect className="i-line" x={16} y={Math.round(height * 0.3)} width={width * 0.55} height={6} rx={3} />
      <rect className="i-line" x={16} y={Math.round(height * 0.3) + 14} width={width * 0.75} height={6} rx={3} />
      <rect className="i-line" x={16} y={Math.round(height * 0.3) + 28} width={width * 0.4} height={6} rx={3} />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate} ${width / 2} ${height / 2})`}>
      {animate ? <g className={animate}>{inner}</g> : inner}
    </g>
  );
}

/** Schritt 1 – Rezepte sammeln: aus Reel und TikTok wird ein Stapel Karten. */
function StepOne() {
  return (
    <>
      <g className="i-anim-rise" style={delay(120)}>
        <circle className="i-card-2" cx={30} cy={40} r={18} />
        <path className="i-ink" d="M26 31 L39 40 L26 49 Z" />
      </g>
      <g className="i-anim-rise" style={delay(200)}>
        <circle className="i-card-2" cx={32} cy={116} r={18} />
        <path className="i-stroke-strong" d="M35 124 V104 M35 104 L42 101" />
        <ellipse className="i-ink" cx={31} cy={124} rx={5.5} ry={4} />
      </g>
      <path className="i-dotted" d="M50 46 C74 52 88 58 102 64" />
      <path className="i-dotted" d="M50 112 C74 104 88 94 102 84" />

      <RecipeCard x={100} y={32} rotate={-12} width={100} height={70} className="i-card-2" animate="i-anim-fan" />
      <RecipeCard x={110} y={38} rotate={-5} width={104} height={72} animate="i-anim-fan" />
      <g className="i-anim-fan" style={delay(140)}>
        <g transform="translate(120 44) rotate(3 52 36)">
          <rect className="i-card-accent" width={104} height={72} rx={14} />
          <rect className="i-line" x={16} y={22} width={54} height={6} rx={3} />
          <rect className="i-line" x={16} y={36} width={72} height={6} rx={3} />
          <rect className="i-line" x={16} y={50} width={38} height={6} rx={3} />
          <path
            className="i-accent"
            d="M82 20 C82 15 89 13 92 17 C95 13 102 15 102 20 C102 27 92 33 92 33 C92 33 82 27 82 20 Z"
          />
        </g>
      </g>
    </>
  );
}

/** Schritt 2 – Link wird Rezept: die Kapsel fällt in den Topf, Zutaten wachsen. */
function StepTwo() {
  return (
    <>
      <g className="i-anim-drop">
        <rect className="i-card" x={44} y={10} width={64} height={26} rx={13} />
        <path className="i-stroke-strong" d="M62 23 h4 a5 5 0 0 1 0 10 h-4" />
        <path className="i-stroke-strong" d="M86 23 h-4 a5 5 0 0 0 0 10 h4" />
        <path className="i-stroke-strong" d="M70 23 h10" />
      </g>

      <Steam x={44} y={56} />
      <Pot />

      <rect className="i-card" x={132} y={84} width={98} height={64} rx={14} />
      {[0, 1, 2].map((i) => (
        <g key={i} className="i-anim-rise" style={delay(240 + i * 90)}>
          <rect className="i-pill" x={144} y={96 + i * 18} width={22} height={8} rx={4} />
          <rect className="i-line" x={172} y={96 + i * 18} width={46} height={8} rx={4} />
        </g>
      ))}
    </>
  );
}

/** Schritt 3 – planen, einkaufen, kochen: Woche, Häkchen, Timer. */
function StepThree() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect
          key={i}
          className={i === 1 || i === 4 ? "i-accent i-anim-rise" : "i-card-2 i-anim-rise"}
          style={delay(i * 45)}
          x={22 + i * 28}
          y={22}
          width={20}
          height={20}
          rx={6}
        />
      ))}

      <rect className="i-card" x={22} y={62} width={130} height={76} rx={14} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            className={i < 2 ? "i-accent-soft i-stroke" : "i-card-2"}
            x={36}
            y={76 + i * 22}
            width={16}
            height={16}
            rx={5}
          />
          <rect className="i-line" x={60} y={80 + i * 22} width={74 - i * 16} height={8} rx={4} />
          {i < 2 && (
            <path
              className="i-check check-draw"
              style={delay(320 + i * 120)}
              d={`M39 ${84 + i * 22} l4 4 l7 -9`}
            />
          )}
        </g>
      ))}

      <circle className="i-stroke" cx={196} cy={100} r={22} opacity={0.35} />
      <circle className="i-ring i-anim-ring" cx={196} cy={100} r={22} />
    </>
  );
}

/** Schritt 4 – weitergeben: die Karte wandert, der Code füllt sich. */
function StepFour() {
  return (
    <>
      <rect className="i-card" x={24} y={34} width={46} height={76} rx={12} />
      <rect className="i-accent-soft" x={32} y={46} width={30} height={40} rx={8} />
      <rect className="i-card" x={170} y={34} width={46} height={76} rx={12} />
      <rect className="i-accent-soft" x={178} y={46} width={30} height={40} rx={8} />

      <path className="i-dotted" d="M76 76 C104 52 136 52 164 76" />

      <g className="i-anim-travel">
        <g transform="translate(102 58) rotate(-3 18 22)">
          <rect className="i-card-2" width={36} height={44} rx={9} />
          <rect className="i-line" x={8} y={12} width={20} height={5} rx={2.5} />
          <rect className="i-line" x={8} y={22} width={14} height={5} rx={2.5} />
        </g>
      </g>

      <g transform="translate(96 118)">
        <rect className="i-card" width={48} height={34} rx={10} />
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <circle
              key={`${row}-${col}`}
              className={(row + col) % 3 === 0 ? "i-accent i-anim-rise" : "i-dot i-anim-rise"}
              style={delay((row * 4 + col) * 35)}
              cx={9 + col * 10}
              cy={8 + row * 7}
              r={2.6}
            />
          )),
        )}
      </g>
    </>
  );
}

/** Schritt 5 – bereit: der Topf dampft, die Beispielrezepte liegen daneben. */
function StepFive() {
  return (
    <>
      <Steam x={40} y={52} />
      <Pot y={-4} />
      <path
        className="i-accent pulse-soft"
        d="M150 24 C151 33 154 36 164 37 C154 38 151 41 150 50 C149 41 146 38 136 37 C146 36 149 33 150 24 Z"
      />

      <RecipeCard x={104} y={62} rotate={-11} width={92} height={64} className="i-card-2" animate="i-anim-fan" />
      <RecipeCard x={116} y={68} rotate={-2} width={96} height={66} className="i-card-accent" animate="i-anim-fan" />
    </>
  );
}

const ILLUSTRATIONS: Record<Step, () => ReactElement> = {
  1: StepOne,
  2: StepTwo,
  3: StepThree,
  4: StepFour,
  5: StepFive,
};

export function OnboardingIllustration({ step }: { step: Step }) {
  const Drawing = ILLUSTRATIONS[step];
  return (
    <svg
      viewBox="0 0 240 160"
      className="i-svg h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {/* Papierfläche als Bühne – dieselbe Wäsche wie auf dem Cover */}
      <rect className="i-wash" x={0} y={0} width={240} height={160} rx={22} />
      <Drawing />
    </svg>
  );
}
