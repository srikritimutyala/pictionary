'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import cardsData from '@/data/taboo-cards.json';
import { supabase } from '@/lib/supabase';

type Card = {
  word: string;
  forbidden: string[];
};

type GuessItem = {
  id: number | string;
  nickname: string;
  guess_text: string;
  is_correct: boolean;
  created_at?: string;
  room_id?: number;
};

type RoomRow = {
  id: number;
  room_code: string;
  status: string | null;
  current_image_url: string | null;
  winner_nickname: string | null;
  prompt_ends_at: string | null;
  guess_ends_at: string | null;
};

const PROMPT_DURATION_SECONDS = 150;
const GUESS_DURATION_SECONDS = 45;

function getSecondsRemaining(endsAt: string | null | undefined) {
  if (!endsAt) return 0;
  const diff = Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000);
  return Math.max(0, diff);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWholePhrase(text: string, phrase: string) {
  if (!phrase.trim()) return false;
  const pattern = new RegExp(`\\b${escapeRegExp(phrase.toLowerCase())}\\b`, 'i');
  return pattern.test(text);
}

function pickRandomCard(): Card {
  return cardsData[Math.floor(Math.random() * cardsData.length)];
}

export default function PromptCreator() {
  const maxWords = 80;

  const [card, setCard] = useState<Card | null>(null);
  const [prompt, setPrompt] = useState('');
  const [timeLeft, setTimeLeft] = useState(PROMPT_DURATION_SECONDS);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [generating, setGenerating] = useState(false);

  const [roomCode, setRoomCode] = useState('');
  const [roomId, setRoomId] = useState<number | null>(null);
  const [guesses, setGuesses] = useState<GuessItem[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    setRoomCode(localStorage.getItem('roomCode') || '');
  }, []);

  useEffect(() => {
    setCard(pickRandomCard());
  }, []);

  const validation = useMemo(() => {
    const words = prompt.trim().split(/\s+/).filter(Boolean);
    const normalizedPrompt = prompt.toLowerCase().trim();
    const forbiddenWords = card?.forbidden || [];
    const targetWord = card?.word || '';

    const usedForbidden = forbiddenWords.filter((forbidden) =>
      containsWholePhrase(normalizedPrompt, forbidden)
    );

    const hasTargetWord = containsWholePhrase(normalizedPrompt, targetWord);

    return {
      count: words.length,
      hasForbidden: usedForbidden.length > 0,
      usedForbidden,
      hasTargetWord,
    };
  }, [prompt, card]);

  useEffect(() => {
    if (!roomCode) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadRoom() {
      const { data: room, error } = await supabase
        .from('Rooms')
        .select(
          'id, room_code, status, current_image_url, winner_nickname, prompt_ends_at, guess_ends_at'
        )
        .eq('room_code', roomCode)
        .single<RoomRow>();

      if (error || !room) {
        setStatusMessage(error?.message || 'Could not load room.');
        return;
      }

      setRoomId(room.id);

      if (room.status === 'prompting') {
        setSubmitted(false);
        setWinner(null);
        setImageUrl('');
        setGuesses([]);
        setTimeLeft(getSecondsRemaining(room.prompt_ends_at));
        setIsTimeUp(getSecondsRemaining(room.prompt_ends_at) <= 0);
      }

      if (room.status === 'guessing') {
        setSubmitted(true);
        setImageUrl(room.current_image_url || '');
        setTimeLeft(getSecondsRemaining(room.guess_ends_at));
        setIsTimeUp(false);
      }

      if (room.winner_nickname) {
        setWinner(room.winner_nickname);
      }
    }

    loadRoom();

    channel = supabase
      .channel(`prompt-room-state-${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Rooms',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const room = payload.new as RoomRow;

          setRoomId(room.id);

          if (room.status === 'prompting') {
            setSubmitted(false);
            setWinner(null);
            setImageUrl('');
            setGuesses([]);
            setPrompt('');
            setGenerating(false);
            setTimeLeft(getSecondsRemaining(room.prompt_ends_at));
            setIsTimeUp(getSecondsRemaining(room.prompt_ends_at) <= 0);
          }

          if (room.status === 'guessing') {
            setSubmitted(true);
            setImageUrl(room.current_image_url || '');
            setTimeLeft(getSecondsRemaining(room.guess_ends_at));
          }

          if (room.winner_nickname) {
            setWinner(room.winner_nickname);
            setStatusMessage(`${room.winner_nickname} guessed correctly!`);
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;

    const timer = window.setInterval(async () => {
      const { data: room } = await supabase
        .from('Rooms')
        .select('status, prompt_ends_at, guess_ends_at, winner_nickname')
        .eq('room_code', roomCode)
        .single<Pick<RoomRow, 'status' | 'prompt_ends_at' | 'guess_ends_at' | 'winner_nickname'>>();

      if (!room) return;

      if (room.status === 'prompting') {
        const next = getSecondsRemaining(room.prompt_ends_at);
        setTimeLeft(next);
        setIsTimeUp(next <= 0);
      }

      if (room.status === 'guessing') {
        const next = getSecondsRemaining(room.guess_ends_at);
        setTimeLeft(next);
      }

      if (room.winner_nickname) {
        setWinner(room.winner_nickname);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [roomCode]);

  useEffect(() => {
    if (!submitted || !roomCode) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadGuesses() {
      const { data: room, error: roomError } = await supabase
        .from('Rooms')
        .select('id, winner_nickname')
        .eq('room_code', roomCode)
        .single<{ id: number; winner_nickname: string | null }>();

      if (roomError || !room) {
        setStatusMessage(roomError?.message || 'Could not load room.');
        return;
      }

      setRoomId(room.id);

      if (room.winner_nickname) {
        setWinner(room.winner_nickname);
      }

      const { data: existingGuesses, error: guessesError } = await supabase
        .from('Guesses')
        .select('id, nickname, guess_text, is_correct, created_at, room_id')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true });

      if (guessesError) {
        setStatusMessage(guessesError.message);
        return;
      }

      setGuesses((existingGuesses || []) as GuessItem[]);
    }

    loadGuesses();

    channel = supabase
      .channel(`prompt-room-guesses-${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Guesses',
        },
        (payload) => {
          const newGuess = payload.new as GuessItem;

          if (roomId && newGuess.room_id !== roomId) return;

          setGuesses((prev) => {
            if (prev.some((g) => g.id === newGuess.id)) return prev;
            return [...prev, newGuess];
          });

          if (newGuess.is_correct) {
            setWinner(newGuess.nickname);
            setStatusMessage(`${newGuess.nickname} guessed correctly!`);
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [submitted, roomCode, roomId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSubmit = async () => {
    if (validation.hasTargetWord) {
      alert(`You can't submit! You used the target word.`);
      return;
    }

    if (validation.hasForbidden) {
      alert(`You can't submit! You used: ${validation.usedForbidden.join(', ')}`);
      return;
    }

    if (!card) return;
    if (!roomCode) {
      setStatusMessage('No room code found.');
      return;
    }

    setSubmitted(true);
    setGenerating(true);
    setStatusMessage('Generating image...');

    try {
      const puter = (window as any).puter;
      const img = await puter.ai.txt2img(prompt);
      setImageUrl(img.src);

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 512;
      canvas.height = img.naturalHeight || img.height || 512;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');

      ctx.drawImage(img, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png')
      );

      const fileName = `${roomCode}-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('game-images')
        .upload(fileName, blob, { contentType: 'image/png', upsert: true });

      if (uploadError) {
        throw new Error(`Image upload failed: ${uploadError.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('game-images').getPublicUrl(fileName);

      const guessEndsAt = new Date(Date.now() + GUESS_DURATION_SECONDS * 1000).toISOString();

      const { error: updateError } = await supabase
        .from('Rooms')
        .update({
          current_image_url: publicUrl,
          current_word: card.word,
          current_forbidden_words: card.forbidden,
          current_prompt: prompt,
          winner_nickname: null,
          status: 'guessing',
          prompt_ends_at: null,
          guess_ends_at: guessEndsAt,
        })
        .eq('room_code', roomCode);

      if (updateError) {
        throw new Error(`Room update failed: ${updateError.message}`);
      }

      setImageUrl(publicUrl);
      setTimeLeft(getSecondsRemaining(guessEndsAt));
      setStatusMessage('Image submitted. Waiting for guesses...');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatusMessage(message);
      alert(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleNextRound = async () => {
    if (!roomCode) {
      setStatusMessage('No room code found.');
      return;
    }

    setStatusMessage('Starting next round...');

    try {
      const nextCard = pickRandomCard();

      const { data: room, error: roomLookupError } = await supabase
        .from('Rooms')
        .select('id')
        .eq('room_code', roomCode)
        .single<{ id: number }>();

      if (roomLookupError || !room) {
        setStatusMessage(roomLookupError?.message || 'Could not find room.');
        return;
      }

      const { error: deleteGuessesError } = await supabase
        .from('Guesses')
        .delete()
        .eq('room_id', room.id);

      if (deleteGuessesError) {
        setStatusMessage(`Could not clear old guesses: ${deleteGuessesError.message}`);
        return;
      }

      const promptEndsAt = new Date(Date.now() + PROMPT_DURATION_SECONDS * 1000).toISOString();

      const { error: resetRoomError } = await supabase
        .from('Rooms')
        .update({
          current_image_url: null,
          current_word: null,
          current_forbidden_words: null,
          current_prompt: null,
          winner_nickname: null,
          status: 'prompting',
          prompt_ends_at: promptEndsAt,
          guess_ends_at: null,
        })
        .eq('room_code', roomCode);

      if (resetRoomError) {
        setStatusMessage(`Could not reset room: ${resetRoomError.message}`);
        return;
      }

      setCard(nextCard);
      setPrompt('');
      setTimeLeft(PROMPT_DURATION_SECONDS);
      setIsTimeUp(false);
      setSubmitted(false);
      setImageUrl('');
      setGenerating(false);
      setGuesses([]);
      setWinner(null);
      setRoomId(room.id);
      setStatusMessage('Next round ready.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatusMessage(message);
    }
  };

  if (submitted) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.16),transparent_28%),radial-gradient(circle_at_72%_32%,rgba(16,185,129,0.12),transparent_30%),radial-gradient(circle_at_55%_75%,rgba(59,130,246,0.10),transparent_28%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:110px_110px] opacity-20" />

        <div className="relative mx-auto max-w-[1280px] px-6 py-6">
          <div className="mb-8 flex items-center justify-between text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-white/45">Prompter View</p>
              <p className="text-2xl font-black tracking-wide text-emerald-300">Prompt Submitted</p>
            </div>

            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-white/45">Room Code</p>
              <p className="text-3xl font-black tracking-wide text-amber-300">{roomCode || '—'}</p>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.25em] text-white/45">Status</p>
              <p className="text-lg font-semibold text-white/85">
                {winner ? 'Round Finished' : generating ? 'Generating...' : 'Listening for Guesses'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.8fr_0.9fr]">
            <div className="space-y-6">
              <section className="rounded-[32px] border border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(168,85,247,0.05),rgba(59,130,246,0.05))] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-emerald-300/80">
                      Your Prompt
                    </p>
                    <h1 className="text-4xl font-semibold tracking-tight text-white">Watch Players Guess</h1>
                    <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/75">{prompt}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm uppercase tracking-[0.25em] text-white/45">Time Left</p>
                    <p className="text-6xl font-black text-amber-300">{timeLeft}s</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[40px] border border-amber-300/25 bg-[linear-gradient(135deg,rgba(139,92,246,0.18),rgba(56,189,248,0.10),rgba(16,185,129,0.12))] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                <div className="flex min-h-[420px] flex-col items-center justify-center gap-5 rounded-[32px] border border-white/10 bg-black/10 px-6 text-center backdrop-blur-sm">
                  {generating ? (
                    <>
                      <p className="text-2xl font-semibold text-white/85">Generating image...</p>
                      <p className="max-w-md text-sm leading-relaxed text-white/45">
                        Hold tight while your AI image finishes rendering.
                      </p>
                    </>
                  ) : imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Generated"
                      className="max-h-[520px] w-auto max-w-full rounded-xl object-contain"
                    />
                  ) : (
                    <p className="text-lg font-medium text-white/55">No image yet.</p>
                  )}
                </div>
              </section>

              {winner && (
                <section className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                  <p className="mb-2 text-sm uppercase tracking-[0.22em] text-emerald-300">Winner</p>
                  <p className="text-3xl font-black text-white">{winner} guessed correctly!</p>

                  <div className="mt-5">
                    <button
                      onClick={handleNextRound}
                      className="rounded-[20px] bg-amber-400 px-8 py-4 text-lg font-bold text-black transition hover:scale-[1.02] hover:bg-amber-300"
                      type="button"
                    >
                      Start Next Round
                    </button>
                  </div>
                </section>
              )}

              <section className="rounded-[28px] border border-white/10 bg-black/25 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                <p className="mb-4 text-sm uppercase tracking-[0.22em] text-white/55">Target Word</p>
                <p className="text-2xl font-semibold text-amber-300">{card?.word ?? '—'}</p>

                <div className="mt-6">
                  <p className="mb-3 text-sm uppercase tracking-[0.22em] text-white/55">Forbidden Words</p>
                  <div className="flex flex-wrap gap-3">
                    {(card?.forbidden ?? []).map((word) => (
                      <span
                        key={word}
                        className="rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-200"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="rounded-[28px] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(16,185,129,0.03))] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.22em] text-emerald-300">Live Guesses</p>
                  <p className="text-sm font-semibold text-emerald-300/80">({guesses.length})</p>
                </div>

                {guesses.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-white/45">
                    No guesses yet. Waiting for players...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {guesses.map((guess) => (
                      <div
                        key={guess.id}
                        className={`rounded-2xl px-4 py-4 ${
                          guess.is_correct ? 'bg-emerald-400/14' : 'bg-violet-400/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 text-lg font-semibold text-white/90">
                            <span
                              className={`grid h-7 w-7 place-items-center rounded-full text-sm ${
                                guess.is_correct
                                  ? 'bg-emerald-400/20 text-emerald-300'
                                  : 'bg-red-400/20 text-red-400'
                              }`}
                            >
                              {guess.is_correct ? '✓' : '✕'}
                            </span>
                            <span>{guess.guess_text}</span>
                          </div>

                          {guess.is_correct && (
                            <span className="text-lg font-bold text-emerald-300">Correct</span>
                          )}
                        </div>

                        <p className="mt-2 text-sm text-white/45">by {guess.nickname}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-[28px] border border-white/10 bg-black/25 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                <p className="mb-4 text-sm uppercase tracking-[0.22em] text-white/55">Round Status</p>
                <p className="text-lg font-medium text-white/85">{statusMessage || 'Waiting...'}</p>

                {roomId && <p className="mt-3 text-sm text-white/35">Room ID: {roomId}</p>}
              </section>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.16),transparent_28%),radial-gradient(circle_at_72%_32%,rgba(16,185,129,0.12),transparent_30%),radial-gradient(circle_at_55%_75%,rgba(59,130,246,0.10),transparent_28%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:110px_110px] opacity-20" />

        <div className="relative flex min-h-screen items-center justify-center px-6">
          <div className="rounded-[28px] border border-white/10 bg-black/25 px-8 py-6 text-lg text-white/80 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            Loading prompt card...
          </div>
        </div>
      </div>
    );
  }

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

          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.25em] text-white/45">Role</p>
            <p className="text-lg font-semibold text-emerald-300">Prompter</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.8fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-[32px] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),rgba(168,85,247,0.05),rgba(16,185,129,0.05))] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-amber-300/80">
                    Your Turn
                  </p>
                  <h1 className="text-5xl font-semibold tracking-tight text-white">Create the Prompt</h1>
                  <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/70">
                    Describe the target clearly enough for others to guess it, without using any forbidden words.
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm uppercase tracking-[0.25em] text-white/45">Time Left</p>
                  <p className="text-6xl font-black text-amber-300">{formatTime(timeLeft)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[32px] border border-violet-400/20 bg-black/30 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <p className="text-sm uppercase tracking-[0.22em] text-violet-300">Write Your Prompt</p>
                <p
                  className={`text-sm font-semibold ${
                    validation.count > maxWords ? 'text-red-300' : 'text-white/60'
                  }`}
                >
                  {validation.count}/{maxWords}
                </p>
              </div>

              <textarea
                value={prompt}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                placeholder="Describe the image without using the target or forbidden words..."
                disabled={isTimeUp || generating}
                className={`min-h-[260px] w-full rounded-[24px] border bg-white/5 px-5 py-4 text-lg text-white outline-none transition placeholder:text-white/30 ${
                  validation.hasForbidden || validation.hasTargetWord
                    ? 'border-red-400/50'
                    : 'border-white/10 focus:border-violet-400/50'
                }`}
              />

              {validation.hasTargetWord && (
                <p className="mt-3 text-sm font-medium text-red-300">
                  Remove the target word before submitting.
                </p>
              )}

              {validation.hasForbidden && (
                <p className="mt-3 text-sm font-medium text-red-300">
                  Remove forbidden words before submitting: {validation.usedForbidden.join(', ')}
                </p>
              )}

              {isTimeUp && (
                <p className="mt-3 text-sm font-medium text-red-300">Time is up for this round.</p>
              )}

              <div className="mt-5 flex items-center justify-between gap-4">
                <p className="text-sm text-white/40">
                  Use sensory details, shapes, materials, setting, and mood.
                </p>

                <button
                  onClick={handleSubmit}
                  disabled={
                    isTimeUp ||
                    validation.hasForbidden ||
                    validation.hasTargetWord ||
                    validation.count === 0 ||
                    generating
                  }
                  className="rounded-[20px] bg-amber-400 px-8 py-4 text-lg font-bold text-black transition hover:scale-[1.02] hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                >
                  {generating ? 'Generating...' : 'Submit Prompt'}
                </button>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(16,185,129,0.03))] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <p className="mb-4 text-sm uppercase tracking-[0.22em] text-emerald-300">Target Word</p>
              <div className="rounded-[24px] border border-emerald-300/20 bg-emerald-400/10 px-5 py-6 text-center">
                <p className="text-3xl font-black text-white">{card.word}</p>
              </div>
            </section>

            <section className="rounded-[28px] border border-red-400/15 bg-[linear-gradient(180deg,rgba(248,113,113,0.08),rgba(0,0,0,0.12))] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <p className="mb-4 text-sm uppercase tracking-[0.22em] text-red-300">Forbidden Words</p>

              <div className="flex flex-wrap gap-3">
                {card.forbidden.map((word: string) => {
                  const isUsed = containsWholePhrase(prompt.toLowerCase(), word);

                  return (
                    <span
                      key={word}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        isUsed
                          ? 'border-red-300/40 bg-red-400/20 text-red-200'
                          : 'border-white/10 bg-white/5 text-white/80'
                      }`}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-black/25 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <p className="mb-4 text-sm uppercase tracking-[0.22em] text-white/55">Prompt Tips</p>

              <div className="space-y-3 text-sm text-white/75">
                <p>✓ Use sensory details and geometry</p>
                <p>✓ Describe color, texture, setting, and scale</p>
                <p>✕ Do not use the target word</p>
                <p>✕ Do not use any forbidden words</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}