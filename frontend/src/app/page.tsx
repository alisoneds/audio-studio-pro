"use client";
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MultiTrackPlayer from '@/components/MultiTrackPlayer';
import { UploadCloud, Loader2, Music, Sparkles, FileAudio } from 'lucide-react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'ready'>('idle');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [stems, setStems] = useState<any>(null);
  
  // Novo estado para controlar o efeito visual do Drag & Drop
  const [isDragging, setIsDragging] = useState(false);

  // Funções do Drag & Drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      // Verifica se é um arquivo de áudio antes de aceitar
      if (droppedFile.type.startsWith('audio/')) {
        setFile(droppedFile);
      } else {
        alert("Por favor, solte apenas arquivos de áudio válidos (MP3, WAV, FLAC).");
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/upload`, formData);
      setTaskId(res.data.task_id);
      setStatus('processing');
    } catch (error: any) {
      console.error(error);
      alert('Erro no upload. O backend no Colab está rodando e a URL está correta?');
      setStatus('idle');
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (status === 'processing' && taskId) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/status/${taskId}`);
          if (res.data.status === 'Concluído') {
            setStems(res.data.data.stems);
            setStatus('ready');
            clearInterval(interval);
          } else if (res.data.status === 'Falhou') {
            alert('Erro no processamento da IA.');
            setStatus('idle');
            clearInterval(interval);
          }
        } catch (e) {
          console.error(e);
        }
      }, 3000);
    }

    return () => clearInterval(interval);
  }, [status, taskId]);

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-6 md:p-12 font-sans selection:bg-indigo-500/30">
      
      {/* Background Decorativo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-6xl mx-auto space-y-12 relative z-10">
        
        <header className="text-center space-y-6 pt-8 pb-4">
          <div className="inline-flex items-center justify-center p-3 bg-zinc-900/80 border border-zinc-800 rounded-2xl mb-4 shadow-xl">
            <Music className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500">
            Audio Studio <span className="text-indigo-500">Pro</span>
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto font-medium">
            Separação de Stems em Alta Fidelidade movida a IA Neural Local.
          </p>
        </header>

        {status === 'idle' && (
          <div className="max-w-2xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              
              {/* ZONA DE DROP (DRAG & DROP) */}
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 rounded-3xl p-12 text-center backdrop-blur-xl transition-all duration-300 flex flex-col items-center justify-center min-h-[320px] ${
                  isDragging 
                    ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02] shadow-[0_0_30px_rgba(79,70,229,0.2)]' 
                    : file 
                      ? 'border-emerald-500/50 bg-zinc-950/80' 
                      : 'border-dashed border-zinc-700/60 bg-zinc-950/80 hover:border-zinc-500'
                }`}
              >
                {file ? (
                  <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50">
                      <FileAudio className="w-10 h-10 text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-zinc-200 truncate max-w-xs">{file.name}</p>
                      <p className="text-sm text-zinc-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <button 
                      onClick={() => setFile(null)}
                      className="text-sm text-zinc-400 hover:text-red-400 underline underline-offset-4 transition-colors mt-2"
                    >
                      Remover arquivo
                    </button>
                  </div>
                ) : (
                  <>
                    <UploadCloud className={`h-20 w-20 mb-6 transition-all duration-500 ${isDragging ? 'text-indigo-400 scale-110 animate-bounce' : 'text-zinc-500 group-hover:text-indigo-400 group-hover:scale-110'}`} />
                    <h3 className="text-xl font-bold text-zinc-200 mb-2">
                      {isDragging ? 'Solte a música aqui!' : 'Arraste e solte o seu áudio'}
                    </h3>
                    <p className="text-zinc-500 mb-8">
                      Suporta WAV, FLAC, MP3 (Máx: 50MB)
                    </p>
                    
                    <label className="block w-auto cursor-pointer">
                      <span className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-bold py-3 px-6 rounded-full transition-colors border border-zinc-700">
                        Ou procure no computador
                      </span>
                      <input 
                        type="file" 
                        accept="audio/*"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                  </>
                )}
              </div>
              
              {/* Botão de Extrair (só aparece após selecionar arquivo) */}
              <div className={`transition-all duration-500 overflow-hidden ${file ? 'max-h-32 mt-6 opacity-100' : 'max-h-0 mt-0 opacity-0'}`}>
                <button 
                  onClick={handleUpload}
                  disabled={!file}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-500 hover:shadow-[0_0_30px_rgba(79,70,229,0.3)] transition-all"
                >
                  <Sparkles size={20} />
                  Extrair Stems com IA
                </button>
              </div>

            </div>
          </div>
        )}

        {(status === 'uploading' || status === 'processing') && (
          <div className="flex flex-col items-center justify-center p-24 space-y-8 bg-zinc-950/50 border border-zinc-800/50 rounded-3xl backdrop-blur-md max-w-2xl mx-auto">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
              <Loader2 className="h-20 w-20 text-indigo-400 animate-spin relative z-10" />
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-3xl font-bold text-zinc-100">
                {status === 'uploading' ? 'Enviando Master...' : 'Processamento Neural...'}
              </h3>
              <p className="text-zinc-500 text-lg">
                O motor Meta Demucs está isolando as frequências.
              </p>
            </div>
          </div>
        )}

        {status === 'ready' && stems && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <MultiTrackPlayer stems={stems} />
          </div>
        )}

      </div>
    </main>
  );
}