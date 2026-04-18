"use client";

import { useParams } from "next/navigation";

export default function RoomPage() {
  const params = useParams();
  const code = params.code;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">Waiting Room</h1>
      <p className="text-lg">Room Code: {code}</p>
    </div>
  );
}