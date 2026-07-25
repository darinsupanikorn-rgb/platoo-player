import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_spleeter(input_path, output_dir):
    try:
        from spleeter.separator import Separator

        logger.info(f"Starting separation for {input_path} -> {output_dir}")
        separator = Separator('spleeter:4stems')
        separator.separate_to_file(
            input_path,
            output_dir,
            filename_format='{instrument}.{codec}',
            codec='wav',
        )
        logger.info(f"Separation completed for {input_path}")
        return True
    except ImportError:
        logger.error("spleeter is not installed")
        raise
    except Exception as e:
        logger.error(f"Separation failed: {e}")
        raise
