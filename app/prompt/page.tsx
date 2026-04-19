'use client';

import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import cardsData from '@/data/taboo-cards.json';
import { supabase } from '@/lib/supabase';

type Card = {
  word: string;
  forbidden: string[];
};

const PromptCreator = () => {
  // Game Configuration
  const initialTime = 150; // 2:30
  const maxWords = 80;

  // State
  const [card, setCard] = useState<Card | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(initialTime);
  const [isTimeUp, setIsTimeUp] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [generating, setGenerating] = useState<boolean>(false);

  // Load random card on mount
  useEffect(() => {
    if (cardsData && cardsData.length > 0) {
      const randomCard = cardsData[Math.floor(Math.random() * cardsData.length)];
      setCard(randomCard);
    }
  }, []);

  // Memoized Word Validation
  const validation = useMemo(() => {
    const words = prompt.trim().split(/\s+/).filter((w: string) => w.length > 0);
    const forbiddenWords = card?.forbidden || [];
    const usedForbidden = forbiddenWords.filter((forbidden: string) => 
      prompt.toLowerCase().includes(forbidden.toLowerCase())
    );
    
    return {
      count: words.length,
      hasForbidden: usedForbidden.length > 0,
      usedForbidden
    };
  }, [prompt, card?.forbidden]);

  // Timer Logic
  useEffect(() => {
    if (timeLeft <= 0 || submitted) {
      if (timeLeft <= 0) setIsTimeUp(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev: number) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submitted]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSubmit = async () => {
    if (validation.hasForbidden) {
      alert(`You can't submit! You used: ${validation.usedForbidden.join(', ')}`);
      return;
    }
    setSubmitted(true);
    setGenerating(true);
    try {
      const puter = (window as any).puter;
      const img = await puter.ai.txt2img(prompt);
      setImageUrl(img.src);

      // Upload image to Supabase Storage and broadcast to guessers
      const roomCode = localStorage.getItem('roomCode');
      if (roomCode) {
        const blob = await fetch(img.src).then((r) => r.blob());
        const fileName = `${roomCode}-${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from('game-images')
          .upload(fileName, blob, { contentType: 'image/png', upsert: true });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('game-images')
            .getPublicUrl(fileName);

          await supabase
            .from('rooms')
            .update({ current_image_url: publicUrl })
            .eq('room_code', roomCode);
        }
      }
    } finally {
      setGenerating(false);
    }
  };

  if (submitted) {
    return (
      <div style={styles.body}>
        <div style={styles.container}>
          <h1 style={{textAlign: 'center'}}>✅ Prompt Submitted!</h1>
          {generating ? (
            <p style={{textAlign: 'center', color: '#64748b'}}>Generating image...</p>
          ) : imageUrl ? (
            <>
              <img src={imageUrl} alt="Generated" style={{width: '100%', borderRadius: '8px', marginTop: '1rem'}} />
              <p style={{textAlign: 'center', color: '#64748b', marginTop: '0.5rem'}}>Waiting for other players to guess...</p>
            </>
          ) : (
            <p style={{textAlign: 'center', color: '#64748b'}}>Waiting for other players to guess...</p>
          )}
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div style={styles.body}>
        <div style={styles.container}>
          <p style={{textAlign: 'center'}}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.body}>
      <div style={styles.container}>
        <div style={styles.headerTag}>YOUR TURN</div>
        <h1 style={styles.title}>Create a Prompt</h1>
        
        <p style={styles.subLabel}>YOUR WORD TO DESCRIBE</p>
        <div style={styles.targetWord}>{card.word}</div>

        <p style={styles.description}>
          Describe this concept without using the words below.
        </p>

        <div style={styles.forbiddenBox}>
          <div style={styles.forbiddenTitle}>⚠️ FORBIDDEN WORDS</div>
          <div style={styles.tagContainer}>
            {card.forbidden.map((word: string) => (
              <span key={word} style={{
                ...styles.tag,
                backgroundColor: prompt.toLowerCase().includes(word.toLowerCase()) ? '#000000' : '#fff',
                color: prompt.toLowerCase().includes(word.toLowerCase()) ? '#fff' : '#000000'
              }}>
                {word}
              </span>
            ))}
          </div>
        </div>

        <div style={styles.inputHeader}>
          <label style={{ fontWeight: 'bold' }}>WRITE YOUR PROMPT</label>
          <span style={{ color: validation.count > maxWords ? '#000000' : '#000000' }}>
            {validation.count}/{maxWords}
          </span>
        </div>

        <textarea
          style={{
            ...styles.textarea,
            borderColor: validation.hasForbidden ? '#000000' : '#e2e8f0'
          }}
          value={prompt}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
          placeholder="A massive lattice structure built for a world fair..."
          disabled={isTimeUp}
        />

        {validation.hasForbidden && (
          <p style={{color: '#000000', fontSize: '0.8rem', marginTop: '4px'}}>
            Remove forbidden words to submit!
          </p>
        )}

        <div style={styles.timerSection}>
          <div style={styles.timerLabel}>TIME LEFT</div>
          <div style={{ 
            ...styles.timerDisplay, 
            color: timeLeft < 30 ? '#000000' : '#000000' 
          }}>
            {formatTime(timeLeft)}
          </div>
        </div>

        <button 
          style={{ 
            ...styles.submitBtn, 
            opacity: (isTimeUp || validation.hasForbidden || validation.count === 0) ? 0.5 : 1,
            cursor: (isTimeUp || validation.hasForbidden || validation.count === 0) ? 'not-allowed' : 'pointer'
          }}
          onClick={handleSubmit}
          disabled={isTimeUp || validation.hasForbidden || validation.count === 0}
        >
          Submit Your Prompt
        </button>

        <div style={styles.tipsBox}>
          <div style={{ fontWeight: 'bold', color:'#000000', marginBottom: '8px', fontSize: '0.8rem' }}>💡 PROMPT TIPS</div>
          <ul style={styles.tipsList}>
            <li>✓ Use sensory details and geometry</li>
            <li><span style={{ color: '#000000' }}>✗</span> No exact synonyms of forbidden words</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// ... Styles remain the same as your previous snippet ...
const styles: { [key: string]: any } = {
  body: { display: 'flex', justifyContent: 'center', background: '#f8fafc', minHeight: '100vh', padding: '20px', fontFamily: 'system-ui, sans-serif' },
  container: { maxWidth: '450px', width: '100%', background: '#fff', padding: '2rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', height: 'fit-content' },
  headerTag: { color: '#000000', fontWeight: 'bold', fontSize: '0.75rem', letterSpacing: '1px' },
  title: { fontSize: '1.5rem', margin: '8px 0', color: '#000000' },
  subLabel: { fontSize: '0.7rem', color: '#000000', marginBottom: '4px', fontWeight: 'bold' },
  targetWord: { background: '#e0e7ff', color: '#000000', padding: '1rem', borderRadius: '8px', textAlign: 'center', fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' },
  description: { fontSize: '0.85rem', color: '#000000', marginBottom: '1rem' },
  forbiddenBox: { background: '#fff1f1', border: '1px solid #000000', padding: '1rem', borderRadius: '8px', marginBottom: '1.2rem' },
  forbiddenTitle: { color: '#000000', fontWeight: 'bold', fontSize: '0.7rem', marginBottom: '8px' },
  tagContainer: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  tag: { border: '1px solid #000000', padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem', transition: 'all 0.2s', color: '#000000' },
  inputHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px', color: '#000000' },
  textarea: { width: '100%', height: '100px', padding: '12px', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s', color: '#0000FF' },
  timerSection: { textAlign: 'center', margin: '15px 0' },
  timerLabel: { fontSize: '0.7rem', fontWeight: 'bold', color: '#000000' },
  timerDisplay: { fontSize: '1.6rem', fontWeight: 'bold', color: '#000000' },
  submitBtn: { width: '100%', padding: '0.8rem', background: '#000000', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem' },
  tipsBox: { background: '#f1f5f9', padding: '0.8rem', borderRadius: '8px', marginTop: '1.2rem' },
  tipsList: { listStyle: 'none', padding: 0, fontSize: '0.8rem', margin: 0, color: '#000000' }
};

export default PromptCreator;