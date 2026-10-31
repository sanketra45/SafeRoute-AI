"""
SafeRoute AI — Tile Generator
==============================
Run this ONCE locally to generate tile GraphML files for Nagpur.

Usage:
    python generate_tiles.py

Output:
    MlService/data/tiles/tile_XX_YY.graphml  (16 files for 4×4 grid)

These files are committed to the repo (or uploaded to a storage bucket)
and used by tile_router.py at runtime — no OSMnx download needed in prod.

Grid: 4 rows × 4 cols, each tile ~15×12 km with 2.5 km overlap.
"""

import os
import sys
import time

# ── Resolve paths relative to this script ───────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
TILES_DIR = os.path.join(BASE_DIR, "data", "tiles")
os.makedirs(TILES_DIR, exist_ok=True)

# Import tile config from tile_router
sys.path.insert(0, BASE_DIR)
from tile_router import (
    GRID_ROWS, GRID_COLS, NAGPUR_BBOX,
    tile_bbox_with_overlap, get_tile_id, tile_graphml_path
)

try:
    import osmnx as ox
except ImportError:
    print("[ERROR] osmnx is not installed. Run: pip install osmnx")
    sys.exit(1)


def download_tile(row: int, col: int, overwrite: bool = False) -> bool:
    tile_id = get_tile_id(row, col)
    path    = tile_graphml_path(row, col)

    if not overwrite and os.path.exists(path):
        size_mb = os.path.getsize(path) / (1024 * 1024)
        print(f"  [SKIP] {tile_id} already exists ({size_mb:.1f} MB)")
        return True

    bb = tile_bbox_with_overlap(row, col)
    print(f"\n[DOWNLOADING] {tile_id}")
    print(f"  bbox: lat [{bb['lat_min']:.4f}, {bb['lat_max']:.4f}]  "
          f"lon [{bb['lon_min']:.4f}, {bb['lon_max']:.4f}]")

    t0 = time.time()
    try:
        G = ox.graph_from_bbox(
            bbox=(bb["lat_max"], bb["lat_min"], bb["lon_max"], bb["lon_min"]),
            network_type="drive",
            simplify=True,
        )
        elapsed = time.time() - t0
        print(f"  [OK] {G.number_of_nodes():,} nodes  {G.number_of_edges():,} edges  ({elapsed:.1f}s)")
        print(f"  [SAVING] → {path}")
        ox.save_graphml(G, path)
        size_mb = os.path.getsize(path) / (1024 * 1024)
        print(f"  [SAVED] {size_mb:.1f} MB")
        return True
    except Exception as e:
        print(f"  [ERROR] {tile_id}: {e}")
        return False


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate Nagpur tile GraphML files")
    parser.add_argument("--overwrite", action="store_true",
                        help="Re-download tiles that already exist")
    parser.add_argument("--row", type=int, default=None,
                        help="Download only this row (0-based)")
    parser.add_argument("--col", type=int, default=None,
                        help="Download only this col (0-based)")
    args = parser.parse_args()

    print("=" * 60)
    print(" SafeRoute AI — Nagpur Tile Generator")
    print(f" Grid: {GRID_ROWS} rows × {GRID_COLS} cols = {GRID_ROWS * GRID_COLS} tiles")
    print(f" Output: {TILES_DIR}")
    print("=" * 60)

    if args.row is not None and args.col is not None:
        # Single tile
        tiles = [(args.row, args.col)]
    else:
        tiles = [(r, c) for r in range(GRID_ROWS) for c in range(GRID_COLS)]

    total   = len(tiles)
    success = 0
    for i, (row, col) in enumerate(tiles, 1):
        print(f"\n[{i}/{total}] Processing tile ({row}, {col})")
        if download_tile(row, col, overwrite=args.overwrite):
            success += 1

    print("\n" + "=" * 60)
    print(f" Done: {success}/{total} tiles generated successfully.")
    print(f" Tiles directory: {TILES_DIR}")
    print("=" * 60)

    # List existing tiles
    existing = [f for f in os.listdir(TILES_DIR) if f.endswith(".graphml")]
    total_mb = sum(os.path.getsize(os.path.join(TILES_DIR, f)) / (1024*1024) for f in existing)
    print(f"\n Existing tiles: {len(existing)}")
    print(f" Total size: {total_mb:.1f} MB")


if __name__ == "__main__":
    main()
