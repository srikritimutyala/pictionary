"use client";

import { useState } from "react";
import tabooCards from "@/data/taboo-cards.json";

type TabooCard = { word: string; forbidden: string[] };

function pickRandom(): TabooCard {
  return tabooCards[Math.floor(Math.random() * tabooCards.length)] as TabooCard;
}

export default function GeneratePage() {
  const [card, setCard] = useState<TabooCard>(() => pickRandom());
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateImage() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const puter = (window as any).puter;
      const img = await puter.ai.txt2img(prompt);
      setImageUrl(img.src);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-6 bg-zinc-50 font-sans dark:bg-black p-8">
      <div className="text-center">
        <p className="text-sm text-zinc-500 uppercase tracking-widest mb-1">Draw this word</p>
        <h1 className="text-4xl font-bold">{card.word}</h1>
      </div>

      <div className="text-center">
        <p className="text-sm text-zinc-500 uppercase tracking-widest mb-2">Forbidden words</p>
        <div className="flex flex-wrap justify-center gap-2">
          {card.forbidden.map((w) => (
            <span key={w} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
              {w}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={() => { setCard(pickRandom()); setPrompt(""); setImageUrl(""); }}
        className="text-xs text-zinc-400 underline"
      >
        New word
      </button>

      <input
        type="text"
        placeholder="Enter your prompt (no forbidden words!)"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full max-w-lg border rounded px-4 py-2"
      />
      <button onClick={generateImage} disabled={loading} className="px-6 py-2 bg-black text-white rounded disabled:opacity-50">
        {loading ? "Generating..." : "Generate"}
      </button>
      {imageUrl && <img src={imageUrl} alt="Generated" className="max-w-lg rounded shadow" />}
    </div>
  );
}
