from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SUPPLIER_PIPELINE_SCRIPTS = [
    ROOT / "pipelines" / "suppliers" / "04. Amcor" / "scripts" / "run_amcor_pipeline.py",
    ROOT / "pipelines" / "suppliers" / "04. Engepack" / "scripts" / "run_engepack_pipeline.py",
    ROOT / "pipelines" / "suppliers" / "04. Valgroup" / "scripts" / "run_valgroup_pipeline.py",
    ROOT / "pipelines" / "suppliers" / "3 Precios AB Inbev_Abril 26 ECUADOR" / "scripts" / "run_ecuador_pipeline.py",
    ROOT / "pipelines" / "suppliers" / "Pricing_Pref-Bot_ABI_PER_Men_4_26_Cliente" / "scripts" / "run_per_pipeline.py",
    ROOT / "pipelines" / "suppliers" / "Pricing_Pref_ABI_PAN_Men_04_26_Cliente" / "scripts" / "run_pan_pipeline.py",
    ROOT / "pipelines" / "suppliers" / "Pricing_Pref_ABI_RD_Men_4_26_Cliente" / "scripts" / "run_rd_pipeline.py",
]

CONSOLIDATION_SCRIPT = ROOT / "pipelines" / "suppliers" / "consolidation" / "consolidate_front_end_data_model.py"


def run(script: Path) -> None:
    print(f"running: {script.relative_to(ROOT)}")
    subprocess.run([sys.executable, str(script)], cwd=ROOT, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh Supplier front-end data model outputs.")
    parser.add_argument(
        "--consolidate-only",
        action="store_true",
        help="Skip supplier-specific scripts and only rebuild the final consolidated Supplier model from existing artifacts.",
    )
    args = parser.parse_args()

    if not args.consolidate_only:
        for script in SUPPLIER_PIPELINE_SCRIPTS:
            run(script)

    run(CONSOLIDATION_SCRIPT)


if __name__ == "__main__":
    main()