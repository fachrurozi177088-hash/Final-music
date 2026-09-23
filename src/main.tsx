import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  const audio = useRef<HTMLAudioElement | null>(null);
  return <div>GameWave Music</div>;
}

createRoot(document.getElementById('root')!).render(<App />);
