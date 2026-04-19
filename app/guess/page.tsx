"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { supabase } from "@/lib/supabase";

type GuessRow = {
  id: string;
  nickname: string;
  guess_text: string;
  is_correct: boolean;
  created_at: string;
};

export default function GuessPage() {
  const [guessInput, setGuessInput] = useState("");
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [message, setMessage] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const nickname =
    typeof window !== "undefined" ? localStorage.getItem("nickname") || "Unknown" : "Unknown";
  const roomCode =
    typeof window !== "undefined" ? localStorage.getItem("roomCode") || "" : "";

  // Resolve room ID and subscribe to guesses
  useEffect(() => {
    if (!roomCode) return;

    async function init() {
      const { data: room } = await supabase
        .from("Rooms")
        .select("id")
        .eq("room_code", roomCode)
        .maybeSingle();

      if (!room) return;
      setRoomId(room.id);

      const { data: existing } = await supabase
        .from("Guesses")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true });

      if (existing) setGuesses(existing);

      const alreadyGuessed = existing?.some((g) => g.nickname === nickname);
      if (alreadyGuessed) setSubmitted(true);
    }

    init();
  }, [roomCode, nickname]);

  // Realtime subscription
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`guesses-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Guesses", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setGuesses((prev) => [...prev, payload.new as GuessRow]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  async function handleGuessSubmit() {
    const trimmed = guessInput.trim();
    if (!trimmed) { setMessage("Type a guess first."); return; }
    if (submitted) { setMessage("You already submitted a guess this round."); return; }
    if (!roomId) { setMessage("Not connected to a room."); return; }

    const isCorrect = trimmed.toLowerCase().includes("eiffel");

    const { error } = await supabase.from("Guesses").insert({
      room_id: roomId,
      nickname,
      guess_text: trimmed,
      is_correct: isCorrect,
    });

    if (error) { setMessage("Failed to submit guess."); return; }

    setGuessInput("");
    setSubmitted(true);
    setMessage(isCorrect ? "Correct! Nice one." : "Guess submitted.");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleGuessSubmit();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.16),transparent_28%),radial-gradient(circle_at_72%_32%,rgba(16,185,129,0.12),transparent_30%),radial-gradient(circle_at_55%_75%,rgba(59,130,246,0.10),transparent_28%)]" />

      <div className="relative mx-auto max-w-[900px] px-6 py-10 flex flex-col gap-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-white/45 mb-1">Room Code</p>
          <p className="text-3xl font-black tracking-wide text-amber-300">{roomCode}</p>
        </div>

        {/* Image placeholder */}
        <section className="rounded-[40px] border border-amber-300/25 bg-[linear-gradient(135deg,rgba(139,92,246,0.18),rgba(56,189,248,0.10),rgba(16,185,129,0.12))] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
          <div className="flex min-h-[380px] flex-col items-center justify-center rounded-[32px] border border-white/10 bg-black/10 backdrop-blur-sm">
            <p className="text-white/40 text-lg">Image will appear here</p>
          </div>
        </section>

        {/* Guess input */}
        <section className="rounded-[32px] border border-amber-300/30 bg-black/30 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="flex gap-3">
            <input
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={submitted ? "You already guessed this round" : "Make your guess..."}
              disabled={submitted}
              className="h-16 flex-1 rounded-[24px] bg-transparent px-5 text-xl text-white outline-none placeholder:text-white/35 disabled:opacity-50"
            />
            <button
              onClick={handleGuessSubmit}
              disabled={submitted}
              className="rounded-[20px] bg-amber-400 px-8 text-xl font-bold text-black transition hover:scale-[1.02] hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              Guess
            </button>
          </div>
          {message && (
            <p className="mt-2 px-2 text-sm text-emerald-300/90">{message}</p>
          )}
        </section>

        {/* All guesses */}
        <section className="rounded-[28px] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(16,185,129,0.03))] p-6">
          <p className="mb-4 text-sm uppercase tracking-widest text-emerald-300">
            All Guesses ({guesses.length})
          </p>
          {guesses.length === 0 ? (
            <p className="text-white/35 text-sm">No guesses yet...</p>
          ) : (
            <div className="flex flex-col gap-3">
              {guesses.map((g) => (
                <div
                  key={g.id}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
                    g.is_correct ? "bg-emerald-400/14" : "bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full text-sm ${
                        g.is_correct ? "bg-emerald-400/20 text-emerald-300" : "bg-red-400/20 text-red-400"
                      }`}
                    >
                      {g.is_correct ? "✓" : "✕"}
                    </span>
                    <span className="text-white/90 font-semibold">{g.guess_text}</span>
                  </div>
                  <span className="text-white/40 text-sm">{g.nickname}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
