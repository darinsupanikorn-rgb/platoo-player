import os
import uuid
import threading
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from separator import run_spleeter

BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "output"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Platoo Player - Stem Separation")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs = {}
lock = threading.Lock()

STEM_NAMES = ["vocals", "drums", "bass", "other"]


@app.get("/")
def health_check():
    return {"status": "ok"}


@app.post("/api/separate")
async def separate(file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())

    ext = Path(file.filename).suffix if file.filename else ".wav"
    job_upload_dir = UPLOAD_DIR / job_id
    job_upload_dir.mkdir(parents=True, exist_ok=True)
    input_path = job_upload_dir / f"input{ext}"

    content = await file.read()
    with open(input_path, "wb") as f:
        f.write(content)

    job_output_dir = OUTPUT_DIR / job_id

    with lock:
        jobs[job_id] = {
            "status": "processing",
            "input_path": str(input_path),
            "output_dir": str(job_output_dir),
        }

    thread = threading.Thread(
        target=_process_separation,
        args=(job_id, str(input_path), str(job_output_dir)),
        daemon=True,
    )
    thread.start()

    return {"job_id": job_id, "status": "processing"}


def _process_separation(job_id, input_path, output_dir):
    try:
        run_spleeter(input_path, output_dir)
        with lock:
            jobs[job_id]["status"] = "done"
            jobs[job_id]["stems"] = STEM_NAMES
    except Exception as e:
        with lock:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error"] = str(e)


@app.get("/api/status/{job_id}")
def get_status(job_id: str):
    with lock:
        job = jobs.get(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] == "done":
        return {"status": "done", "stems": job["stems"]}
    elif job["status"] == "error":
        return {"status": "error", "error": job["error"]}
    else:
        return {"status": "processing"}


@app.get("/api/download/{job_id}/{stem}")
def download_stem(job_id: str, stem: str):
    if stem not in STEM_NAMES:
        raise HTTPException(status_code=400, detail=f"Invalid stem: {stem}")

    stem_path = OUTPUT_DIR / job_id / f"{stem}.wav"

    if not stem_path.exists():
        raise HTTPException(status_code=404, detail="Stem file not found")

    return FileResponse(
        str(stem_path), media_type="audio/wav", filename=f"{stem}.wav"
    )


@app.get("/api/stems/{job_id}")
def get_stems(job_id: str):
    stem_files = {}
    for stem in STEM_NAMES:
        stem_path = OUTPUT_DIR / job_id / f"{stem}.wav"
        if stem_path.exists():
            stem_files[stem] = f"/api/download/{job_id}/{stem}"

    if not stem_files:
        raise HTTPException(status_code=404, detail="No stems found for this job")

    return {"stems": stem_files}
