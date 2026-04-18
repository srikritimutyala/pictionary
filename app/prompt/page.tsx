"use client";

import { useState } from "react";

export default function PromptPage() {
  const [prompt, setPrompt] = useState("");

  function submitPrompt() {
    console.log("Prompt submitted:", prompt);
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <h1>Enter a Prompt</h1>
      <input
        type="text"
        placeholder="Enter your prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button onClick={submitPrompt}>Submit Prompt</button>
    </div>
  );
}
