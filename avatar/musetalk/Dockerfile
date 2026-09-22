# MuseTalk-Sidecar (GPU). Basis: CUDA + PyTorch; MuseTalk-Repo + Gewichte werden
# beim Build geklont bzw. per Volume gemountet (Gewichte sind mehrere GB → Volume).
FROM pytorch/pytorch:2.3.1-cuda12.1-cudnn8-runtime

RUN apt-get update && apt-get install -y --no-install-recommends git ffmpeg libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
RUN git clone --depth 1 https://github.com/TMElyralab/MuseTalk.git
WORKDIR /opt/MuseTalk
RUN pip install --no-cache-dir -r requirements.txt fastapi "uvicorn[standard]" python-multipart pillow

# Gewichte: ./download_weights.sh im Repo, oder Volume nach /opt/MuseTalk/models mounten.
COPY server.py /opt/sidecar/server.py
ENV MUSETALK_REPO=/opt/MuseTalk
EXPOSE 8090
CMD ["uvicorn", "--app-dir", "/opt/sidecar", "server:app", "--host", "0.0.0.0", "--port", "8090"]
