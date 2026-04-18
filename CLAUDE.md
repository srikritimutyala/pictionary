@AGENTS.md

# Pictionary x Taboo — Hackathon Project

## Game Overview

A multiplayer word-guessing game that combines Pictionary and Taboo with AI image generation.

### Phases

1. **Taboo Phase** — Player receives a target word (e.g., "Eiffel Tower") and a list of forbidden words (e.g., Paris, France, Tower, Building, Landmark) they cannot use.
2. **Pictionary Phase** — Player engineers a creative prompt avoiding forbidden words and submits it to an AI image generator (Punter.js).
3. **Guess Phase** — Other players see the generated image and race to guess the target word. Correct guesses reward both creator (clarity) and guesser (speed).
4. **Economy Phase** — Players earn "Ink Credits" used to buy:
   - **Hints**: Blur-reveals or category tags for hard images
   - **Prompt Passes**: Skip one forbidden word in a future round

## Current Focus: Taboo Engine (Game Content)

The immediate task is building the dataset and logic for the Taboo phase. This means:

- A dataset of **target words** paired with **forbidden word lists**
- Forbidden words should include obvious synonyms, related proper nouns, and component words (e.g., for "Eiffel Tower": Paris, France, Tower, Iron, Building, Landmark, Structure, Metal)
- Categories to cover: landmarks, animals, foods, pop culture, abstract concepts
- Generation strategy: use Claude API to generate word + forbidden-word-list pairs in bulk

### Taboo Engine Data Shape

```ts
type TabooCard = {
  id: string;
  targetWord: string;         // What players must get others to guess
  forbiddenWords: string[];   // 5–8 words the prompter cannot use
  category: string;           // e.g. "Landmark", "Animal", "Food"
  difficulty: "easy" | "medium" | "hard";
};
```

### Content Generation Approach

Use the Claude API (`claude-sonnet-4-6`) to generate `TabooCard` objects in batches. Prompt it to produce creative, non-obvious forbidden word lists that still block the easiest paths to the answer.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **Image Generation**: Punter.js (AI image generation)
- **AI Content**: Claude API (Anthropic SDK) for Taboo card generation
- **Runtime**: Node.js

## Project Structure

```
app/
  layout.tsx       # Root layout
  page.tsx         # Home / lobby
  globals.css
next.config.ts
package.json
```

## Dev Commands

```bash
npm run dev    # Start dev server
npm run build  # Production build
npm run lint   # ESLint
```

## Key Constraints

- Always read `node_modules/next/dist/docs/` before using any Next.js API — this is Next.js 16 with breaking changes from prior versions.
- Forbidden word checking must be case-insensitive and catch partial matches (e.g., "tower" blocked if "Tower" is forbidden).
- Ink Credits are the core progression loop — never give them away for free outside of correct guesses.
