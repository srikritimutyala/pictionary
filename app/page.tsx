"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState<"create" | "join" | "">("");
  const router = useRouter();

  async function CreateRoom() {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      alert("Please enter a nickname.");
      return;
    }

    setLoading("create");

    const roomCode = generateRoomCode();

    const { data: room, error: roomError } = await supabase
      .from("Rooms")
      .insert({
        room_code: roomCode,
        status: "waiting",
        host_name: trimmedNickname,
        num_rounds: 3,
      })
      .select()
      .single();

    if (roomError || !room) {
      alert("Failed to create room: " + roomError?.message);
      setLoading("");
      return;
    }

    await supabase.from("People").insert({
      room_id: room.id,
      nickname: trimmedNickname,
      score: 0,
      coins: 0,
      is_host: true,
    });

    localStorage.setItem("nickname", trimmedNickname);
    localStorage.setItem("roomCode", roomCode);
    localStorage.setItem("isHost", "true");

    setLoading("");
    router.push(`/room/${roomCode}`);
  }

  async function JoinRoom() {
    const trimmedNickname = nickname.trim();
    const trimmedJoinCode = joinCode.trim().toUpperCase();

    if (!trimmedNickname) {
      alert("Please enter a nickname.");
      return;
    }
    if (!trimmedJoinCode) {
      alert("Please enter a room code.");
      return;
    }

    setLoading("join");

    const { data: room, error: roomError } = await supabase
      .from("Rooms")
      .select()
      .eq("room_code", trimmedJoinCode)
      .maybeSingle();

    if (roomError) {
      alert("Error looking up room: " + roomError.message);
      setLoading("");
      return;
    }
    if (!room) {
      alert(`No room found with code "${trimmedJoinCode}". Double-check the code.`);
      setLoading("");
      return;
    }

    const { data: existing } = await supabase
      .from("People")
      .select("id, is_host")
      .eq("room_id", room.id)
      .eq("nickname", trimmedNickname)
      .maybeSingle();

    if (existing) {
      localStorage.setItem("nickname", trimmedNickname);
      localStorage.setItem("roomCode", trimmedJoinCode);
      localStorage.setItem("isHost", String(existing.is_host));
      setLoading("");
      router.push(`/room/${trimmedJoinCode}`);
      return;
    }

    await supabase.from("People").insert({
      room_id: room.id,
      nickname: trimmedNickname,
      score: 0,
      coins: 0,
      is_host: false,
    });

    localStorage.setItem("nickname", trimmedNickname);
    localStorage.setItem("roomCode", trimmedJoinCode);
    localStorage.setItem("isHost", "false");

    setLoading("");
    router.push(`/room/${trimmedJoinCode}`);
  }

  function generateRoomCode(length = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < length; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.10),transparent_20%),radial-gradient(circle_at_75%_30%,rgba(168,85,247,0.10),transparent_22%),radial-gradient(circle_at_65%_80%,rgba(59,130,246,0.12),transparent_25%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:110px_110px] opacity-20" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-16">
        <div className="w-full text-center">
          <div className="mx-auto mb-6 inline-flex items-center rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">
            Prompt-Powered Party Game
          </div>

          <h1 className="mx-auto max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-7xl">
            PROMPT PARTY
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/65">
            Where forbidden words meet creative prompts — guess, generate, and outsmart your friends.
          </p>

          <div className="mx-auto mt-10 max-w-md space-y-4">
            <input
              type="text"
              placeholder="Enter nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none placeholder:text-white/35 focus:border-amber-300/40"
            />

            <input
              type="text"
              placeholder="Enter room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center text-white outline-none placeholder:text-white/35 focus:border-violet-300/40"
            />
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={CreateRoom}
              disabled={loading !== ""}
              className="inline-flex min-w-[180px] items-center justify-center rounded-2xl bg-amber-400 px-8 py-4 text-base font-bold text-black transition hover:scale-[1.02] hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === "create" ? "Creating..." : "⊕ Create Room"}
            </button>

            <button
              onClick={JoinRoom}
              disabled={loading !== ""}
              className="inline-flex min-w-[180px] items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-400/10 px-8 py-4 text-base font-bold text-violet-200 transition hover:scale-[1.02] hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === "join" ? "Joining..." : "⇢ Join Room"}
            </button>
          </div>

          <p className="mt-8 text-sm text-white/35">
            No sign-up needed • Jump into a round instantly
          </p>
        </div>
      </div>
    </div>
  );
}