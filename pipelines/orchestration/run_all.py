from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN_INDEXES = ROOT / "pipelines" / "orchestration" / "run_indexes.py"
RUN_SUPPLIERS = ROOT / "pipelines" / "orchestration" / "run_suppliers.py"
RUN_MARKET_RESEARCH = ROOT / "pipelines" / "orchestration" / "run_market_research.py"


def run(command: list[str]) -> None:
    print("running: " + " ".join(command))
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh PET Resin Cost Platform processed outputs.")
    parser.add_argument(
        "--skip-indexes",
        action="store_true",
        help="Skip Supplier and Market Research index refresh steps.",
    )
    parser.add_argument(
        "--supplier-consolidate-only",
        action="store_true",
        help="Only rebuild the final Supplier model from existing supplier artifacts.",
    )
    args = parser.parse_args()

    if not args.skip_indexes:
        run([sys.executable, str(RUN_INDEXES)])

    supplier_command = [sys.executable, str(RUN_SUPPLIERS)]
    if args.supplier_consolidate_only:
        supplier_command.append("--consolidate-only")
    run(supplier_command)

    mr_command = [sys.executable, str(RUN_MARKET_RESEARCH), "--skip-index"]
    run(mr_command)


if __name__ == "__main__":
    main()