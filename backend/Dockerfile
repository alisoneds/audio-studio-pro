FROM python:3.11-slim

# Instalar FFmpeg (Obrigatório para o PyDub e Demucs)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Configurar usuário sem privilégios para o Hugging Face Spaces (exigência de segurança)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

# Copiar dependências e instalar
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o resto do código da API
COPY --chown=user:user . .

# Criar pastas de áudio com permissão total para a API escrever e deletar
RUN mkdir -p uploads separated && chmod 777 uploads separated

# A porta padrão gratuita do Hugging Face é a 7860
EXPOSE 7860

# Comando para ligar a API
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]