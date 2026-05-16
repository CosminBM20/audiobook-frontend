'use client';
import { useEffect, useRef, useState } from 'react';

import { API_URL } from '@/lib/api';

export default function AudioPlayer({ bookId, audioUrl }: { bookId: string, audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [startPosition, setStartPosition] = useState<number>(0);

  useEffect(() => {
    const loadProgress = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        // ADAUGĂM cache: 'no-store' pentru a nu lăsa browserul să ne dea date vechi!
        const res = await fetch(`${API_URL}/api/audiobooks/progress/${bookId}`, {
          cache: 'no-store',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
          }
        });
        
        const data = await res.json();
        
        // Acest mesaj trebuie să apară garantat la fiecare refresh!
        console.log("Răspuns de la server la refresh:", data); 

        if (data.success && data.lastPosition > 0) {
          setStartPosition(data.lastPosition);
          
          if (audioRef.current && audioRef.current.readyState >= 1) {
            audioRef.current.currentTime = data.lastPosition;
            console.log(`Am sărit direct la: ${data.lastPosition}`);
          }
        }
      } catch (err) {
        console.error("Eroare la fetch progres:", err);
      }
    };

    loadProgress();
  }, [bookId]);

  const handleLoadedMetadata = () => {
    if (audioRef.current && startPosition > 0) {
      audioRef.current.currentTime = startPosition;
      console.log(`Fișier audio gata! Am sărit la: ${startPosition}`);
    }
  };

  const handlePause = async (e: any) => {
    const currentTime = Math.floor(e.target.currentTime);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/audiobooks/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ audiobookId: bookId, currentPosition: currentTime })
      });
      
      const data = await res.json();
      
      // Afișăm RĂSPUNSUL REAL de la server!
      console.log("Răspuns real la salvare:", data);
      
    } catch (err) {
      console.error("Eroare severă la salvare:", err);
    }
  };

  return (
    <div className="bg-gray-900 p-6 rounded-2xl shadow-inner w-full">
      <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-widest text-center">
        Redare în curs
      </h3>
      <audio
        ref={audioRef}
        controls
        onPause={handlePause}
        onLoadedMetadata={handleLoadedMetadata}
        className="w-full rounded-lg shadow-lg outline-none"
        src={audioUrl}
      >
        Browser-ul tău nu suportă redarea audio.
      </audio>
    </div>
  );
}