"use client";

import { useState } from "react";

export default function GuessPage() {
  const [guess, setGuess] = useState("");

  function submitGuess() {
    console.log("Guess submitted:", guess);
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <h1>Guess the Drawing</h1>
      <input
        type="text"
        placeholder="Enter your guess"
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
      />
      <button onClick={submitGuess}>Submit Guess</button>
    </div>
  );
}
