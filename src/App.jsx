import { useState, useEffect } from 'react';

const STRUCTURES = [
  { label: 'Classic Pop', value: 'Verse → Chorus → Verse → Chorus → Bridge → Chorus' },
  { label: 'Folk Ballad', value: 'Verse → Verse → Chorus → Verse → Chorus' },
  { label: 'Modern Pop', value: 'Verse → Pre-Chorus → Chorus → Verse → Pre-Chorus → Chorus → Bridge → Chorus' },
  { label: 'Full Arrangement', value: 'Intro → Verse → Chorus → Verse → Chorus → Bridge → Chorus → Outro' },
  { label: 'Anthem', value: 'Verse → Chorus → Verse → Chorus → Guitar Solo → Bridge → Final Chorus' },
  { label: 'Let It Flow', value: 'unstructured — let it breathe' },
];

const GENRE_CHIPS = ['indie folk', 'synthwave', 'lo-fi hip hop', 'dream pop', 'bedroom pop', 'alt rock', 'neo-soul', 'country', 'punk', 'trap', 'ambient', 'gospel'];
const MOOD_CHIPS = ['melancholic', 'defiant', 'dreamy', 'tender', 'anxious', 'hopeful', 'raw', 'longing', 'swaggering', 'joyful', 'haunting', 'euphoric'];

const LOADING_PHRASES = [
  'tuning the instrument',
  'finding the first line',
  'humming through the bridge',
  'pressing the master',
];

function Equaliser({ active }) {
  const bars = [0.5, 0.8, 0.3, 0.95, 0.6, 0.4, 0.75, 0.55, 0.85, 0.3, 0.7, 0.5];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '24px' }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: '3px',
            background: 'var(--orange)',
            height: `${h * 100}%`,
            borderRadius: '1px',
            animation: active ? `eq-pulse ${0.7 + (i % 4) * 0.18}s ease-in-out ${i * 0.05}s infinite alternate` : 'none',
            opacity: active ? 1 : 0.35,
            transition: 'opacity 0.4s ease',
          }}
        />
      ))}
    </div>
  );
}

export default function SunoLyricsCreator() {
  const [theme, setTheme] = useState('');
  const [genre, setGenre] = useState('');
  const [mood, setMood] = useState('');
  const [structure, setStructure] = useState(STRUCTURES[0].value);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState(LOADING_PHRASES[0]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copiedLyrics, setCopiedLyrics] = useState(false);
  const [copiedStyle, setCopiedStyle] = useState(false);

  useEffect(() => {
    if (!loading) return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_PHRASES.length;
      setLoadingPhrase(LOADING_PHRASES[i]);
    }, 1400);
    return () => clearInterval(interval);
  }, [loading]);

  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const generate = async () => {
    if (!theme.trim()) {
      setError("Give it a subject first — what's the song about?");
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, genre, mood, structure, notes }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || 'Network');
      }
      const parsed = await response.json();
      setResult(parsed);
    } catch (e) {
      console.error(e);
      setError('Hit a snag. Try generating again.');
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text, which) => {
    navigator.clipboard.writeText(text);
    if (which === 'lyrics') {
      setCopiedLyrics(true);
      setTimeout(() => setCopiedLyrics(false), 1800);
    } else {
      setCopiedStyle(true);
      setTimeout(() => setCopiedStyle(false), 1800);
    }
  };

  const reset = () => {
    setResult(null);
    setError('');
  };

  const renderLyrics = (lyrics) => {
    if (!lyrics) return null;
    return lyrics.split('\n').map((line, i) => {
      const trimmed = line.trim();
      const isTag = /^\[.+\]$/.test(trimmed);
      if (isTag) {
        return (
          <div key={i} style={{
            marginTop: i === 0 ? 0 : '1.5rem',
            marginBottom: '0.65rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.7rem',
          }}>
            <span style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.7rem',
              letterSpacing: '0.18em',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: 'var(--cream)',
              background: 'var(--orange)',
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              display: 'inline-block',
            }}>
              {trimmed.replace(/[\[\]]/g, '')}
            </span>
            <span style={{ flex: 1, height: '1px', background: 'var(--dark)', opacity: 0.1 }} />
          </div>
        );
      }
      if (trimmed === '') return <div key={i} style={{ height: '0.4rem' }} />;
      return (
        <div key={i} style={{
          fontFamily: "'Lora', Georgia, serif",
          fontSize: '1.12rem',
          lineHeight: 1.6,
          color: 'var(--dark)',
          letterSpacing: '-0.005em',
        }}>
          {line}
        </div>
      );
    });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&display=swap');

        :root {
          --dark: #141413;
          --cream: #faf9f5;
          --cream-deep: #f3f1e8;
          --mid: #b0aea5;
          --light-gray: #e8e6dc;
          --orange: #d97757;
          --orange-soft: #e89478;
          --orange-deep: #b85e42;
          --blue: #6a9bcc;
          --green: #788c5d;
        }

        * { box-sizing: border-box; }

        .slc-root {
          font-family: 'Lora', Georgia, serif;
          color: var(--dark);
          background: var(--cream);
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
        }

        .slc-root::before {
          content: '';
          position: absolute;
          top: -200px;
          right: -200px;
          width: 700px;
          height: 700px;
          background: radial-gradient(circle, rgba(217, 119, 87, 0.18) 0%, rgba(217, 119, 87, 0) 65%);
          pointer-events: none;
          z-index: 0;
        }
        .slc-root::after {
          content: '';
          position: absolute;
          top: 600px;
          left: -300px;
          width: 800px;
          height: 800px;
          background: radial-gradient(circle, rgba(106, 155, 204, 0.1) 0%, rgba(106, 155, 204, 0) 60%);
          pointer-events: none;
          z-index: 0;
        }

        .slc-content {
          position: relative;
          z-index: 2;
          max-width: 920px;
          margin: 0 auto;
          padding: 2rem 1.5rem 5rem;
        }

        h1, h2, h3, h4 {
          font-family: 'Poppins', sans-serif;
          font-weight: 700;
          letter-spacing: -0.025em;
          margin: 0;
        }

        .header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 1.5rem;
          margin-bottom: 3rem;
          border-bottom: 1px solid var(--light-gray);
        }

        .wordmark {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-family: 'Poppins', sans-serif;
          font-weight: 700;
          font-size: 0.95rem;
          letter-spacing: -0.01em;
          color: var(--dark);
        }

        .logo-mark {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--orange);
          position: relative;
          flex-shrink: 0;
        }
        .logo-mark::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 10px;
          height: 10px;
          background: var(--cream);
          border-radius: 50%;
          transform: translate(-50%, -50%);
        }

        .header-meta {
          font-family: 'Poppins', sans-serif;
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--mid);
          font-weight: 500;
        }

        .hero {
          margin-bottom: 3.5rem;
          position: relative;
        }

        .hero-eyebrow {
          font-family: 'Poppins', sans-serif;
          font-size: 0.78rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--orange);
          font-weight: 600;
          margin-bottom: 1.2rem;
          display: flex;
          align-items: center;
          gap: 0.7rem;
        }

        .hero-eyebrow::before {
          content: '';
          width: 28px;
          height: 1.5px;
          background: var(--orange);
        }

        .hero-title {
          font-size: clamp(2.6rem, 7vw, 5rem);
          line-height: 0.98;
          margin-bottom: 1.4rem;
          color: var(--dark);
          font-weight: 700;
        }

        .hero-title em {
          font-style: italic;
          font-weight: 600;
          color: var(--orange);
          font-family: 'Lora', Georgia, serif;
          letter-spacing: -0.02em;
        }

        .hero-sub {
          font-family: 'Lora', Georgia, serif;
          font-size: 1.2rem;
          line-height: 1.55;
          color: var(--dark);
          opacity: 0.7;
          max-width: 580px;
          margin-bottom: 1.8rem;
        }

        .step-num {
          font-family: 'Poppins', sans-serif;
          font-weight: 600;
          font-size: 0.72rem;
          letter-spacing: 0.15em;
          color: var(--orange);
          text-transform: uppercase;
        }

        .step-title {
          font-family: 'Poppins', sans-serif;
          font-weight: 600;
          font-size: 1.05rem;
          color: var(--dark);
          letter-spacing: -0.01em;
          margin-top: 0.2rem;
        }

        .step-hint {
          font-family: 'Lora', Georgia, serif;
          font-style: italic;
          font-size: 0.9rem;
          color: var(--mid);
        }

        .step-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 1rem;
          gap: 1rem;
        }

        section.step { margin-bottom: 2.4rem; }

        .field-input {
          font-family: 'Lora', Georgia, serif;
          font-size: 1.15rem;
          background: transparent;
          border: none;
          border-bottom: 1.5px solid var(--dark);
          color: var(--dark);
          padding: 0.5rem 0;
          width: 100%;
          outline: none;
          transition: border-color 0.25s;
        }
        .field-input:focus { border-bottom-color: var(--orange); }
        .field-input::placeholder { color: var(--mid); font-style: italic; }

        .field-textarea {
          font-family: 'Lora', Georgia, serif;
          font-size: 1.08rem;
          background: var(--cream);
          border: 1.5px solid var(--light-gray);
          border-radius: 14px;
          color: var(--dark);
          padding: 0.95rem 1.1rem;
          width: 100%;
          outline: none;
          resize: vertical;
          line-height: 1.55;
          transition: all 0.25s;
        }
        .field-textarea:focus {
          border-color: var(--orange);
          background: #fffdf7;
          box-shadow: 0 0 0 4px rgba(217, 119, 87, 0.08);
        }
        .field-textarea::placeholder { color: var(--mid); font-style: italic; }

        .surprise-btn {
          font-family: 'Poppins', sans-serif;
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          background: transparent;
          border: none;
          color: var(--orange);
          cursor: pointer;
          font-weight: 600;
          padding: 0.3rem 0.6rem;
          border-radius: 999px;
          transition: background 0.2s;
        }
        .surprise-btn:hover { background: rgba(217, 119, 87, 0.1); }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .chip {
          font-family: 'Poppins', sans-serif;
          font-size: 0.82rem;
          font-weight: 500;
          padding: 0.45rem 0.95rem;
          border: 1.5px solid var(--light-gray);
          background: var(--cream);
          color: var(--dark);
          cursor: pointer;
          border-radius: 999px;
          transition: all 0.2s ease;
        }
        .chip:hover {
          border-color: var(--dark);
          transform: translateY(-1px);
        }
        .chip.active {
          background: var(--dark);
          color: var(--cream);
          border-color: var(--dark);
        }

        .structure-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
          gap: 0.6rem;
        }

        .structure-card {
          font-family: 'Lora', Georgia, serif;
          padding: 0.85rem 1rem;
          border: 1.5px solid var(--light-gray);
          background: var(--cream);
          border-radius: 14px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          color: var(--dark);
        }
        .structure-card:hover {
          border-color: var(--dark);
          transform: translateY(-1px);
        }
        .structure-card.active {
          background: var(--dark);
          color: var(--cream);
          border-color: var(--dark);
        }
        .structure-card .s-label {
          font-family: 'Poppins', sans-serif;
          font-size: 0.7rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 600;
          color: var(--orange);
        }
        .structure-card.active .s-label { color: var(--orange-soft); }
        .structure-card .s-value {
          font-size: 0.92rem;
          line-height: 1.35;
        }

        .generate-block {
          margin-top: 2.5rem;
          padding: 2rem;
          background: var(--dark);
          border-radius: 20px;
          color: var(--cream);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          flex-wrap: wrap;
          position: relative;
          overflow: hidden;
        }
        .generate-block::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -10%;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(217, 119, 87, 0.35) 0%, transparent 60%);
          pointer-events: none;
        }
        .generate-block-text {
          position: relative;
          z-index: 2;
          flex: 1;
          min-width: 200px;
        }
        .generate-block-text h3 {
          font-family: 'Poppins', sans-serif;
          font-size: 1.6rem;
          font-weight: 700;
          margin-bottom: 0.3rem;
          color: var(--cream);
        }
        .generate-block-text p {
          font-family: 'Lora', Georgia, serif;
          font-style: italic;
          color: var(--mid);
          font-size: 0.98rem;
          margin: 0;
        }

        .btn-primary {
          font-family: 'Poppins', sans-serif;
          font-weight: 600;
          font-size: 1.02rem;
          background: var(--orange);
          color: var(--cream);
          border: none;
          padding: 1rem 1.7rem;
          cursor: pointer;
          letter-spacing: -0.005em;
          transition: all 0.2s ease;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          position: relative;
          z-index: 2;
          box-shadow: 0 4px 20px rgba(217, 119, 87, 0.35);
        }
        .btn-primary:hover:not(:disabled) {
          background: var(--orange-soft);
          transform: translateY(-2px);
          box-shadow: 0 6px 28px rgba(217, 119, 87, 0.5);
        }
        .btn-primary:disabled { opacity: 0.7; cursor: wait; }
        .btn-primary svg { transition: transform 0.2s ease; }
        .btn-primary:hover:not(:disabled) svg { transform: translateX(3px); }

        .btn-ghost {
          font-family: 'Poppins', sans-serif;
          font-size: 0.85rem;
          font-weight: 500;
          background: var(--cream);
          color: var(--dark);
          border: 1.5px solid var(--light-gray);
          padding: 0.6rem 1.1rem;
          cursor: pointer;
          border-radius: 999px;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
        }
        .btn-ghost:hover {
          border-color: var(--dark);
          background: var(--cream-deep);
        }
        .btn-ghost.copied {
          background: var(--green);
          border-color: var(--green);
          color: var(--cream);
        }

        .error-msg {
          margin-top: 1.2rem;
          padding: 0.85rem 1.1rem;
          background: rgba(217, 119, 87, 0.1);
          border: 1px solid var(--orange);
          color: var(--orange-deep);
          border-radius: 12px;
          font-family: 'Lora', Georgia, serif;
          font-style: italic;
        }

        .loading-block {
          margin-top: 1.8rem;
          padding: 2.2rem 1.5rem;
          text-align: center;
          background: var(--cream-deep);
          border-radius: 16px;
          border: 1px dashed var(--mid);
        }

        .loading-text {
          font-family: 'Lora', Georgia, serif;
          font-style: italic;
          font-size: 1.1rem;
          color: var(--dark);
          margin-top: 1rem;
        }

        .wave-loader {
          display: flex;
          justify-content: center;
          gap: 5px;
          align-items: center;
          height: 50px;
        }
        .wave-loader span {
          width: 4px;
          background: var(--orange);
          border-radius: 2px;
          animation: wave 1.2s ease-in-out infinite;
        }
        .wave-loader span:nth-child(1) { animation-delay: 0s; }
        .wave-loader span:nth-child(2) { animation-delay: 0.1s; }
        .wave-loader span:nth-child(3) { animation-delay: 0.2s; }
        .wave-loader span:nth-child(4) { animation-delay: 0.3s; }
        .wave-loader span:nth-child(5) { animation-delay: 0.4s; }
        .wave-loader span:nth-child(6) { animation-delay: 0.5s; }
        .wave-loader span:nth-child(7) { animation-delay: 0.6s; }

        @keyframes wave {
          0%, 100% { height: 8px; }
          50% { height: 40px; }
        }

        @keyframes eq-pulse {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }

        .release-card {
          background: var(--cream);
          border: 1px solid var(--light-gray);
          border-radius: 24px;
          padding: 2.5rem;
          margin-bottom: 1.2rem;
          position: relative;
          overflow: hidden;
        }
        .release-card.dark {
          background: var(--dark);
          color: var(--cream);
          border-color: var(--dark);
        }
        .release-card.dark .release-card-label { color: var(--orange-soft); }

        .release-card-label {
          font-family: 'Poppins', sans-serif;
          font-size: 0.72rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 600;
          color: var(--orange);
          margin-bottom: 0.6rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .release-title {
          font-family: 'Poppins', sans-serif;
          font-size: clamp(2rem, 5vw, 3.4rem);
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.03em;
          margin-bottom: 0.5rem;
        }

        .release-meta {
          font-family: 'Lora', Georgia, serif;
          font-style: italic;
          color: var(--mid);
          font-size: 1rem;
        }

        .style-prompt-text {
          font-family: 'Poppins', sans-serif;
          font-size: 1rem;
          line-height: 1.6;
          font-weight: 400;
          color: var(--cream);
          margin: 1rem 0 1.4rem;
        }

        .fade-in {
          animation: fade-in 0.6s ease-out both;
        }
        .fade-in-delay-1 { animation-delay: 0.1s; }
        .fade-in-delay-2 { animation-delay: 0.2s; }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .disc {
          position: absolute;
          top: -60px;
          right: -60px;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: var(--orange);
          opacity: 0.13;
          animation: spin 20s linear infinite;
        }
        .disc::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 30%;
          height: 30%;
          border-radius: 50%;
          background: var(--cream);
          transform: translate(-50%, -50%);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .action-row {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
          align-items: center;
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--light-gray);
        }

        .dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          background: var(--orange);
          border-radius: 50%;
        }

        .footer-note {
          text-align: center;
          margin-top: 2.5rem;
          font-family: 'Lora', Georgia, serif;
          font-style: italic;
          font-size: 0.98rem;
          color: var(--mid);
          line-height: 1.7;
        }
        .footer-note strong {
          font-family: 'Poppins', sans-serif;
          font-style: normal;
          font-size: 0.78rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--orange);
          font-weight: 600;
          padding: 0.2rem 0.55rem;
          background: rgba(217, 119, 87, 0.12);
          border-radius: 6px;
          margin: 0 0.15rem;
        }

        .footer-bar {
          margin-top: 4rem;
          padding-top: 2rem;
          border-top: 1px solid var(--light-gray);
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: 'Poppins', sans-serif;
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--mid);
          font-weight: 500;
          flex-wrap: wrap;
          gap: 0.6rem;
        }

        .heart-dot {
          width: 6px; height: 6px;
          background: var(--orange);
          border-radius: 50%;
          display: inline-block;
          margin: 0 0.55rem;
          vertical-align: middle;
        }

        @media (max-width: 640px) {
          .release-card { padding: 1.6rem 1.3rem; }
          .generate-block { padding: 1.4rem; }
          .step-header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="slc-root">
        <div className="slc-content">

          <div className="header-bar">
            <div className="wordmark">
              <div className="logo-mark" />
              <span>Lyric Foundry</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Equaliser active={loading} />
              <span className="header-meta">For Suno · v1</span>
            </div>
          </div>

          {!result && (
            <>
              <section className="hero fade-in">
                <div className="hero-eyebrow">A small workshop for songs</div>
                <h1 className="hero-title">
                  Write a song you<br/>haven't <em>heard yet.</em>
                </h1>
                <p className="hero-sub">
                  Tell it what the song is about. Pick a feeling, a sound, a shape.
                  Get lyrics formatted for Suno — section tags, style prompt, the lot.
                </p>
              </section>

              <section className="step fade-in fade-in-delay-1">
                <div className="step-header">
                  <div>
                    <div className="step-num">01 · The Subject</div>
                    <div className="step-title">What is this song about?</div>
                  </div>
                  <div className="step-hint">required</div>
                </div>
                <textarea
                  className="field-textarea"
                  rows={3}
                  placeholder="A late drive home from a wedding you weren't invited to. The way the cat sleeps in the sun. The exact moment a friendship ended."
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                />
              </section>

              <section className="step fade-in fade-in-delay-2">
                <div className="step-header">
                  <div>
                    <div className="step-num">02 · Genre</div>
                    <div className="step-title">Pick a sonic neighbourhood</div>
                  </div>
                  <button onClick={() => setGenre(pickRandom(GENRE_CHIPS))} className="surprise-btn">
                    ✦ surprise me
                  </button>
                </div>
                <input
                  type="text"
                  className="field-input"
                  placeholder="type or pick one below…"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                />
                <div className="chips">
                  {GENRE_CHIPS.map(g => (
                    <button
                      key={g}
                      className={`chip ${genre === g ? 'active' : ''}`}
                      onClick={() => setGenre(genre === g ? '' : g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </section>

              <section className="step">
                <div className="step-header">
                  <div>
                    <div className="step-num">03 · Mood</div>
                    <div className="step-title">How should it feel?</div>
                  </div>
                  <button onClick={() => setMood(pickRandom(MOOD_CHIPS))} className="surprise-btn">
                    ✦ surprise me
                  </button>
                </div>
                <input
                  type="text"
                  className="field-input"
                  placeholder="describe it in a word or two…"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                />
                <div className="chips">
                  {MOOD_CHIPS.map(m => (
                    <button
                      key={m}
                      className={`chip ${mood === m ? 'active' : ''}`}
                      onClick={() => setMood(mood === m ? '' : m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </section>

              <section className="step">
                <div className="step-header">
                  <div>
                    <div className="step-num">04 · Structure</div>
                    <div className="step-title">Choose the song's shape</div>
                  </div>
                </div>
                <div className="structure-grid">
                  {STRUCTURES.map(s => (
                    <button
                      key={s.label}
                      className={`structure-card ${structure === s.value ? 'active' : ''}`}
                      onClick={() => setStructure(s.value)}
                    >
                      <span className="s-label">{s.label}</span>
                      <span className="s-value">{s.value}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="step">
                <div className="step-header">
                  <div>
                    <div className="step-num">05 · Direction</div>
                    <div className="step-title">
                      Anything else?{' '}
                      <span style={{ color: 'var(--mid)', fontWeight: 400, fontStyle: 'italic', fontFamily: "'Lora', Georgia, serif" }}>
                        (optional)
                      </span>
                    </div>
                  </div>
                </div>
                <textarea
                  className="field-textarea"
                  rows={2}
                  placeholder="vocal style, rhyme scheme, specific lines or images, things to avoid…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </section>

              <div className="generate-block">
                <div className="generate-block-text">
                  <h3>Press the lever.</h3>
                  <p>Claude writes the lyrics. You take them to Suno.</p>
                </div>
                <button
                  className="btn-primary"
                  onClick={generate}
                  disabled={loading}
                >
                  {loading ? 'Composing…' : 'Generate Song'}
                  {!loading && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  )}
                </button>
              </div>

              {error && <div className="error-msg">{error}</div>}

              {loading && (
                <div className="loading-block">
                  <div className="wave-loader">
                    <span/><span/><span/><span/><span/><span/><span/>
                  </div>
                  <div className="loading-text">{loadingPhrase}…</div>
                </div>
              )}
            </>
          )}

          {result && (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.4rem',
                flexWrap: 'wrap',
                gap: '0.8rem',
              }}>
                <div className="step-num">↳ Fresh from the press</div>
                <button className="btn-ghost" onClick={reset}>← Start over</button>
              </div>

              <div className="release-card fade-in">
                <div className="disc" />
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div className="release-card-label">
                    <span className="dot" />
                    Single · Untitled Project
                  </div>
                  <h2 className="release-title">{result.title}</h2>
                  <div className="release-meta">
                    Written by Claude · {genre || 'open genre'}
                    {mood && ` · ${mood}`}
                  </div>
                </div>
              </div>

              <div className="release-card dark fade-in fade-in-delay-1">
                <div className="release-card-label">
                  <span className="dot" />
                  Style of Music — paste into Suno
                </div>
                <div className="style-prompt-text">{result.stylePrompt}</div>
                <button
                  className="btn-ghost"
                  onClick={() => copyText(result.stylePrompt, 'style')}
                  style={{
                    background: copiedStyle ? 'var(--green)' : 'var(--cream)',
                    color: copiedStyle ? 'var(--cream)' : 'var(--dark)',
                    borderColor: copiedStyle ? 'var(--green)' : 'var(--light-gray)',
                  }}
                >
                  {copiedStyle ? '✓ Copied' : 'Copy style prompt'}
                </button>
              </div>

              <div className="release-card fade-in fade-in-delay-2">
                <div className="release-card-label">
                  <span className="dot" />
                  Lyrics — paste into Suno's main field
                </div>
                <div style={{ marginTop: '1.2rem' }}>
                  {renderLyrics(result.lyrics)}
                </div>
                <div className="action-row">
                  <button
                    className={`btn-ghost ${copiedLyrics ? 'copied' : ''}`}
                    onClick={() => copyText(result.lyrics, 'lyrics')}
                  >
                    {copiedLyrics ? '✓ Copied' : 'Copy lyrics'}
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={generate}
                    disabled={loading}
                  >
                    {loading ? 'Re-composing…' : '↻ Regenerate'}
                  </button>
                </div>
              </div>

              <div className="footer-note">
                Drop the lyrics into Suno's main field, the style prompt into <strong>Style of Music</strong>,<br/>
                and the title becomes your song name.
              </div>
            </>
          )}

          <div className="footer-bar">
            <span>Lyric Foundry</span>
            <span>Words by Claude<span className="heart-dot" />Songs by you</span>
            <span>Pretoria · {new Date().getFullYear()}</span>
          </div>

        </div>
      </div>
    </>
  );
}
