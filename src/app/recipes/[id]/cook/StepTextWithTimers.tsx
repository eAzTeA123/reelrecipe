import { ReactNode } from "react";
import { IconClock } from "@/components/Icons";

const TIME_REGEX = /\b(?:ca\.\s*)?(\d+(?:[,.]\d+)?)(?:\s*(?:-|bis)\s*(\d+(?:[,.]\d+)?))?\s*(minuten?|min\.?|stunden?|std\.?|hours?|hrs?|minutes?|sekunden?|sek\.?|sec\.?|seconds?)\b/gi;

function parseDurationToSeconds(match: RegExpExecArray): number {
  const valStr = match[1].replace(',', '.');
  let val = parseFloat(valStr);
  const unit = match[3].toLowerCase();
  
  if (match[2]) {
     const val2 = parseFloat(match[2].replace(',', '.'));
     val = Math.max(val, val2);
  }

  if (unit.startsWith('std') || unit.startsWith('stunde') || unit.startsWith('hour') || unit.startsWith('hr')) {
    return val * 3600;
  }
  if (unit.startsWith('sek') || unit.startsWith('sec')) {
    return val;
  }
  return val * 60;
}

export function StepTextWithTimers({ 
  text, 
  onStartTimer 
}: { 
  text: string, 
  onStartTimer: (seconds: number, label: string) => void 
}) {
  if (!text) return null;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  
  const regex = new RegExp(TIME_REGEX.source, TIME_REGEX.flags);
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const seconds = parseDurationToSeconds(match);
    const original = match[0];
    parts.push(
      <span key={match.index} className="inline-flex mx-1 align-middle">
        <button
          onClick={() => onStartTimer(seconds, original)}
          className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-accent hover:bg-accent/20 transition-colors font-medium active:scale-95"
          title={`${seconds}s Timer starten`}
        >
          <IconClock size={16} /> {original}
        </button>
      </span>
    );
    lastIndex = match.index + original.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts.length > 0 ? parts : text}</>;
}
