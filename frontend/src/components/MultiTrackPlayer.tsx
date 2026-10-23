"use client";
import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, VolumeX, Download, Loader2 } from 'lucide-react';
import axios from 'axios';

interface StemFiles {
  [key: string]: string;
}

export default function MultiTrackPlayer({ stems }: { stems: StemFiles }) {
  const containerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const wavesurfers = useRef<{ [key: string]: WaveSurfer }>({});
  
  const audioCtx = useRef<AudioContext | null>(null);
  const panners = useRef<{ [key: string]: StereoPannerNode }>({});

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [volumes, setVolumes] = useState<{ [key: string]: number }>({});
  const [mutes, setMutes] = useState<{ [key: string]: boolean }>({});
  const [solos, setSolos] = useState<{ [key: string]: boolean }>({});
  const [pans, setPans] = useState<{ [key: string]: number }>({});

  const [exportFormat, setExportFormat] = useState('wav');
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let loadedCount = 0;
    const totalStems = Object.keys(stems).length;

    if (!audioCtx.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx.current = new AudioContextClass();
    }

    Object.entries(stems).forEach(([name, path], index) => {
      const url = `http://localhost:8000/audio/${path.split('separated\\')[1] || path.split('separated/')[1]}`;
      
      const audio = new Audio();
      audio.crossOrigin = "anonymous";

      const ws = WaveSurfer.create({
        container: containerRefs.current[name]!,
        media: audio,
        waveColor: name === 'vocals' ? '#6366f1' : name === 'drums' ? '#14b8a6' : name === 'bass' ? '#0ea5e9' : '#8b5cf6',
        progressColor: name === 'vocals' ? '#a5b4fc' : name === 'drums' ? '#5eead4' : name === 'bass' ? '#7dd3fc' : '#c4b5fd',
        height: 64,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        interact: false,
        sampleRate: 8000, 
      });

      try {
        const source = audioCtx.current!.createMediaElementSource(audio);
        const panner = audioCtx.current!.createStereoPanner();
        source.connect(panner);
        panner.connect(audioCtx.current!.destination);
        panners.current[name] = panner;
      } catch (err) {
        console.error("Erro ao rotear o nó de áudio (Panner):", err);
      }

      ws.load(url);
      
      ws.on('ready', () => {
        loadedCount++;
        if (loadedCount === 1) setDuration(ws.getDuration());
        if (loadedCount === totalStems) setIsReady(true);
      });

      ws.on('finish', () => setIsPlaying(false));
      
      if (index === 0) {
        ws.on('timeupdate', (time) => setCurrentTime(time));
      }

      wavesurfers.current[name] = ws;
      setVolumes(prev => ({ ...prev, [name]: 1 }));
      setMutes(prev => ({ ...prev, [name]: false }));
      setSolos(prev => ({ ...prev, [name]: false }));
      setPans(prev => ({ ...prev, [name]: 0 }));
    });

    return () => {
      Object.values(wavesurfers.current).forEach(ws => ws.destroy());
      if (audioCtx.current && audioCtx.current.state !== 'closed') {
        audioCtx.current.close();
        audioCtx.current = null;
      }
    };
  }, [stems]);

  useEffect(() => {
    Object.keys(stems).forEach(name => {
      const panner = panners.current[name];
      if (panner) {
        panner.pan.value = pans[name] ?? 0;
      }
    });
  }, [pans, stems]);

  useEffect(() => {
    const isAnySolo = Object.values(solos).some(v => v);
    Object.keys(stems).forEach(name => {
      const ws = wavesurfers.current[name];
      if (!ws) return;
      let targetVolume = volumes[name] ?? 1;
      if (mutes[name]) targetVolume = 0;
      else if (isAnySolo && !solos[name]) targetVolume = 0;
      ws.setVolume(targetVolume);
    });
  }, [volumes, mutes, solos, stems]);

  const togglePlay = () => {
    if (audioCtx.current && audioCtx.current.state === 'suspended') {
      audioCtx.current.resume();
    }
    Object.values(wavesurfers.current).forEach(ws => isPlaying ? ws.pause() : ws.play());
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    Object.values(wavesurfers.current).forEach(ws => ws.setTime(time));
    setCurrentTime(time);
  };

  const handleVolume = (name: string, val: number) => setVolumes(prev => ({ ...prev, [name]: val }));
  const handlePan = (name: string, val: number) => setPans(prev => ({ ...prev, [name]: val }));
  const toggleMute = (name: string) => setMutes(prev => ({ ...prev, [name]: !prev[name] }));
  const toggleSolo = (name: string) => setSolos(prev => ({ ...prev, [name]: !prev[name] }));

  const handleDownload = async (trackName?: string) => {
    setIsDownloading(trackName || 'mix');
    const isAnySolo = Object.values(solos).some(v => v);
    const reqMutes: { [key: string]: boolean } = {};
    const reqVolumes = { ...volumes };

    if (trackName) {
      Object.keys(stems).forEach(k => {
        reqMutes[k] = (k !== trackName);
        if (k === trackName) reqVolumes[k] = 1.0;
      });
    } else {
      Object.keys(stems).forEach(k => {
        reqMutes[k] = mutes[k] || (isAnySolo && !solos[k]);
      });
    }

    try {
      const res = await axios.post('http://localhost:8000/api/download', {
        stems, volumes: reqVolumes, mutes: reqMutes, pans, format: exportFormat
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${trackName || 'Custom_Mix'}.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert("Erro ao exportar. Verifique o console do backend.");
    } finally {
      setIsDownloading(null);
    }
  };

  return (
    <div className="bg-[#09090b] text-zinc-100 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/60 font-sans backdrop-blur-xl">
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-zinc-900/50 p-5 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100">Studio Mix Console</h2>
        </div>
        
        <div className="flex items-center gap-3 bg-zinc-950 p-1.5 rounded-lg border border-zinc-800">
          <select 
            value={exportFormat} 
            onChange={(e) => setExportFormat(e.target.value)}
            className="bg-transparent text-zinc-300 text-sm px-3 py-1.5 outline-none cursor-pointer font-medium"
          >
            <option value="wav" className="bg-zinc-900 text-zinc-300">.WAV</option>
            <option value="flac" className="bg-zinc-900 text-zinc-300">.FLAC</option>
            <option value="mp3" className="bg-zinc-900 text-zinc-300">.MP3</option>
          </select>

          <div className="w-px h-6 bg-zinc-800 mx-1"></div>

          <button 
            onClick={() => handleDownload()}
            disabled={!isReady || isDownloading !== null}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 text-sm rounded-md font-semibold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {isDownloading === 'mix' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Exportar Mix
          </button>
        </div>
      </div>

      <div className="p-5 space-y-2.5 bg-gradient-to-b from-zinc-950 to-[#09090b]">
        {Object.keys(stems).map((name) => (
          <div key={name} className="group flex flex-col md:flex-row items-stretch gap-0 rounded-xl overflow-hidden border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 transition-colors">
            
            <div className="w-full md:w-[280px] p-4 flex flex-col justify-between border-b md:border-b-0 md:border-r border-zinc-800/50 backdrop-blur-md">
              
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-sm tracking-widest uppercase text-zinc-300">{name}</span>
                <button 
                  onClick={() => handleDownload(name)}
                  disabled={isDownloading !== null}
                  title="Baixar faixa isolada"
                  className="text-zinc-500 hover:text-emerald-400 transition-colors disabled:opacity-50"
                >
                  {isDownloading === name ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <button 
                  onClick={() => toggleMute(name)}
                  className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-md transition-all duration-200 ${mutes[name] ? 'bg-red-500/20 text-red-500 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-transparent'}`}
                >
                  M
                </button>
                <button 
                  onClick={() => toggleSolo(name)}
                  className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-md transition-all duration-200 ${solos[name] ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-transparent'}`}
                >
                  S
                </button>
                
                <div className="ml-auto flex flex-col items-center group/pan">
                  <span className="text-[9px] text-zinc-600 font-bold tracking-widest mb-1 group-hover/pan:text-zinc-400 transition-colors">PAN</span>
                  <input 
                    type="range" min="-1" max="1" step="0.1" 
                    value={pans[name] ?? 0} 
                    onChange={(e) => handlePan(name, parseFloat(e.target.value))}
                    onDoubleClick={() => handlePan(name, 0)}
                    title="Duplo clique para centralizar"
                    className="w-16 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-zinc-400 [&::-webkit-slider-thumb]:rounded-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Volume2 size={14} className={mutes[name] || (Object.values(solos).some(v=>v) && !solos[name]) ? 'text-zinc-700' : 'text-zinc-400'} />
                <input 
                  type="range" min="0" max="1" step="0.01" 
                  value={volumes[name] ?? 1} 
                  onChange={(e) => handleVolume(name, parseFloat(e.target.value))}
                  onDoubleClick={() => handleVolume(name, 1)}
                  title="Duplo clique para retornar ao 100%"
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-sm hover:[&::-webkit-slider-thumb]:bg-indigo-400"
                />
              </div>

            </div>

            <div 
              className={`flex-1 relative transition-opacity duration-300 ${mutes[name] || (Object.values(solos).some(v=>v) && !solos[name]) ? 'opacity-30 grayscale' : 'opacity-100'}`} 
              ref={el => { containerRefs.current[name] = el; }} 
            />
          </div>
        ))}
      </div>

      <div className="bg-zinc-950 p-5 flex flex-col items-center justify-center gap-4 relative z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-6">
          <button onClick={() => handleSeek(0)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
          </button>
          
          <button 
            onClick={togglePlay}
            disabled={!isReady}
            className="w-14 h-14 flex items-center justify-center bg-zinc-100 text-zinc-950 rounded-full hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-50 disabled:hover:scale-100"
          >
            {isPlaying ? <Pause fill="currentColor" size={24} /> : <Play fill="currentColor" size={24} className="ml-1.5" />}
          </button>
        </div>

        <div className="flex items-center gap-4 w-full max-w-3xl">
          <span className="w-12 text-right text-xs font-mono text-zinc-400">{formatTime(currentTime)}</span>
          <div className="relative flex-1 flex items-center">
             <input 
              type="range" min="0" max={duration || 100} step="0.01" 
              value={currentTime} 
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
            />
            <div 
              className="absolute left-0 h-2 bg-indigo-500 rounded-l-lg pointer-events-none" 
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <span className="w-12 text-left text-xs font-mono text-zinc-500">{formatTime(duration)}</span>
        </div>
      </div>

    </div>
  );
}