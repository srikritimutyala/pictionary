"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const router = useRouter();

  async function CreateRoom() {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      alert("Please enter a wnickname.");
      return;
    }

    const roomCode = generateRoomCode();

    const { data: room, error: roomError } = await supabase
      .from("Rooms")
      .insert({ room_code: roomCode, status: "waiting", host_name: trimmedNickname, num_rounds: 3 })
      .select()
      .single();

    if (roomError || !room) {
      alert("Failed to create room: " + roomError?.message);
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

    const { data: room, error: roomError } = await supabase
      .from("Rooms")
      .select()
      .eq("room_code", trimmedJoinCode)
      .maybeSingle();

    if (roomError) {
      alert("Error looking up room: " + roomError.message);
      return;
    }
    if (!room) {
      alert(`No room found with code "${trimmedJoinCode}". Double-check the code.`);
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
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <input
        type="text"
        placeholder="Enter nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />
      <input
        type="text"
        placeholder="Enter room code"
        value={joinCode}
        onChange={(e) => setJoinCode(e.target.value)}
      />
      <button onClick={CreateRoom}>Create Room</button>
      <button onClick={JoinRoom}>Join Room</button>
      <button onClick={() => router.push("/guess")}>Guessing Page</button>
      <button onClick={() => router.push("/generate")}>Generate Image</button>
      <button onClick={() => router.push("/prompt")}>Prompt</button>
    </div>
  );
}
