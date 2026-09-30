"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { IconCheck, IconX } from "./Icons";

interface ToastOptions {
  action?: () => void;
  actionLabel?: string;
  duration?: number;
}

interface ToastData {
  id: number;
  message: string;
  type?: "success" | "error";
  action?: () => void;
  actionLabel?: string;
}

type ShowToast = (message: string, type?: "success" | "error", opts?: ToastOptions) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show: ShowToast = useCallback((message, type = "success", opts) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type, action: opts?.action, actionLabel: opts?.actionLabel }]);
    setTimeout(() => dismiss(id), opts?.duration ?? 2600);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live={toasts.some((t) => t.type === "error") ? "assertive" : "polite"}
        className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex flex-col items-center gap-2 px-4 md:bottom-10"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in flex items-center gap-2 rounded-ctl px-4 py-2.5 text-body font-medium text-white shadow-pop ${
              t.type === "error" ? "bg-danger" : "bg-ink"
            }`}
          >
            {t.type === "error" ? <IconX size={16} /> : <IconCheck size={16} />}
            {t.message}
            {t.action && t.actionLabel && (
              <button
                type="button"
                className="pointer-events-auto ml-2 font-semibold underline underline-offset-2 hover:opacity-80"
                onClick={() => {
                  t.action?.();
                  dismiss(t.id);
                }}
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
