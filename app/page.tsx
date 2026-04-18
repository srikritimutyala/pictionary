"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const router = useRouter();

  function CreateRoom() {
    console.log("Button clicked!");
    const trimmedNickname = nickname.trim();

    if (!trimmedNickname) {
      alert("Please enter a nickname.");
      return;
    }

    const roomCode = generateRoomCode();
    localStorage.setItem("nickname", trimmedNickname);
    localStorage.setItem("roomCode", roomCode);
    localStorage.setItem("isHost", "true");

    router.push(`/room/${roomCode}`);
  }

  function JoinRoom() {
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
      <button onClick={CreateRoom}>Create Room</button>
      <button onClick={JoinRoom}>Join Room</button>
            <input
        type="text"
        placeholder="Enter room code"
        value={joinCode}
        onChange={(e) => setJoinCode(e.target.value)}
      />
    </div>
  );
}
