import os
import re
import shutil
import time
import uuid
import threading
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from separator import run_separation, STEM_NAMES

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

MAX_UPLOAD_BYTES = 100 * 1024 * 1024
MAX_JOBS = 20
JOB_TTL_SECONDS = 86400
CHUNK_SIZE = 1024 * 1024

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _get_job_dir(job_id):
    if not UUID_RE.match(job_id):
        raise HTTPException(status_code=400, detail="Invalid job id")
    return OUTPUT_DIR / job_id


def _remove_job(job_id):
    job = jobs.pop(job_id, None)
    if job is None:
        return
    shutil.rmtree(Path(job["input_path"]).parent, ignore_errors=True)
    shutil.rmtree(job["output_dir"], ignore_errors=True)


def _sweep_old_jobs():
    now = time.time()
    for job_id, job in list(jobs.items()):
        if (
            job["status"] != "processing"
            and now - job.get("created_at", now) > JOB_TTL_SECONDS
        ):
            _remove_job(job_id)


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

    try:
        if file.size is not None and file.size > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413, detail="File too large (max 100 MB)"
            )

        total = 0
        with open(input_path, "wb") as f:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413, detail="File too large (max 100 MB)"
                    )
                f.write(chunk)
    except Exception:
        shutil.rmtree(job_upload_dir, ignore_errors=True)
        raise

    job_output_dir = OUTPUT_DIR / job_id

    with lock:
        _sweep_old_jobs()
        jobs[job_id] = {
            "status": "processing",
            "input_path": str(input_path),
            "output_dir": str(job_output_dir),
            "created_at": time.time(),
        }
        while len(jobs) > MAX_JOBS:
            oldest_id = None
            for jid, job in jobs.items():
                if job["status"] != "processing":
                    oldest_id = jid
                    break
            if oldest_id is None:
                break
            _remove_job(oldest_id)

    thread = threading.Thread(
        target=_process_separation,
        args=(job_id, str(input_path), str(job_output_dir)),
        daemon=True,
    )
    thread.start()

    return {"job_id": job_id, "status": "processing"}


def _process_separation(job_id, input_path, output_dir):
    try:
        run_separation(input_path, output_dir)
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

    job_output_dir = _get_job_dir(job_id)

    with lock:
        job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    stem_path = job_output_dir / f"{stem}.wav"

    if not stem_path.exists():
        raise HTTPException(status_code=404, detail="Stem file not found")

    return FileResponse(
        str(stem_path), media_type="audio/wav", filename=f"{stem}.wav"
    )


@app.get("/api/stems/{job_id}")
def get_stems(job_id: str):
    job_output_dir = _get_job_dir(job_id)

    with lock:
        job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    stem_files = {}
    for stem in STEM_NAMES:
        stem_path = job_output_dir / f"{stem}.wav"
        if stem_path.exists():
            stem_files[stem] = f"/api/download/{job_id}/{stem}"

    if not stem_files:
        raise HTTPException(status_code=404, detail="No stems found for this job")

    return {"stems": stem_files}
