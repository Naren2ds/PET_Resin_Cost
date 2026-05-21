from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MR_INDEX_SCRIPT = ROOT / "pipelines" / "indexes" / "market_research" / "extract_market_research_icis_index_reference.py"
MR_MODEL_SCRIPT = ROOT / "pipelines" / "market_research" / "tlc_model" / "build_market_research_front_end_data_model.py"


def run(script: Path) -> None:
    print(f"running: {script.relative_to(ROOT)}")
    subprocess.run([sys.executable, str(script)], cwd=ROOT, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh Market Research index and TLC front-end model outputs.")
    parser.add_argument(
        "--skip-index",
        action="store_true",
        help="Use the existing Market Research index reference table and rebuild only the MR TLC model.",
    )
    args = parser.parse_args()

    if not args.skip_index:
        run(MR_INDEX_SCRIPT)
    run(MR_MODEL_SCRIPT)


if __name__ == "__main__":
    main()