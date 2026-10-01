"use client";

import { useId, type ReactElement } from "react";

/**
 * Illustrationen für das Onboarding – reine Inline-SVGs, keine Fremd-Assets.
 *
 * Warum so:
 * - Farbe kommt ausschließlich aus den Design-Tokens (Klassen `.i-*` in
 *   `globals.css`). Dadurch genügt **eine** Zeichnung für hell und dunkel.
 * - Vektor statt Raster: scharf auf jedem Display, wenige Kilobyte, und das
 *   Onboarding wird erst bei Bedarf geladen (0 KB im Startbundle).
 * - Jede Zeichnung ist **ohne** Bewegung vollständig: die Bewegung liegt nur in
 *   Keyframes (fill-mode `both`), nie als Ausgangszustand im Markup.
 * - In SVG wird **nur** verschoben und geblendet (`translate`/`opacity`) sowie
 *   `stroke-dashoffset` gezeichnet. `scale`/`rotate` in Keyframes würden am
 *   `transform-origin` der viewBox hängen und die Figuren verschieben.
 *
 * Bildsprache: Papierkarten mit großem Radius, weiche Linien, ein Lichtkegel
 * hinter der Szene, ein Bodenschatten darunter, Terrakotta nur für das aktive
 * Element. Die fünf Schritte erzählen eine Reise: Rezepte sammeln → Link wird
 * Rezept → planen und einkaufen → weitergeben → loskochen.
 */
type Step = 1 | 2 | 3 | 4 | 5;
type IllProps = { uid: string };

/** Staffelung: gleichmäßige Verzögerung für nacheinander erscheinende Teile. */
const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

/** Lichtkegel hinter der Szene – gibt der flachen Zeichnung Tiefe. */
function Spot({
  uid,
  cx = 120,
  cy = 72,
  rx = 106,
  ry = 58,
  warm = false,
}: {
  uid: string;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  warm?: boolean;
}) {
  const id = `glow-${warm ? "w" : "a"}-${uid}`;
  return (
    <>
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" className={warm ? "i-glow-warm-a" : "i-glow-a"} />
          <stop offset="100%" className={warm ? "i-glow-warm-b" : "i-glow-b"} />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id})`} />
    </>
  );
}

/** Bodenschatten: verankert die Objekte auf der Fläche. */
function Ground({
  cx = 120,
  cy = 148,
  rx = 54,
  ry = 6,
}: {
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
}) {
  return <ellipse className="i-shadow" cx={cx} cy={cy} rx={rx} ry={ry} />;
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

/**
 * Der Topf aus dem echten Ladezustand – mit Deckel, Knauf, Glanzkante, Herd
 * und Flammen. Als Bildzitat, damit man ihn beim ersten Import wiedererkennt.
 */
function Pot({ x = 0, y = 0, fire = true }: { x?: number; y?: number; fire?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {fire && (
        <>
          <rect className="i-card-2" x={6} y={144} width={120} height={9} rx={4.5} />
          <path className="i-accent pulse-soft" d="M14 144 c-3,-5 2,-9 0,-13 c4,3 8,7 5,13 z" />
          <path
            className="i-accent pulse-soft"
            style={delay(600)}
            d="M112 144 c-3,-5 2,-9 0,-13 c4,3 8,7 5,13 z"
          />
        </>
      )}
      <path
        className="i-card"
        d="M24 98 H108 V118 A28 28 0 0 1 80 146 H52 A28 28 0 0 1 24 118 Z"
      />
      {/* Glanzkante links – das Licht kommt von oben links */}
      <path className="i-highlight" d="M31 104 V120 A21 21 0 0 0 42 139 H36 A24 24 0 0 1 31 120 Z" />
      <rect className="i-card" x={46} y={80} width={40} height={14} rx={7} />
      <circle className="i-ink" cx={66} cy={78} r={3.4} />
      <path className="i-stroke-strong" d="M18 98 H114" />
      <path className="i-stroke-strong" d="M18 112 H8" />
      <path className="i-stroke-strong" d="M114 112 H124" />
    </g>
  );
}

/** Karte mit Schreiblinien, optional mit Lesezeichen und Herz. */
function RecipeCard({
  x,
  y,
  rotate = 0,
  width = 104,
  height = 72,
  className = "i-card",
  animate,
  tab,
  heart = false,
}: {
  x: number;
  y: number;
  rotate?: number;
  width?: number;
  height?: number;
  className?: string;
  animate?: string;
  tab?: string;
  heart?: boolean;
}) {
  const inner = (
    <g>
      <rect className={className} width={width} height={height} rx={14} />
      {tab && <rect className={tab} x={width - 30} y={-5} width={14} height={16} rx={4} />}
      {heart && (
        <path
          className="i-accent"
          d="M76 16 C76 10 84 8 88 13 C92 8 100 10 100 16 C100 24 88 31 88 31 C88 31 76 24 76 16 Z"
        />
      )}
      <rect className="i-line" x={16} y={Math.round(height * 0.32)} width={width * 0.5} height={6} rx={3} />
      <rect className="i-line" x={16} y={Math.round(height * 0.32) + 14} width={width * 0.72} height={6} rx={3} />
      <rect className="i-line" x={16} y={Math.round(height * 0.32) + 28} width={width * 0.38} height={6} rx={3} />
      {heart && <rect className="i-pill" x={16} y={height - 18} width={30} height={9} rx={4.5} />}
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate} ${width / 2} ${height / 2})`}>
      {animate ? <g className={animate}>{inner}</g> : inner}
    </g>
  );
}

/** Schritt 1 – Rezepte sammeln: aus Reel und TikTok wird ein Stapel Karten. */
function StepOne({ uid }: IllProps) {
  return (
    <>
      <Spot uid={uid} cx={146} cy={68} rx={100} ry={56} />
      <Ground cx={156} cy={124} rx={72} ry={7} />

      {/* Quellen */}
      <g className="i-anim-rise" style={delay(120)}>
        <circle className="i-shadow" cx={33} cy={45} r={18} />
        <circle className="i-card-2" cx={30} cy={42} r={18} />
        <path className="i-ink" d="M25 33 L39 42 L25 51 Z" />
      </g>
      <g className="i-anim-rise" style={delay(200)}>
        <circle className="i-shadow" cx={35} cy={119} r={18} />
        <circle className="i-card-2" cx={32} cy={116} r={18} />
        <path className="i-stroke-strong" d="M35 124 V104 M35 104 L42 101" />
        <ellipse className="i-ink" cx={31} cy={124} rx={5.5} ry={4} />
      </g>

      {/* Wege in den Stapel */}
      <path className="i-dotted" d="M50 46 C72 52 86 58 98 64" />
      <path className="i-ink" d="M96 60 L105 64 L96 68 Z" />
      <path className="i-dotted" d="M52 110 C74 102 86 94 98 86" />
      <path className="i-ink" d="M96 82 L105 86 L96 90 Z" />

      {/* Stapel */}
      <RecipeCard x={92} y={24} rotate={-17} width={90} height={62} className="i-card-2" animate="i-anim-fan" />
      <RecipeCard x={100} y={28} rotate={-11} width={96} height={66} className="i-card-2" animate="i-anim-fan" tab="i-tab-soft" />
      <RecipeCard x={108} y={34} rotate={-5} width={100} height={70} animate="i-anim-fan" tab="i-tab" />
      <g className="i-anim-fan" style={delay(140)}>
        <g transform="translate(120 44) rotate(3 52 36)">
          <rect className="i-card-accent" width={104} height={72} rx={14} />
          <path
            className="i-accent"
            d="M80 18 C80 12 88 10 92 15 C96 10 104 12 104 18 C104 26 92 33 92 33 C92 33 80 26 80 18 Z"
          />
          <rect className="i-line" x={16} y={22} width={52} height={6} rx={3} />
          <rect className="i-line" x={16} y={36} width={70} height={6} rx={3} />
          <rect className="i-line" x={16} y={50} width={36} height={6} rx={3} />
          <rect className="i-pill" x={62} y={48} width={30} height={10} rx={5} />
        </g>
      </g>
    </>
  );
}

/** Schritt 2 – Link wird Rezept: die Kapsel fällt in den Topf, Zutaten wachsen. */
function StepTwo({ uid }: IllProps) {
  return (
    <>
      <Spot uid={uid} cx={74} cy={104} rx={92} ry={54} warm />
      <Ground cx={72} cy={155} rx={62} ry={5} />

      {/* Fallweg des Links */}
      <path className="i-dotted" d="M76 2 V24" />
      <path className="i-ink" d="M70 24 L76 32 L82 24 Z" />

      <g className="i-anim-drop">
        <rect className="i-shadow" x={47} y={13} width={64} height={26} rx={13} />
        <rect className="i-card" x={44} y={10} width={64} height={26} rx={13} />
        <path className="i-stroke-strong" d="M60 23 h4 a5 5 0 0 1 0 10 h-4" />
        <path className="i-stroke-strong" d="M92 23 h-4 a5 5 0 0 0 0 10 h4" />
        <path className="i-stroke-strong" d="M68 23 h12" />
      </g>

      <Steam x={44} y={56} />
      <Pot />

      {/* Erkannte Zutaten */}
      <g className="i-anim-rise" style={delay(220)}>
        <rect className="i-shadow" x={135} y={87} width={98} height={64} rx={14} />
        <rect className="i-card" x={132} y={84} width={98} height={64} rx={14} />
        <rect className="i-pill" x={142} y={92} width={30} height={9} rx={4.5} />
        <rect className="i-line" x={178} y={92} width={42} height={9} rx={4.5} />
      </g>
      {[0, 1].map((i) => (
        <g key={i} className="i-anim-rise" style={delay(300 + i * 90)}>
          <rect className="i-pill" x={142} y={110 + i * 18} width={22} height={9} rx={4.5} />
          <rect className="i-line" x={172} y={110 + i * 18} width={48} height={9} rx={4.5} />
        </g>
      ))}
      <g className="i-anim-rise" style={delay(480)}>
        <rect className="i-accent-soft" x={142} y={128} width={22} height={9} rx={4.5} />
        <rect className="i-line" x={172} y={128} width={34} height={9} rx={4.5} />
        <path className="i-check check-draw" style={delay(700)} d="M144 133 l3 3 l6 -7" />
      </g>
    </>
  );
}

/** Schritt 3 – planen, einkaufen, kochen: Woche, Häkchen, Timer. */
function StepThree({ uid }: IllProps) {
  return (
    <>
      <Spot uid={uid} cx={110} cy={88} rx={104} ry={56} />
      <Ground cx={108} cy={152} rx={72} ry={6} />

      {/* Woche: sieben Tage, zwei gefüllt, einer umringt */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <g key={i} className="i-anim-rise" style={delay(i * 45)}>
          <rect
            className={i === 1 || i === 4 ? "i-accent" : "i-card-2"}
            x={22 + i * 28}
            y={22}
            width={20}
            height={20}
            rx={6}
          />
          <circle className="i-line" cx={32 + i * 28} cy={49} r={2.4} />
        </g>
      ))}
      <rect className="i-stroke-strong" x={20} y={20} width={24} height={24} rx={8} />

      {/* Einkaufsliste */}
      <rect className="i-shadow" x={25} y={65} width={130} height={76} rx={14} />
      <rect className="i-card" x={22} y={62} width={130} height={76} rx={14} />
      {/* Korbhenkel */}
      <path className="i-stroke-strong" d="M74 62 C74 52 94 52 94 62" />
      <rect className="i-line" x={36} y={70} width={44} height={7} rx={3.5} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            className={i < 2 ? "i-accent-soft i-stroke" : "i-card-2"}
            x={36}
            y={86 + i * 17}
            width={16}
            height={16}
            rx={5}
          />
          <rect className="i-line" x={60} y={90 + i * 17} width={74 - i * 16} height={8} rx={4} />
          {i < 2 && (
            <path
              className="i-check check-draw"
              style={delay(320 + i * 120)}
              d={`M39 ${94 + i * 17} l4 4 l7 -9`}
            />
          )}
        </g>
      ))}

      {/* Timer mit Fortschritt */}
      <circle className="i-shadow" cx={199} cy={103} r={23} />
      <circle className="i-card" cx={196} cy={100} r={24} />
      <circle className="i-stroke" cx={196} cy={100} r={17} />
      <circle className="i-ring i-anim-ring" cx={196} cy={100} r={22} />
      <circle className="i-ink" cx={196} cy={78} r={2.6} />
    </>
  );
}

/** Schritt 4 – weitergeben: die Karte wandert, der Code füllt sich. */
function StepFour({ uid }: IllProps) {
  return (
    <>
      <Spot uid={uid} cx={120} cy={70} rx={108} ry={54} />
      <Ground cx={120} cy={156} rx={62} ry={5} />

      {/* Zwei Geräte */}
      <rect className="i-shadow" x={27} y={37} width={48} height={78} rx={13} />
      <rect className="i-card" x={24} y={34} width={48} height={78} rx={13} />
      <rect className="i-line" x={42} y={41} width={12} height={3} rx={1.5} />
      <rect className="i-accent-soft" x={32} y={50} width={32} height={42} rx={8} />

      <rect className="i-shadow" x={173} y={37} width={48} height={78} rx={13} />
      <rect className="i-card" x={170} y={34} width={48} height={78} rx={13} />
      <rect className="i-line" x={188} y={41} width={12} height={3} rx={1.5} />
      <rect className="i-accent-soft" x={178} y={50} width={32} height={42} rx={8} />

      {/* Weg mit Pfeilspitzen an beiden Enden */}
      <path className="i-dotted" d="M78 74 C102 52 138 52 162 74" />
      <path className="i-ink" d="M78 74 l9 -2 l-3 7 z" />
      <path className="i-ink" d="M162 74 l-9 -2 l3 7 z" />

      {/* Reisende Karte */}
      <g className="i-anim-travel">
        <g transform="translate(102 56) rotate(-3 18 22)">
          <rect className="i-shadow" x={2} y={3} width={36} height={44} rx={9} />
          <rect className="i-card" width={36} height={44} rx={9} />
          <path className="i-stroke-strong" d="M13 18 h3 a4 4 0 0 1 0 8 h-3" />
          <path className="i-stroke-strong" d="M23 18 h-3 a4 4 0 0 0 0 8 h3" />
          <rect className="i-line" x={8} y={32} width={20} height={5} rx={2.5} />
        </g>
      </g>

      {/* Code mit Eckmarken */}
      <g transform="translate(94 116)">
        <rect className="i-shadow" x={2} y={3} width={52} height={38} rx={10} />
        <rect className="i-card" width={52} height={38} rx={10} />
        <rect className="i-tab" x={6} y={6} width={10} height={10} rx={2.5} />
        <rect className="i-stroke-strong" x={19} y={6} width={10} height={10} rx={2.5} />
        <rect className="i-stroke-strong" x={6} y={19} width={10} height={10} rx={2.5} />
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <circle
              key={`${row}-${col}`}
              className={(row + col) % 3 === 0 ? "i-accent i-anim-rise" : "i-dot i-anim-rise"}
              style={delay((row * 4 + col) * 35)}
              cx={31 + col * 5}
              cy={11 + row * 5}
              r={1.7}
            />
          )),
        )}
      </g>
    </>
  );
}

/** Schritt 5 – bereit: der Topf dampft, die Beispielrezepte liegen daneben. */
function StepFive({ uid }: IllProps) {
  return (
    <>
      <Spot uid={uid} cx={88} cy={98} rx={94} ry={54} warm />
      <Ground cx={88} cy={155} rx={64} ry={5} />

      <Steam x={40} y={50} />
      <Pot y={-6} />

      {/* Kochlöffel lehnt am Topf */}
      <g transform="translate(132 92) rotate(16)">
        <rect className="i-shadow" x={3} y={4} width={7} height={46} rx={3.5} />
        <rect className="i-card" x={0} y={0} width={7} height={46} rx={3.5} />
        <ellipse className="i-card" cx={3.5} cy={50} rx={8} ry={10} />
      </g>

      <path
        className="i-accent pulse-soft"
        d="M148 20 C149 29 152 32 162 33 C152 34 149 37 148 46 C147 37 144 34 134 33 C144 32 147 29 148 20 Z"
      />

      {/* Beispiel-Rezepte */}
      <RecipeCard x={100} y={70} rotate={-13} width={88} height={60} className="i-card-2" animate="i-anim-fan" />
      <RecipeCard x={110} y={76} rotate={-5} width={92} height={62} animate="i-anim-fan" heart />
      <RecipeCard x={120} y={82} rotate={2} width={94} height={64} className="i-card-accent" animate="i-anim-fan" heart />
    </>
  );
}

const ILLUSTRATIONS: Record<Step, (props: IllProps) => ReactElement> = {
  1: StepOne,
  2: StepTwo,
  3: StepThree,
  4: StepFour,
  5: StepFive,
};

export function OnboardingIllustration({ step }: { step: Step }) {
  const Drawing = ILLUSTRATIONS[step];
  // Eindeutige Kennung für die Farbverläufe. Doppelpunkte müssen raus, sonst
  // wird die Referenz `url(#…)` unzuverlässig.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

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
      <Drawing uid={uid} />
    </svg>
  );
}
