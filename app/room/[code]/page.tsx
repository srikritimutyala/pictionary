"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Player = {
  id: string;
  nickname: string;
  is_host: boolean;
  score: number;
};

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [players, setPlayers] = useState<Player[]>([]);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState("");

  const [nickname, setNickname] = useState("");

  useEffect(() => {
    setNickname(localStorage.getItem("nickname") || "");
  }, []);

  const isHost = useMemo(
    () => players.find((p) => p.nickname === nickname)?.is_host ?? false,
    [players, nickname]
  );

  useEffect(() => {
    if (!code) return;

    async function fetchPlayers() {
      const { data: room, error: roomError } = await supabase
        .from("Rooms")
        .select("id, status")
        .eq("room_code", code)
        .maybeSingle();

      if (roomError) {
        setMessage(roomError.message);
        setLoading(false);
        return;
      }

      if (!room) {
        setMessage("Room not found.");
        setLoading(false);
        return;
      }

      setRoomId(room.id);

      const { data, error: peopleError } = await supabase
        .from("People")
        .select("id, nickname, is_host, score")
        .eq("room_id", room.id);

      if (peopleError) {
        setMessage(peopleError.message);
      } else if (data) {
        setPlayers(data);
      }

      if (room.status === "playing" || room.status === "prompting" || room.status === "guessing") {
        const host = localStorage.getItem("isHost") === "true";
        router.push(host ? "/prompt" : "/guess");
        return;
      }

      setLoading(false);
    }

    fetchPlayers();

    const channel = supabase
      .channel(`room-${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "People" },
        async () => {
          if (!roomId) {
            const { data: room } = await supabase
              .from("Rooms")
              .select("id")
              .eq("room_code", code)
              .maybeSingle();

            if (!room) return;

            const { data } = await supabase
              .from("People")
              .select("id, nickname, is_host, score")
              .eq("room_id", room.id);

            if (data) setPlayers(data);
            return;
          }

          const { data } = await supabase
            .from("People")
            .select("id, nickname, is_host, score")
            .eq("room_id", roomId);

          if (data) setPlayers(data);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "Rooms" },
        (payload) => {
          const updatedRoom = payload.new as { room_code?: string; status?: string };
          if (updatedRoom.room_code !== code) return;

          if (
            updatedRoom.status === "playing" ||
            updatedRoom.status === "prompting" ||
            updatedRoom.status === "guessing"
          ) {
            const host = localStorage.getItem("isHost") === "true";
            router.push(host ? "/prompt" : "/guess");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, router, roomId]);

  async function startGame() {
    if (!roomId) return;

    setStarting(true);
    setMessage("");

    const promptEndsAt = new Date(Date.now() + 150 * 1000).toISOString();

    const { error } = await supabase
      .from("Rooms")
      .update({
        status: "prompting",
        prompt_ends_at: promptEndsAt,
        guess_ends_at: null,
        current_image_url: null,
        current_word: null,
        current_forbidden_words: null,
        current_prompt: null,
        winner_nickname: null,
      })
      .eq("id", roomId);

    setStarting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/prompt");
  }

  const hostPlayer = players.find((p) => p.is_host);

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
            <p className="text-3xl font-black tracking-wide text-amber-300">{code}</p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.25em] text-white/45">Status</p>
            <p className="text-lg font-semibold text-emerald-300">
              {loading ? "Loading..." : "Waiting Room"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.8fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-[32px] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),rgba(168,85,247,0.05),rgba(16,185,129,0.05))] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-amber-300/80">
                    Waiting Room
                  </p>
                  <h1 className="text-5xl font-semibold tracking-tight text-white">
                    Get Ready to Play
                  </h1>
                  <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/70">
                    Share the room code with your friends. Once everyone joins, the host can start the round.
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm uppercase tracking-[0.25em] text-white/45">Players</p>
                  <p className="text-6xl font-black text-amber-300">{players.length}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[32px] border border-violet-400/20 bg-black/30 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.22em] text-violet-300">Players in Room</p>
                <p className="text-sm font-semibold text-white/50">
                  {loading ? "Loading..." : `${players.length} connected`}
                </p>
              </div>

              {players.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-white/45">
                  No players yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {players.map((player, index) => {
                    const style = [
                      "bg-amber-400 text-black",
                      "bg-violet-500 text-white",
                      "bg-emerald-400 text-black",
                      "bg-sky-400 text-black",
                      "bg-pink-400 text-black",
                      "bg-orange-400 text-black",
                    ][index % 6];

                    return (
                      <div
                        key={player.id}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`grid h-12 w-12 place-items-center rounded-full text-lg font-black ${style}`}
                          >
                            {player.nickname.charAt(0).toUpperCase() || "?"}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xl font-semibold text-white/90">
                                {player.nickname}
                              </span>

                              {player.is_host && (
                                <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-xs font-semibold text-amber-300">
                                  Host
                                </span>
                              )}

                              {player.nickname === nickname && (
                                <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2 py-1 text-xs font-semibold text-sky-300">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className="text-lg font-bold text-white/60">{player.score} pts</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {message && (
              <section className="rounded-[24px] border border-red-400/20 bg-red-400/10 px-5 py-4 text-red-200 shadow-[0_18px_60px_rgba(0,0,0,0.25)] backdrop-blur-sm">
                {message}
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(16,185,129,0.03))] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <p className="mb-4 text-sm uppercase tracking-[0.22em] text-emerald-300">Room Details</p>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Code</p>
                  <p className="mt-1 text-2xl font-black text-amber-300">{code}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Host</p>
                  <p className="mt-1 text-lg font-semibold text-white/85">
                    {hostPlayer?.nickname || "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Your Role</p>
                  <p className="mt-1 text-lg font-semibold text-white/85">
                    {isHost ? "Host" : "Player"}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-fuchsia-400/15 bg-[linear-gradient(180deg,rgba(168,85,247,0.08),rgba(0,0,0,0.12))] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <p className="mb-4 text-sm uppercase tracking-[0.22em] text-fuchsia-300">Game Control</p>

              {isHost ? (
                <>
                  <button
                    className="w-full rounded-[20px] bg-amber-400 px-8 py-4 text-lg font-bold text-black transition hover:scale-[1.02] hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={startGame}
                    disabled={starting || players.length === 0}
                    type="button"
                  >
                    {starting ? "Starting..." : "Start Game"}
                  </button>

                  <p className="mt-3 text-sm text-white/45">
                    As host, you control when the first round begins.
                  </p>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center text-white/60">
                    Waiting for the host to start the game...
                  </div>

                  <p className="mt-3 text-sm text-white/45">
                    Stay here. You’ll be moved into the round automatically.
                  </p>
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}