import os
import subprocess
from pathlib import Path

def separate_audio(input_file_path: str, output_dir: str) -> dict:
    input_path = Path(input_file_path)
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    # Otimização de Velocidade: 
    # -j 4 força o uso de múltiplos núcleos da CPU (altere para 8 se tiver um i7/Ryzen 7 forte)
    cmd = [
        "demucs",
        "-n", "htdemucs_6s",
        "-j", "4", 
        "--out", str(out_path),
        str(input_path)
    ]
    
    process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    if process.returncode != 0:
        raise Exception(f"Erro ao processar áudio: {process.stderr.decode('utf-8')}")

    file_stem = input_path.stem
    demucs_out_dir = out_path / "htdemucs_6s" / file_stem
    
    stems = {
        "vocals": str(demucs_out_dir / "vocals.wav"),
        "drums": str(demucs_out_dir / "drums.wav"),
        "bass": str(demucs_out_dir / "bass.wav"),
        "other": str(demucs_out_dir / "other.wav"),
        "piano": str(demucs_out_dir / "piano.wav"),
        "guitar": str(demucs_out_dir / "guitar.wav"),
    }
    
    return stems