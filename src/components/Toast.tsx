"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { IconCheck, IconX } from "./Icons";

interface ToastData {
  id: number;
  message: string;
  type?: "success" | "error";
}

const ToastContext = createContext<(message: string, type?: "success" | "error") => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const idRef = useRef(0);

  const show = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

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
            className={`toast-in flex items-center gap-2 rounded-full px-4 py-2.5 text-[15px] font-medium text-white shadow-pop ${
              t.type === "error" ? "bg-danger" : "bg-ink"
            }`}
          >
            {t.type === "error" ? <IconX size={16} /> : <IconCheck size={16} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
