"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Player = {
  id: string;
  nickname: string;
  is_host: boolean;
  score: number;
};

export default function RoomPage() {
  const params = useParams();
  const code = params.code as string;
  const [players, setPlayers] = useState<Player[]>([]);
  const [nickname] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("nickname") || "" : ""
  );
  const isHost = players.find((p) => p.nickname === nickname)?.is_host ?? false;

  useEffect(() => {
    if (!code) return;

    async function fetchPlayers() {
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
    }

    fetchPlayers();

    // Realtime subscription to People table
    const channel = supabase
      .channel(`room-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "People" }, () => {
        fetchPlayers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [code]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 dark:bg-black font-sans px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-1">Waiting Room</h1>
        <p className="text-zinc-500 text-sm">Share this code with your friends</p>
        <div className="mt-2 px-6 py-3 bg-zinc-200 dark:bg-zinc-800 rounded-xl text-3xl font-mono font-bold tracking-widest">
          {code}
        </div>
      </div>

      <div className="w-full max-w-sm">
        <h2 className="text-lg font-semibold mb-3">Players ({players.length})</h2>
        <ul className="flex flex-col gap-2">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.nickname}</span>
                {p.is_host && (
                  <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">
                    Host
                  </span>
                )}
                {p.nickname === nickname && (
                  <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                    You
                  </span>
                )}
              </div>
              <span className="text-zinc-400 text-sm">{p.score} pts</span>
            </li>
          ))}
        </ul>
      </div>

      {isHost && (
        <button
          className="mt-4 px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl"
          onClick={() => alert("Starting game...")}
        >
          Start Game
        </button>
      )}

      {!isHost && (
        <p className="text-zinc-400 text-sm">Waiting for the host to start...</p>
      )}
    </div>
  );
}
