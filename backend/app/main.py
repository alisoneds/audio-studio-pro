import os
import shutil
import uuid
import math
from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pydub import AudioSegment
from app.audio_engine import separate_audio

app = FastAPI(title="Audio Studio Pro API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "separated"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

app.mount("/audio", StaticFiles(directory=OUTPUT_DIR), name="audio")

# Banco de dados em memória para rastrear as tarefas na nuvem (substitui o Redis)
tasks_db = {}

class MixRequest(BaseModel):
    stems: dict
    volumes: dict
    mutes: dict
    pans: dict
    format: str

def process_audio_task(task_id: str, file_path: str):
    tasks_db[task_id] = {"status": "Processando na IA"}
    try:
        # Chama o Demucs diretamente
        stems = separate_audio(file_path, OUTPUT_DIR)
        
        # Converte os caminhos absolutos do Windows/Linux para URLs relativas
        safe_stems = {}
        for k, v in stems.items():
            safe_stems[k] = v.replace('\\', '/')
            
        tasks_db[task_id] = {"status": "Concluído", "data": {"stems": safe_stems}}
    except Exception as e:
        tasks_db[task_id] = {"status": "Falhou", "error": str(e)}
    finally:
        # Apaga o arquivo original de upload para não lotar o HD do servidor gratuito
        if os.path.exists(file_path):
            os.remove(file_path)

@app.post("/api/upload")
async def upload_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    task_id = str(uuid.uuid4())
    file_extension = file.filename.split('.')[-1]
    safe_filename = f"{task_id}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    tasks_db[task_id] = {"status": "Na fila"}
    
    # Envia para processamento em segundo plano (substitui o Celery)
    background_tasks.add_task(process_audio_task, task_id, file_path)
    
    return {"message": "Áudio na fila de processamento", "task_id": task_id}

@app.get("/api/status/{task_id}")
async def get_status(task_id: str):
    task = tasks_db.get(task_id)
    if not task:
        return {"status": "Falhou", "error": "Tarefa não encontrada."}
    return task

def cleanup_temp_file(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except:
        pass

@app.post("/api/download")
async def download_audio(req: MixRequest, background_tasks: BackgroundTasks):
    mixed_audio = None
    
    for name, path_str in req.stems.items():
        if req.mutes.get(name, False):
            continue
            
        vol = req.volumes.get(name, 1.0)
        if vol <= 0.01:
            continue

        try:
            # Compatibilidade de caminho entre o Windows que gerou a string e o Linux da nuvem
            clean_path = path_str.replace('\\', '/')
            audio_track = AudioSegment.from_file(clean_path)
        except Exception as e:
            print(f"Erro ao ler {clean_path}: {e}")
            continue

        if vol != 1.0:
            db_change = 20 * math.log10(vol)
            audio_track = audio_track + db_change
            
        # Aplica o L/R no motor do servidor antes de exportar
        pan_val = req.pans.get(name, 0)
        if pan_val != 0:
            audio_track = audio_track.pan(pan_val)

        if mixed_audio is None:
            mixed_audio = audio_track
        else:
            mixed_audio = mixed_audio.overlay(audio_track)

    if mixed_audio is None:
        return {"error": "Nenhuma faixa selecionada para download."}

    out_name = f"export_{uuid.uuid4().hex[:8]}.{req.format}"
    out_path = os.path.join(OUTPUT_DIR, out_name)
    
    mixed_audio.export(out_path, format=req.format)
    background_tasks.add_task(cleanup_temp_file, out_path)
    
    return FileResponse(out_path, media_type=f"audio/{req.format}", filename=f"AudioStudioPro_Mix.{req.format}")