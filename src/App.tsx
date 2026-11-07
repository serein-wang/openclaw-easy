import { useEffect, useState } from "react";
import { ChatApp } from "./components/ChatApp.tsx";
import { Onboarding } from "./components/Onboarding.tsx";
import { Button } from "./components/ui/button.tsx";
import type { Snapshot } from "./domain/types.ts";
import { api } from "./lib/api.ts";

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void api<Snapshot>("/api/state")
      .then((next) => {
        if (!cancelled) {
          setSnapshot(next);
          setError("");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "打不开本机数据");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (error && !snapshot) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f5f5f7] px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">本机 Easy Shell 没打开</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#6e6e73]">{error}</p>
          <Button
            className="mt-6"
            onClick={() => {
              setError("");
              setAttempt((value) => value + 1);
            }}
          >
            重试
          </Button>
        </div>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f5f5f7] px-6">
        <p className="text-[15px] text-[#6e6e73]">正在打开本机 Easy Shell…</p>
      </main>
    );
  }

  if (!snapshot.onboarded) {
    return <Onboarding snapshot={snapshot} onDone={setSnapshot} />;
  }

  return <ChatApp snapshot={snapshot} onChange={setSnapshot} />;
}
