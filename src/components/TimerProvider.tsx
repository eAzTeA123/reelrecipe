"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useHaptic } from "@/hooks/useHaptic";

export type Timer = {
  id: string;
  label: string;
  endTime: number;
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
          <div key={timer.id} className="bg-white/90 backdrop-blur shadow-lg rounded-xl p-3 flex items-center gap-3 border border-stone-200 pointer-events-auto">
            <div className="flex flex-col">
              <span className="text-xs text-stone-500 font-medium truncate max-w-[120px]">{timer.label}</span>
              <span className="font-mono font-bold text-stone-800 text-lg">
                {m}:{s.toString().padStart(2, "0")}
              </span>
            </div>
            <button 
              onClick={() => removeTimer(timer.id)}
              className="w-8 h-8 flex items-center justify-center bg-stone-100 hover:bg-stone-200 rounded-full text-stone-600 transition-colors"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
