"use client";

import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type Player = {
  id: string;
  color: string;
  name: string;
  points: number;
  text: string;
};

type ConnectedPlayer = {
  id: string;
  name: string;
};

type GuessRow = {
  id: string;
  nickname: string;
  guess_text: string;
  is_correct: boolean;
  created_at: string;
};

export default function GuessPageUI() {
  const connectedPlayers = useMemo<ConnectedPlayer[]>(
    () => [
      { id: "A", name: "You" },
      { id: "B", name: "Player B" },
      { id: "Y", name: "Player Y" },
    ],
    []
  );

  const playerStyles = useMemo(
    () => [
      { color: "bg-amber-400", text: "text-amber-300" },
      { color: "bg-violet-500", text: "text-violet-300" },
      { color: "bg-emerald-400", text: "text-emerald-300" },
      { color: "bg-sky-400", text: "text-sky-300" },
      { color: "bg-pink-400", text: "text-pink-300" },
      { color: "bg-orange-400", text: "text-orange-300" },
      { color: "bg-cyan-400", text: "text-cyan-300" },
      { color: "bg-lime-400", text: "text-lime-300" },
    ],
    []
  );

  const players = useMemo<Player[]>(
    () =>
      connectedPlayers.map((player, index) => ({
        ...player,
        points: 0,
        color: playerStyles[index % playerStyles.length].color,
        text: playerStyles[index % playerStyles.length].text,
      })),
    [connectedPlayers, playerStyles]
  );

  const maxGuesses = 3;
  const startingInkCredits = 28;
  const startingTime = 45;

  const originalWord = "Eiffel Tower";
  const forbiddenWords = ["PARIS", "FRANCE", "TOWER"];

  const [guessInput, setGuessInput] = useState("");
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [scoreboard, setScoreboard] = useState<Player[]>(players);
  const [inkCredits, setInkCredits] = useState(startingInkCredits);
  const [timeLeft, setTimeLeft] = useState(startingTime);
  const [showPrompt, setShowPrompt] = useState(false);
  const [message, setMessage] = useState("");
  const [imageContent, setImageContent] = useState<ReactNode>(null);

  const handleBackToGame = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    setMessage("No previous page in history, so Back to Game could not navigate anywhere.");
  };

  const handleTogglePrompt = () => {
    setShowPrompt((prev) => {
      const nextValue = !prev;
      setMessage(nextValue ? "Prompt revealed." : "Prompt hidden.");
      return nextValue;
    });
  };

  const handleGuessSubmit = async () => {
    const trimmedGuess = guessInput.trim();

    if (!trimmedGuess) { setMessage("Type a guess first."); return; }
    if (submitted) { setMessage("You already used all available guesses this round."); return; }
    if (guesses.filter((g) => g.nickname === nickname).length >= maxGuesses) {
      setMessage("You already used all available guesses this round.");
      return;
    }
    if (!roomId) { setMessage("Not connected to a room."); return; }

    const isCorrect = trimmedGuess.toLowerCase().includes("eiffel");

    const { error } = await supabase.from("Guesses").insert({
      room_id: roomId,
      nickname,
      guess_text: trimmedGuess,
      is_correct: isCorrect,
    });

    if (error) { setMessage("Failed to submit guess."); return; }

    setGuessInput("");
    setSubmitted(true);

    if (isCorrect) {
      setScoreboard((prev) =>
        prev.map((player, index) =>
          index === 0 ? { ...player, points: player.points + 50 } : player
        )
      );
    }

    setMessage(isCorrect ? "Nice — correct guess! +50 points added." : "Guess submitted.");
  };

  const handlePromptPass = () => {
    if (promptPassUsed) {
      setMessage("You already used Prompt Pass this round.");
      return;
    }

    if (inkCredits < 10) {
      setMessage("Not enough ink credits for Prompt Pass.");
      return;
    }

    setInkCredits((prev) => prev - 10);
    setPromptPassUsed(true);
    setTimeLeft(60);
    setMessage("Prompt Pass activated. Timer refreshed to 60s for demo purposes.");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") handleGuessSubmit();
  };

  const handleLoadDemoImage = () => {
    setImageContent(
      <div className="text-[120px] leading-none drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]">🗼</div>
    );
    setMessage("Demo image loaded.");
  };

  const handleClearBoard = () => {
    setGuesses([]);
    setScoreboard(players);
    setGuessInput("");
    setImageContent(null);
    setShowPrompt(false);
    setPromptPassUsed(false);
    setInkCredits(startingInkCredits);
    setTimeLeft(startingTime);
    setFirstLetterRevealed(false);
    setRevealedForbiddenWords([]);
    setMessage("Board cleared and ready for your own game logic.");
  };

  // Map supabase guesses to the display format the UI expects
  const myGuesses = guesses.filter((g) => g.nickname === nickname);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.16),transparent_28%),radial-gradient(circle_at_72%_32%,rgba(16,185,129,0.12),transparent_30%),radial-gradient(circle_at_55%_75%,rgba(59,130,246,0.10),transparent_28%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:110px_110px] opacity-20" />

      <div className="relative mx-auto max-w-[1280px] px-6 py-6">
        <div className="mb-8 flex items-center justify-between text-sm">
          <button
            onClick={handleBackToGame}
            className="flex items-center gap-2 text-violet-300 transition hover:text-violet-200"
            type="button"
          >
            <span className="text-xl">←</span>
            <span className="font-medium">Back to Game</span>
          </button>

          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-white/45">Room Code</p>
            <p className="text-3xl font-black tracking-wide text-amber-300">{roomCode || "PROMPT42"}</p>
          </div>

          <button
            onClick={handleTogglePrompt}
            className="flex items-center gap-2 text-emerald-300 transition hover:text-emerald-200"
            type="button"
          >
            <span>👁</span>
            <span className="font-medium">{showPrompt ? "Hide Prompt" : "View Prompt"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.8fr_0.9fr]">
          <div className="space-y-6">
            <section>
              <p className="mb-4 text-sm uppercase tracking-[0.22em] text-white/45">
                {connectedPlayers.length} Players in Room
              </p>
              <div className="flex gap-4">
                {scoreboard.map((player) => (
                  <div
                    key={player.id}
                    className={`grid h-16 w-16 place-items-center rounded-full ${player.color} text-2xl font-black text-black shadow-[0_0_30px_rgba(255,255,255,0.05)]`}
                  >
                    {player.id}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[32px] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),rgba(168,85,247,0.05),rgba(16,185,129,0.05))] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-amber-300/80">
                    Round 1 of 5
                  </p>
                  <h1 className="text-5xl font-semibold tracking-tight text-white">Guess the Image</h1>
                </div>
                <div className="text-right">
                  <p className="text-sm uppercase tracking-[0.25em] text-white/45">Time Left</p>
                  <p className="text-6xl font-black text-amber-300">{timeLeft}s</p>
                </div>
              </div>
            </section>

            <section className="rounded-[40px] border border-amber-300/25 bg-[linear-gradient(135deg,rgba(139,92,246,0.18),rgba(56,189,248,0.10),rgba(16,185,129,0.12))] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-5 rounded-[32px] border border-white/10 bg-black/10 px-6 text-center backdrop-blur-sm">
                {imageContent ? (
                  imageContent
                ) : (
                  <>
                    <p className="text-lg font-medium text-white/55">No image loaded yet</p>
                    <p className="max-w-md text-sm leading-relaxed text-white/35">
                      This area is intentionally empty so you can connect it to your own drawing, upload,
                      prompt, or multiplayer game state later.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={handleLoadDemoImage}
                        type="button"
                        className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10"
                      >
                        Load Demo Image
                      </button>
                      <button
                        onClick={handleClearBoard}
                        type="button"
                        className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-400/15"
                      >
                        Clear Board
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>

            {showPrompt && (
              <section className="rounded-[28px] border border-white/10 bg-black/25 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                <p className="mb-4 text-sm uppercase tracking-[0.22em] text-white/55">The Prompt Used</p>
                <p className="text-2xl font-medium leading-relaxed text-white/80">
                  "A rusted iron A-shaped structure reaching the clouds in a city of baguettes and berets"
                </p>
              </section>
            )}

            <section className="rounded-[32px] border border-amber-300/30 bg-black/30 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="flex gap-3">
                <input
                  value={guessInput}
                  onChange={(event) => setGuessInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Make your guess..."
                  disabled={submitted}
                  className="h-16 flex-1 rounded-[24px] bg-transparent px-5 text-xl text-white outline-none placeholder:text-white/35 disabled:opacity-50"
                />
                <button
                  onClick={handleGuessSubmit}
                  className="rounded-[20px] bg-amber-400 px-8 text-xl font-bold text-black transition hover:scale-[1.02] hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitted}
                  type="button"
                >
                  Guess
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 px-2 text-sm">
                <p className="text-white/40">Press Enter or click Guess to submit</p>
                <p className="text-right text-emerald-300/90">{message}</p>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(16,185,129,0.03))] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.22em] text-emerald-300">Guesses</p>
                <p className="text-sm font-semibold text-emerald-300/80">
                  ({guesses.length})
                </p>
              </div>

              {guesses.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-white/45">
                  No guesses yet. This panel is ready to receive live guesses from your game logic.
                </div>
              ) : (
                <div className="space-y-3">
                  {guesses.map((guess) => (
                    <div
                      key={guess.id}
                      className={`flex items-center justify-between rounded-2xl px-4 py-4 ${
                        guess.is_correct ? "bg-emerald-400/14" : "bg-violet-400/10"
                      }`}
                    >
                      <div className="flex items-center gap-3 text-lg font-semibold text-white/90">
                        <span
                          className={`grid h-7 w-7 place-items-center rounded-full text-sm ${
                            guess.is_correct ? "bg-emerald-400/20 text-emerald-300" : "bg-red-400/20 text-red-400"
                          }`}
                        >
                          {guess.is_correct ? "✓" : "✕"}
                        </span>
                        <span>{guess.guess_text}</span>
                      </div>
                      <span className="text-white/40 text-xs">{guess.nickname}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-white/10 bg-black/25 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <p className="mb-5 text-sm uppercase tracking-[0.22em] text-white/55">Scores This Round</p>
              <div className="space-y-4">
                {scoreboard.map((player) => (
                  <div key={player.id} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`grid h-14 w-14 place-items-center rounded-full ${player.color} text-xl font-black text-black`}>
                        {player.id}
                      </div>
                      <span className="text-3xl font-semibold text-white/90">{player.name}</span>
                    </div>
                    <span className={`text-3xl font-black ${player.text}`}>{player.points} pts</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-fuchsia-400/15 bg-[linear-gradient(180deg,rgba(168,85,247,0.08),rgba(0,0,0,0.12))] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="mb-6 flex items-center justify-between">
    <p className="text-sm uppercase tracking-[0.22em] text-fuchsia-300">Your Ink Credits</p>
    <p className="text-4xl font-black text-amber-300">{inkCredits}</p>
  </div>

  <div className="space-y-3">
    <button
      onClick={handleRevealFirstLetter}
      className="w-full rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-lg font-semibold text-amber-200 transition hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={firstLetterRevealed || inkCredits < 5}
      type="button"
    >
      {firstLetterRevealed ? "✓ First Letter Revealed" : "🔤 Reveal First Letter (5 cr)"}
    </button>

    <button
      onClick={handleRevealForbiddenWord}
      className="w-full rounded-2xl border border-violet-400/20 bg-violet-400/10 px-5 py-4 text-lg font-semibold text-violet-200 transition hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={revealedForbiddenWords.length >= forbiddenWords.length || inkCredits < 5}
      type="button"
    >
      {revealedForbiddenWords.length >= forbiddenWords.length
        ? "✓ All Forbidden Words Revealed"
        : "🚫 Reveal Forbidden Word (5 cr)"}
    </button>
  </div>

  <div className="mt-4 space-y-2 text-sm text-white/70">
    {firstLetterRevealed && (
      <p>
        First letter: <span className="font-bold text-amber-300">{originalWord.charAt(0).toUpperCase()}</span>
      </p>
    )}

    {revealedForbiddenWords.length > 0 && (
      <div>
        <p className="mb-2">Revealed forbidden words:</p>
        <div className="flex flex-wrap gap-2">
          {revealedForbiddenWords.map((word) => (
            <span
              key={word}
              className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-semibold tracking-wide text-red-300"
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
