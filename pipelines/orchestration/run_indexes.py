from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def run(script: Path) -> None:
    print(f"running: {script.relative_to(ROOT)}")
    subprocess.run([sys.executable, str(script)], cwd=ROOT, check=True)


def main() -> None:
    run(ROOT / "pipelines" / "indexes" / "suppliers" / "extract_icis_resin_index_reference.py")
    run(ROOT / "pipelines" / "indexes" / "market_research" / "extract_market_research_icis_index_reference.py")


if __name__ == "__main__":
    main()