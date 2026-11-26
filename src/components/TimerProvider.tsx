"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useHaptic } from "@/hooks/useHaptic";

export type Timer = {
  id: string;
  label: string;
  endTime: number;
  /** Gesamtdauer in Sekunden (für den Fortschrittsring); fehlt bei Altbestand. */
  duration?: number;
  recipeId?: string;
};

type TimerContextType = {
  timers: Timer[];
  addTimer: (timer: Timer) => void;
  removeTimer: (id: string) => void;
};

const TimerContext = createContext<TimerContextType | null>(null);

export function useTimers() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimers must be used within a TimerProvider");
  return ctx;
}

const STORAGE_KEY = "reelrecipe_active_timers";

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timers, setTimers] = useState<Timer[]>([]);
  const haptic = useHaptic();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Timer[];
        const now = Date.now();
        const active = parsed.filter(t => t.endTime > now);
        setTimers(active);
      }
    } catch (e) {
      console.error("Failed to load timers", e);
    }
  }, []);

  // Save to localStorage whenever timers change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
    } catch (e) {
      console.error("Failed to save timers", e);
    }
  }, [timers]);

  const removeTimer = useCallback((id: string) => {
    setTimers(prev => prev.filter(t => t.id !== id));
  }, []);

  // Poll for expired timers
  useEffect(() => {
    if (timers.length === 0) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      let hasExpired = false;

      const active = timers.filter(t => {
        if (now >= t.endTime) {
          hasExpired = true;
          return false;
        }
        return true;
      });

      if (hasExpired) {
        setTimers(active);
        haptic('success');
        // Play beep or rely on haptic
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([200, 100, 200, 100, 200]);
        }
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [timers, haptic]);

  const addTimer = useCallback((timer: Timer) => {
    setTimers(prev => [...prev.filter(t => t.id !== timer.id), timer]);
  }, []);

  return (
    <TimerContext.Provider value={{ timers, addTimer, removeTimer }}>
      {children}
      <ActiveTimersOverlay timers={timers} removeTimer={removeTimer} />
    </TimerContext.Provider>
  );
}

function ActiveTimersOverlay({ timers, removeTimer }: { timers: Timer[], removeTimer: (id: string) => void }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (timers.length === 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timers.length]);

  if (timers.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {timers.map(timer => {
        const remaining = Math.max(0, Math.ceil((timer.endTime - now) / 1000));
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        
        return (
          <div key={timer.id} className="bg-surface shadow-pop rounded-ctl p-3 flex items-center gap-3 border border-line pointer-events-auto">
            {timer.duration ? (
              <TimerRing fraction={remaining / timer.duration} />
            ) : null}
            <div className="flex flex-col">
              <span className="max-w-[120px] truncate text-label font-medium text-ink-3">{timer.label}</span>
              <span className="nums text-h3 font-bold text-ink">
                {m}:{s.toString().padStart(2, "0")}
              </span>
            </div>
            <button 
              onClick={() => removeTimer(timer.id)}
              className="pressable flex h-11 w-11 items-center justify-center rounded-pill bg-surface-2 text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

const RING_R = 16;
const RING_C = 2 * Math.PI * RING_R;

/** Fortschrittsring: Strich schrumpft mit der Restzeit (nur stroke-dashoffset). */
function TimerRing({ fraction }: { fraction: number }) {
  const f = Math.min(1, Math.max(0, fraction));
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden className="shrink-0 -rotate-90">
      <circle cx="20" cy="20" r={RING_R} fill="none" strokeWidth="4" className="stroke-surface-3" />
      <circle
        cx="20"
        cy="20"
        r={RING_R}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className="timer-ring stroke-accent"
        strokeDasharray={RING_C}
        strokeDashoffset={RING_C * (1 - f)}
      />
    </svg>
  );
}
