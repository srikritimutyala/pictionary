'use client';

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { supabase } from '@/lib/supabase';

type GuessRow = {
  id: string | number;
  nickname: string;
  text: string;
  correct: boolean;
  createdAt?: string | null;
};

type RoomData = {
  id: number;
  current_image_url: string | null;
  current_word: string | null;
  current_forbidden_words: string[] | null;
  current_prompt: string | null;
  winner_nickname: string | null;
  status: string | null;
  guess_ends_at: string | null;
};

type PlayerChip = {
  id: string;
  name: string;
  color: string;
  text: string;
  points: number;
};

const playerStyles = [
  { color: 'bg-amber-400', text: 'text-amber-300' },
  { color: 'bg-violet-500', text: 'text-violet-300' },
  { color: 'bg-emerald-400', text: 'text-emerald-300' },
  { color: 'bg-sky-400', text: 'text-sky-300' },
  { color: 'bg-pink-400', text: 'text-pink-300' },
  { color: 'bg-orange-400', text: 'text-orange-300' },
  { color: 'bg-cyan-400', text: 'text-cyan-300' },
  { color: 'bg-lime-400', text: 'text-lime-300' },
];

function normalizeGuess(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function guessesMatch(a: string, b: string) {
  return normalizeGuess(a) === normalizeGuess(b);
}

function getSecondsRemaining(endsAt: string | null | undefined) {
  if (!endsAt) return 0;
  const diff = Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000);
  return Math.max(0, diff);
}

export default function GuessPageUI() {
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('Unknown');

  const [guessInput, setGuessInput] = useState('');
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [inkCredits, setInkCredits] = useState(28);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [room, setRoom] = useState<RoomData | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [roundOver, setRoundOver] = useState(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);

  const [firstLetterRevealed, setFirstLetterRevealed] = useState(false);
  const [revealedForbiddenWords, setRevealedForbiddenWords] = useState<string[]>([]);

  useEffect(() => {
    setRoomCode(localStorage.getItem('roomCode') || '');
    setNickname(localStorage.getItem('nickname') || 'Unknown');
  }, []);

  const answer = room?.current_word?.trim() || '';
  const forbiddenWords = room?.current_forbidden_words ?? [];
  const imageUrl = room?.current_image_url ?? '';
  const promptUsed = room?.current_prompt ?? '';
  const roomStatus = room?.status ?? null;

  const hasImage = Boolean(imageUrl);
  const canUseHints = Boolean(answer) && forbiddenWords.length > 0;
  const canGuess = hasImage && roomStatus === 'guessing' && !roundOver && timeLeft > 0;

  const playerNames = useMemo(() => {
    const set = new Set<string>();
    if (nickname.trim()) set.add(nickname.trim());

    for (const guess of guesses) {
      if (guess.nickname?.trim()) {
        set.add(guess.nickname.trim());
      }
    }

    return Array.from(set);
  }, [guesses, nickname]);

  const scoreboard = useMemo<PlayerChip[]>(() => {
    return playerNames.map((name, index) => {
      const style = playerStyles[index % playerStyles.length];
      const playerGuesses = guesses.filter((g) => g.nickname === name);
      const correctGuess = playerGuesses.find((g) => g.correct);

      return {
        id: `${name}-${index}`,
        name,
        color: style.color,
        text: style.text,
        points: correctGuess ? 50 : 0,
      };
    });
  }, [playerNames, guesses]);

  useEffect(() => {
    if (!roomCode) {
      setLoadingRoom(false);
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      setLoadingRoom(true);

      const { data: roomData, error: roomError } = await supabase
        .from('Rooms')
        .select(
          'id, current_image_url, current_word, current_forbidden_words, current_prompt, winner_nickname, status, guess_ends_at'
        )
        .eq('room_code', roomCode)
        .single<RoomData>();

      if (roomError || !roomData) {
        setLoadingRoom(false);
        setMessage(roomError?.message || 'Could not load room.');
        return;
      }

      setRoom(roomData);
      setTimeLeft(getSecondsRemaining(roomData.guess_ends_at));

      if (roomData.winner_nickname) {
        setRoundOver(true);
        setWinnerName(roomData.winner_nickname);
      } else {
        setRoundOver(roomData.status === 'finished');
      }

      const { data: existingGuesses, error: guessError } = await supabase
        .from('Guesses')
        .select('id, nickname, guess_text, is_correct, created_at')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true });

      if (guessError) {
        setMessage(guessError.message);
      } else {
        const mapped: GuessRow[] = (existingGuesses || []).map((g: any) => ({
          id: g.id,
          nickname: g.nickname,
          text: g.guess_text,
          correct: g.is_correct,
          createdAt: g.created_at,
        }));

        setGuesses(mapped);

        const correctGuess = mapped.find((g) => g.correct);
        if (correctGuess) {
          setRoundOver(true);
          setWinnerName(correctGuess.nickname);
        }

        if (mapped.some((g) => g.nickname === nickname && g.correct)) {
          setSubmitted(true);
        }
      }

      setLoadingRoom(false);
    }

    init();

    channel = supabase
      .channel(`guess-room-${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Rooms',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const nextRoom = payload.new as RoomData;

          setRoom(nextRoom);
          setTimeLeft(getSecondsRemaining(nextRoom.guess_ends_at));

          if (nextRoom.status === 'prompting') {
            setRoundOver(false);
            setWinnerName(null);
            setSubmitted(false);
            setGuessInput('');
            setGuesses([]);
            setShowPrompt(false);
            setFirstLetterRevealed(false);
            setRevealedForbiddenWords([]);
            setMessage('Next round starting...');
          }

          if (nextRoom.status === 'guessing') {
            setRoundOver(false);
            setWinnerName(null);
          }

          if (nextRoom.winner_nickname) {
            setRoundOver(true);
            setWinnerName(nextRoom.winner_nickname);
            setMessage(`${nextRoom.winner_nickname} guessed the word!`);
          }

          if (nextRoom.status === 'finished' && !nextRoom.winner_nickname) {
            setRoundOver(true);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Guesses',
        },
        (payload) => {
          const g = payload.new as any;

          if (room?.id && g.room_id !== room.id) return;

          const nextGuess: GuessRow = {
            id: g.id,
            nickname: g.nickname,
            text: g.guess_text,
            correct: g.is_correct,
            createdAt: g.created_at,
          };

          setGuesses((prev) => {
            if (prev.some((existing) => existing.id === nextGuess.id)) return prev;
            return [...prev, nextGuess];
          });

          if (g.is_correct) {
            setRoundOver(true);
            setWinnerName(g.nickname);
            setMessage(`${g.nickname} guessed the word!`);

            if (g.nickname === nickname) {
              setSubmitted(true);
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomCode, nickname, room?.id]);

  useEffect(() => {
    if (!room?.guess_ends_at || roundOver) return;

    const timer = window.setInterval(() => {
      const next = getSecondsRemaining(room.guess_ends_at);
      setTimeLeft(next);

      if (next <= 0) {
        setRoundOver(true);
        setMessage((prev) => prev || 'Time is up.');
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [room?.guess_ends_at, roundOver]);

  const handleTogglePrompt = () => {
    if (!promptUsed) return;
    setShowPrompt((prev) => !prev);
  };

  const handleGuessSubmit = async () => {
    const trimmedGuess = guessInput.trim();

    if (!trimmedGuess) {
      setMessage('Type a guess first.');
      return;
    }

    if (!room?.id) {
      setMessage('Not connected to a room.');
      return;
    }

    if (!hasImage) {
      setMessage('Wait for the image first.');
      return;
    }

    if (roomStatus !== 'guessing') {
      setMessage('This round is not accepting guesses right now.');
      return;
    }

    if (roundOver || timeLeft <= 0) {
      setMessage('This round is already over.');
      return;
    }

    if (submitted) {
      setMessage('You already guessed correctly this round.');
      return;
    }

    if (!answer) {
      setMessage('No answer is stored for this room yet.');
      return;
    }

    const isCorrect = guessesMatch(trimmedGuess, answer);

    const { error: insertError } = await supabase.from('Guesses').insert({
      room_id: room.id,
      nickname,
      guess_text: trimmedGuess,
      is_correct: isCorrect,
    });

    if (insertError) {
      setMessage(`Failed to submit: ${insertError.message}`);
      return;
    }

    if (isCorrect) {
      const { error: roomUpdateError } = await supabase
        .from('Rooms')
        .update({
          winner_nickname: nickname,
          status: 'finished',
        })
        .eq('id', room.id);

      if (roomUpdateError) {
        setMessage(`Guess saved, but winner update failed: ${roomUpdateError.message}`);
        setGuessInput('');
        return;
      }

      setSubmitted(true);
      setRoundOver(true);
      setWinnerName(nickname);
      setMessage('Nice — correct guess!');
    } else {
      setMessage('Guess submitted.');
    }

    setGuessInput('');
  };

  const handleRevealFirstLetter = () => {
    if (!canUseHints) {
      setMessage('Hints are not available yet.');
      return;
    }

    if (firstLetterRevealed) {
      setMessage('You already revealed the first letter.');
      return;
    }

    if (inkCredits < 5) {
      setMessage('Not enough Ink Credits for that hint.');
      return;
    }

    setInkCredits((prev) => prev - 5);
    setFirstLetterRevealed(true);
    setMessage('First-letter hint unlocked.');
  };

  const handleRevealForbiddenWord = () => {
    if (!canUseHints) {
      setMessage('Hints are not available yet.');
      return;
    }

    if (revealedForbiddenWords.length >= forbiddenWords.length) {
      setMessage('All forbidden-word hints are already revealed.');
      return;
    }

    if (inkCredits < 7) {
      setMessage('Not enough Ink Credits for that hint.');
      return;
    }

    const remaining = forbiddenWords.filter((word) => !revealedForbiddenWords.includes(word));
    if (remaining.length === 0) {
      setMessage('No forbidden words left to reveal.');
      return;
    }

    const nextWord = remaining[Math.floor(Math.random() * remaining.length)];

    setInkCredits((prev) => prev - 7);
    setRevealedForbiddenWords((prev) => [...prev, nextWord]);
    setMessage('Forbidden-word hint unlocked.');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleGuessSubmit();
    }
  };

  const firstLetterHint = firstLetterRevealed && answer ? answer.charAt(0).toUpperCase() : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.16),transparent_28%),radial-gradient(circle_at_72%_32%,rgba(16,185,129,0.12),transparent_30%),radial-gradient(circle_at_55%_75%,rgba(59,130,246,0.10),transparent_28%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:110px_110px] opacity-20" />

      <div className="relative mx-auto max-w-[1280px] px-6 py-6">
        <div className="mb-8 flex items-center justify-between text-sm">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-violet-300 transition hover:text-violet-200"
            type="button"
          >
            <span className="text-xl">←</span>
            <span className="font-medium">Back</span>
          </button>

          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-white/45">Room Code</p>
            <p className="text-3xl font-black tracking-wide text-amber-300">{roomCode || '—'}</p>
          </div>

          <button
            onClick={handleTogglePrompt}
            className="flex items-center gap-2 text-emerald-300 transition hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!promptUsed}
          >
            <span>👁</span>
            <span className="font-medium">{showPrompt ? 'Hide Prompt' : 'View Prompt'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.8fr_0.9fr]">
          <div className="space-y-6">
            <section>
              <p className="mb-4 text-sm uppercase tracking-[0.22em] text-white/45">
                {scoreboard.length} Players Seen
              </p>
              <div className="flex flex-wrap gap-4">
                {scoreboard.map((player, index) => (
                  <div
                    key={player.id}
                    className={`grid h-16 w-16 place-items-center rounded-full ${player.color} text-2xl font-black text-black shadow-[0_0_30px_rgba(255,255,255,0.05)]`}
                    title={player.name}
                  >
                    {player.name.charAt(0).toUpperCase() || index + 1}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[32px] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),rgba(168,85,247,0.05),rgba(16,185,129,0.05))] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-amber-300/80">
                    Current Round
                  </p>
                  <h1 className="text-5xl font-semibold tracking-tight text-white">
                    {loadingRoom
                      ? 'Loading Room...'
                      : roomStatus === 'prompting'
                      ? 'Waiting for Prompt'
                      : roundOver
                      ? 'Round Finished'
                      : 'Guess the Image'}
                  </h1>
                </div>

                <div className="text-right">
                  <p className="text-sm uppercase tracking-[0.25em] text-white/45">Time Left</p>
                  <p className="text-6xl font-black text-amber-300">
                    {roundOver ? '0s' : `${timeLeft}s`}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[40px] border border-amber-300/25 bg-[linear-gradient(135deg,rgba(139,92,246,0.18),rgba(56,189,248,0.10),rgba(16,185,129,0.12))] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-5 rounded-[32px] border border-white/10 bg-black/10 px-6 text-center backdrop-blur-sm">
                {loadingRoom ? (
                  <>
                    <p className="text-lg font-medium text-white/70">Loading room...</p>
                    <p className="max-w-md text-sm leading-relaxed text-white/35">
                      Pulling the latest game state from Supabase.
                    </p>
                  </>
                ) : hasImage ? (
                  <img
                    src={imageUrl}
                    alt="Generated"
                    className="max-h-[520px] w-auto max-w-full rounded-xl object-contain"
                  />
                ) : (
                  <>
                    <p className="text-lg font-medium text-white/55">Waiting for the prompter to finish</p>
                    <p className="max-w-md text-sm leading-relaxed text-white/35">
                      The image will appear here as soon as the prompt is submitted and generated.
                    </p>
                  </>
                )}
              </div>
            </section>

            {showPrompt && promptUsed && (
              <section className="rounded-[28px] border border-white/10 bg-black/25 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                <p className="mb-4 text-sm uppercase tracking-[0.22em] text-white/55">The Prompt Used</p>
                <p className="text-2xl font-medium leading-relaxed text-white/80">“{promptUsed}”</p>
              </section>
            )}

            <section className="rounded-[32px] border border-amber-300/30 bg-black/30 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="flex gap-3">
                <input
                  value={guessInput}
                  onChange={(event) => setGuessInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={canGuess ? 'Make your guess...' : 'Waiting for active round...'}
                  className="h-16 flex-1 rounded-[24px] bg-transparent px-5 text-xl text-white outline-none placeholder:text-white/35"
                  disabled={!canGuess}
                />
                <button
                  onClick={handleGuessSubmit}
                  className="rounded-[20px] bg-amber-400 px-8 text-xl font-bold text-black transition hover:scale-[1.02] hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!canGuess}
                >
                  Guess
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 px-2 text-sm">
                <p className="text-white/40">
                  {roundOver
                    ? winnerName
                      ? `${winnerName} won this round`
                      : 'Round over'
                    : roomStatus === 'prompting'
                    ? 'Waiting for the prompter to start the guessing phase'
                    : 'Press Enter or click Guess to submit'}
                </p>
                <p className="text-right text-emerald-300/90">{message}</p>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(16,185,129,0.03))] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.22em] text-emerald-300">Guesses</p>
                <p className="text-sm font-semibold text-emerald-300/80">({guesses.length})</p>
              </div>

              {guesses.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-white/45">
                  No guesses yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {guesses.map((guess) => (
                    <div
                      key={guess.id}
                      className={`rounded-2xl px-4 py-4 ${
                        guess.correct ? 'bg-emerald-400/14' : 'bg-violet-400/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 text-lg font-semibold text-white/90">
                          <span
                            className={`grid h-7 w-7 place-items-center rounded-full text-sm ${
                              guess.correct
                                ? 'bg-emerald-400/20 text-emerald-300'
                                : 'bg-red-400/20 text-red-400'
                            }`}
                          >
                            {guess.correct ? '✓' : '✕'}
                          </span>
                          <span>{guess.text}</span>
                        </div>

                        {guess.correct && (
                          <span className="text-lg font-bold text-emerald-300">+50 pts</span>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-white/45">by {guess.nickname}</p>
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
                      <div
                        className={`grid h-14 w-14 place-items-center rounded-full ${player.color} text-xl font-black text-black`}
                      >
                        {player.name.charAt(0).toUpperCase()}
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
                  className="w-full rounded-2xl border border-violet-400/20 bg-violet-400/10 px-5 py-4 text-lg font-semibold text-violet-200 transition hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={firstLetterRevealed || inkCredits < 5 || !canGuess}
                  type="button"
                >
                  {firstLetterRevealed ? '✓ First Letter Revealed' : '✦ First Letter Hint (5 cr)'}
                </button>

                <button
                  onClick={handleRevealForbiddenWord}
                  className="w-full rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10 px-5 py-4 text-lg font-semibold text-fuchsia-200 transition hover:bg-fuchsia-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    !canGuess ||
                    inkCredits < 7 ||
                    !canUseHints ||
                    revealedForbiddenWords.length >= forbiddenWords.length
                  }
                  type="button"
                >
                  {revealedForbiddenWords.length > 0
                    ? '✦ Reveal Another Forbidden Word (7 cr)'
                    : '✦ Forbidden Word Hint (7 cr)'}
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">First Letter</p>
                  <p className="mt-1 text-lg font-semibold text-white/85">
                    {firstLetterHint ?? 'Not revealed yet'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Forbidden Words Revealed</p>
                  <p className="mt-1 text-lg font-semibold text-white/85">
                    {revealedForbiddenWords.length > 0
                      ? revealedForbiddenWords.join(', ')
                      : 'None yet'}
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}