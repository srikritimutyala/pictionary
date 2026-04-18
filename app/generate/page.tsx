"use client";

import { useState } from "react";

export default function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  async function generateImage() {
    console.log("Generating image for:", prompt);
    // TODO: call your image generation API here
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <h1>Generate Image</h1>
      <input
        type="text"
        placeholder="Enter a prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button onClick={generateImage}>Generate</button>
      {imageUrl && <img src={imageUrl} alt="Generated" />}
    </div>
  );
}
