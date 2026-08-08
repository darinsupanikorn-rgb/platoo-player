import logging
import shutil
import subprocess
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_NAME = "htdemucs_6s"
STEM_NAMES = ["vocals", "drums", "bass", "guitar", "piano", "other"]


def run_separation(input_path, output_dir):
    """Separate audio into vocals/drums/bass/guitar/piano/other stems using Demucs (htdemucs_6s).

    Runs demucs as a subprocess (isolated memory, model loads in the child),
    then moves the stem wavs from the model subdirectory to output_dir so the
    rest of the app can keep expecting {output_dir}/{stem}.wav.
    """
    try:
        import demucs  # noqa: F401  (verify the package is installed)
    except ImportError:
        logger.error("demucs is not installed")
        raise

    out_root = Path(output_dir)
    out_root.mkdir(parents=True, exist_ok=True)

    logger.info(f"Starting Demucs ({MODEL_NAME}) for {input_path} -> {output_dir}")
    subprocess.run(
        [
            sys.executable,
            "-m",
            "demucs.separate",
            "-n",
            MODEL_NAME,
            "-o",
            str(out_root),
            "--filename",
            "{stem}.{ext}",
            str(input_path),
        ],
        check=True,
    )

    model_dir = out_root / MODEL_NAME
    moved = []
    if model_dir.exists():
        for stem in STEM_NAMES:
            src = model_dir / f"{stem}.wav"
            if src.exists():
                shutil.move(str(src), str(out_root / f"{stem}.wav"))
                moved.append(stem)
        shutil.rmtree(model_dir, ignore_errors=True)

    logger.info(f"Separation completed for {input_path}: stems={moved}")
    return True
