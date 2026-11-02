"""
SafeRoute AI — Build-Time Tile Generator (from local GraphML)
=============================================================
This script slices the committed nagpur_road_network.graphml into the
same 4x4 tile grid used by tile_router.py WITHOUT downloading anything
from OpenStreetMap.

Run during Render build (after pip install) via render.yaml / build command:
    python MlService/build_tiles_from_graphml.py

Output:
    MlService/data/tiles/tile_00_00.graphml ... tile_03_03.graphml  (16 files)

Memory strategy: load the full graph once, extract sub-graphs per tile
using bounding-box node filtering, then discard the full graph.
"""

import os
import sys
import time
import logging

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
log = logging.getLogger("build_tiles")

# -- Resolve paths --------------------------------------------------------------
BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
GRAPHML_PATH  = os.path.join(BASE_DIR, "data", "nagpur_road_network.graphml")
TILES_DIR     = os.path.join(BASE_DIR, "data", "tiles")

sys.path.insert(0, BASE_DIR)
from tile_router import (
    GRID_ROWS, GRID_COLS,
    tile_bbox_with_overlap, get_tile_id, tile_graphml_path,
    tiles_available, missing_tile_ids,
)

# -- Dependency check -----------------------------------------------------------
try:
    import networkx as nx
except ImportError:
    log.error("networkx is not installed -- run: pip install networkx")
    sys.exit(1)

try:
    import osmnx as ox
    _HAS_OSMNX = True
except ImportError:
    _HAS_OSMNX = False
    log.warning("osmnx not available -- falling back to networkx GraphML loader")


def load_full_graph():
    """Load the committed nagpur_road_network.graphml."""
    if not os.path.exists(GRAPHML_PATH):
        log.error("Source GraphML not found: %s", GRAPHML_PATH)
        log.error("Ensure data/nagpur_road_network.graphml is committed to the repo.")
        sys.exit(1)

    log.info("Loading full graph from %s ...", GRAPHML_PATH)
    t0 = time.time()
    if _HAS_OSMNX:
        G = ox.load_graphml(GRAPHML_PATH)
        G = nx.MultiDiGraph(G)
    else:
        G = nx.read_graphml(GRAPHML_PATH)
    log.info("Loaded: %d nodes, %d edges  (%.1fs)", G.number_of_nodes(), G.number_of_edges(), time.time() - t0)
    return G


def extract_tile(G, row, col):
    """
    Return a sub-graph containing only nodes (and their edges) that fall
    inside the bounding box for tile (row, col) with overlap.
    """
    bb = tile_bbox_with_overlap(row, col)
    lat_min = bb["lat_min"]
    lat_max = bb["lat_max"]
    lon_min = bb["lon_min"]
    lon_max = bb["lon_max"]

    # Collect nodes inside bbox
    nodes_in_tile = []
    for node, data in G.nodes(data=True):
        try:
            lat = float(data.get("y", data.get("lat", 0)))
            lon = float(data.get("x", data.get("lon", 0)))
            if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
                nodes_in_tile.append(node)
        except (TypeError, ValueError):
            continue

    if not nodes_in_tile:
        log.warning("  [WARN] No nodes found in tile_%02d_%02d bbox", row, col)
        return None

    sub = G.subgraph(nodes_in_tile).copy()
    # Keep only the largest weakly-connected component to avoid routing failures
    if sub.number_of_nodes() > 0:
        try:
            components = list(nx.weakly_connected_components(sub))
            if len(components) > 1:
                largest = max(components, key=len)
                sub = sub.subgraph(largest).copy()
        except Exception:
            pass

    return sub


def save_tile(G_tile, row, col):
    """Save a tile graph to GraphML format."""
    tile_id  = get_tile_id(row, col)
    path     = tile_graphml_path(row, col)

    os.makedirs(os.path.dirname(path), exist_ok=True)

    if G_tile is None or G_tile.number_of_nodes() == 0:
        log.warning("  [SKIP] %s -- no nodes to save", tile_id)
        return False

    try:
        if _HAS_OSMNX:
            ox.save_graphml(G_tile, path)
        else:
            nx.write_graphml(G_tile, path)
        size_mb = os.path.getsize(path) / (1024 * 1024)
        log.info("  [SAVED] %s  nodes=%d  edges=%d  %.1f MB",
                 tile_id, G_tile.number_of_nodes(), G_tile.number_of_edges(), size_mb)
        return True
    except Exception as e:
        log.error("  [ERROR] Saving %s: %s", tile_id, e)
        return False


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate Nagpur tile GraphML files from committed graphml")
    parser.add_argument("--overwrite", action="store_true", help="Re-generate tiles that already exist")
    parser.add_argument("--skip-if-present", action="store_true",
                        help="Skip entirely if any tiles already exist (for idempotent build steps)")
    args = parser.parse_args()

    print("=" * 65)
    print(" SafeRoute AI -- Tile Generator (from committed GraphML)")
    print("  Grid: %dx%d = %d tiles" % (GRID_ROWS, GRID_COLS, GRID_ROWS * GRID_COLS))
    print("  Source: %s" % GRAPHML_PATH)
    print("  Output: %s" % TILES_DIR)
    print("=" * 65)

    os.makedirs(TILES_DIR, exist_ok=True)

    if args.skip_if_present and tiles_available():
        log.info("[OK] All required tiles already present -- skipping generation.")
        return

    # Check which tiles are missing
    missing = []
    for r in range(GRID_ROWS):
        for c in range(GRID_COLS):
            path = tile_graphml_path(r, c)
            if args.overwrite or not os.path.exists(path):
                missing.append((r, c))

    if not missing:
        log.info("[OK] All %d tiles already exist. Use --overwrite to regenerate.", GRID_ROWS * GRID_COLS)
        return

    log.info("[INFO] %d tile(s) need to be generated.", len(missing))

    # Load full graph ONCE
    G_full = load_full_graph()

    success = 0
    total   = len(missing)
    for i, (row, col) in enumerate(missing, 1):
        tile_id = get_tile_id(row, col)
        log.info("\n[%d/%d] Extracting %s ...", i, total, tile_id)
        t0 = time.time()
        G_tile = extract_tile(G_full, row, col)
        log.info("  Extracted %d nodes in %.2fs",
                 G_tile.number_of_nodes() if G_tile else 0, time.time() - t0)
        if save_tile(G_tile, row, col):
            success += 1

    # Free memory
    del G_full

    print("\n" + "=" * 65)
    print("  Done: %d/%d tiles generated." % (success, total))
    if success < total:
        print("  WARNING: %d tile(s) failed -- check logs above." % (total - success))
    print("=" * 65)

    # Summary
    existing = [f for f in os.listdir(TILES_DIR) if f.endswith(".graphml")]
    total_mb = sum(
        os.path.getsize(os.path.join(TILES_DIR, f)) / (1024 * 1024)
        for f in existing
    )
    log.info("Total tiles on disk: %d  (%.1f MB total)", len(existing), total_mb)

    missing_after_build = missing_tile_ids()
    if missing_after_build:
        log.error("Required tiles are still missing: %s", ", ".join(missing_after_build))
        sys.exit(1)


if __name__ == "__main__":
    main()
