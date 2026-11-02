"""Build the complete Nagpur tile grid from the committed GraphML source.

The source graph is streamed twice instead of being loaded into NetworkX.
Render's small instances cannot safely retain a full graph and sixteen copied
subgraphs in memory during an image build.
"""

import argparse
from contextlib import contextmanager
import hashlib
import json
import logging
import os
import shutil
import sys
import time
import xml.etree.ElementTree as ET
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GRAPHML_PATH = os.path.join(BASE_DIR, "data", "nagpur_road_network.graphml")
sys.path.insert(0, BASE_DIR)

import tile_router as _tile_router
from tile_router import (  # noqa: E402
    GRID_COLS, GRID_ROWS, get_tile_id, missing_tile_ids,
    required_tile_paths, tile_bbox_with_overlap, tile_graphml_path, tile_validation_status,
    tiles_available,
)

TILES_DIR = _tile_router.TILES_DIR
GRAPHML_NS = "http://graphml.graphdrawing.org/xmlns"
NS = "{" + GRAPHML_NS + "}"
MANIFEST_NAME = "tile_manifest.json"

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
log = logging.getLogger("build_tiles")


def _tile_ids_for_coordinate(lat, lon):
    """Return every overlapping tile containing the coordinate."""
    result = []
    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            bbox = tile_bbox_with_overlap(row, col)
            if (bbox["lat_min"] <= lat <= bbox["lat_max"] and
                    bbox["lon_min"] <= lon <= bbox["lon_max"]):
                result.append(get_tile_id(row, col))
    return tuple(result)


def _source_key_data():
    """Read GraphML key declarations and map keys to attribute names."""
    keys, names = [], {}
    for _, elem in ET.iterparse(GRAPHML_PATH, events=("end",)):
        if elem.tag == NS + "key":
            keys.append(ET.fromstring(ET.tostring(elem, encoding="utf-8")))
            names[elem.attrib["id"]] = elem.attrib.get("attr.name")
        elif elem.tag == NS + "node":
            break
    return keys, names


def _open_tile_writers(key_elements):
    """Open each output file and write a valid GraphML header."""
    header = [
        "<?xml version='1.0' encoding='utf-8'?>\n",
        f'<graphml xmlns="{GRAPHML_NS}" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        f'xsi:schemaLocation="{GRAPHML_NS} {GRAPHML_NS}/1.0/graphml.xsd">\n',
    ]
    header.extend(ET.tostring(key, encoding="unicode") + "\n" for key in key_elements)
    header.append('<graph edgedefault="directed">\n')

    writers = {}
    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            tile_id = get_tile_id(row, col)
            writer = open(tile_graphml_path(row, col), "w", encoding="utf-8")
            writer.writelines(header)
            writers[tile_id] = writer
    return writers


def _close_tile_writers(writers):
    for writer in writers.values():
        writer.write("</graph>\n</graphml>\n")
        writer.close()


def _node_coordinates(node, key_names):
    values = {
        key_names.get(data.attrib.get("key")): data.text
        for data in node.findall(NS + "data")
    }
    try:
        return float(values["y"]), float(values["x"])
    except (KeyError, TypeError, ValueError):
        return None


def _iter_graph_elements(target_tag):
    """Yield matching top-level GraphML elements while pruning parsed XML."""
    stack = []
    graph_children = {NS + "node", NS + "edge", NS + "key"}
    for event, elem in ET.iterparse(GRAPHML_PATH, events=("start", "end")):
        if event == "start":
            stack.append(elem)
            continue
        if elem.tag in graph_children and len(stack) >= 2:
            if elem.tag == target_tag:
                yield elem
            parent = stack[-2]
            parent.remove(elem)
            elem.clear()
        stack.pop()


def _file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _manifest_matches_source():
    """Reject tile sets that are valid GraphML but stale or not source-derived."""
    manifest_path = os.path.join(TILES_DIR, MANIFEST_NAME)
    try:
        with open(manifest_path, encoding="utf-8") as manifest_file:
            manifest = json.load(manifest_file)
        if manifest.get("format_version") != 1:
            return False
        if manifest.get("source_sha256") != _file_sha256(GRAPHML_PATH):
            return False
        if manifest.get("grid") != {
                "rows": GRID_ROWS,
                "cols": GRID_COLS,
                "bounds": _tile_router.NAGPUR_BBOX,
                "overlap_deg": _tile_router.OVERLAP_DEG,
        }:
            return False
        recorded_tiles = manifest.get("tiles", {})
        paths = required_tile_paths()
        if set(recorded_tiles) != set(paths):
            return False
        validation_status = tile_validation_status()
        for tile_id, path in paths.items():
            validation = validation_status["tiles"][tile_id]
            recorded = recorded_tiles[tile_id]
            if (not validation["valid"] or
                    recorded.get("nodes") != validation["nodes"] or
                    recorded.get("edges") != validation["edges"] or
                    recorded.get("sha256") != _file_sha256(path)):
                return False
        return True
    except (OSError, ValueError, TypeError, AttributeError):
        return False


def _write_manifest(source_sha256):
    validation = tile_validation_status()
    if not validation["routing_ready"]:
        raise RuntimeError("Cannot write manifest for an invalid tile grid.")
    paths = required_tile_paths()
    manifest = {
        "format_version": 1,
        "source_sha256": source_sha256,
        "grid": {
            "rows": GRID_ROWS,
            "cols": GRID_COLS,
            "bounds": _tile_router.NAGPUR_BBOX,
            "overlap_deg": _tile_router.OVERLAP_DEG,
        },
        "tiles": {
            tile_id: {
                "nodes": info["nodes"],
                "edges": info["edges"],
                "sha256": _file_sha256(paths[tile_id]),
            }
            for tile_id, info in validation["tiles"].items()
        },
    }
    manifest_path = os.path.join(TILES_DIR, MANIFEST_NAME)
    temporary_path = manifest_path + ".tmp"
    with open(temporary_path, "w", encoding="utf-8") as manifest_file:
        json.dump(manifest, manifest_file, separators=(",", ":"), sort_keys=True)
        manifest_file.write("\n")
    os.replace(temporary_path, manifest_path)


def build_tiles(overwrite=False):
    if not os.path.isfile(GRAPHML_PATH):
        raise FileNotFoundError(f"Source GraphML not found: {GRAPHML_PATH}")
    if tiles_available() and _manifest_matches_source() and not overwrite:
        log.info("All required tiles already exist; use --overwrite to rebuild.")
        return

    # Do not mix generations: a route must never compose old and new fragments.
    if os.path.isdir(TILES_DIR):
        shutil.rmtree(TILES_DIR)
    os.makedirs(TILES_DIR, exist_ok=True)

    started = time.monotonic()
    source_sha256 = _file_sha256(GRAPHML_PATH)
    keys, key_names = _source_key_data()
    writers = _open_tile_writers(keys)
    counts = defaultdict(lambda: {"nodes": 0, "edges": 0})
    node_tiles = {}

    try:
        # Pass 1 retains only node-id -> tile ids. XML is written and discarded.
        for elem in _iter_graph_elements(NS + "node"):
            coordinates = _node_coordinates(elem, key_names)
            if coordinates:
                tile_ids = _tile_ids_for_coordinate(*coordinates)
                if tile_ids:
                    node_id = elem.attrib["id"]
                    node_tiles[node_id] = tile_ids
                    node_xml = ET.tostring(elem, encoding="unicode")
                    for tile_id in tile_ids:
                        writers[tile_id].write(node_xml + "\n")
                        counts[tile_id]["nodes"] += 1

        # Pass 2 writes an edge only where both endpoint nodes are present.
        for elem in _iter_graph_elements(NS + "edge"):
            source_tiles = node_tiles.get(elem.attrib.get("source"), ())
            target_tiles = node_tiles.get(elem.attrib.get("target"), ())
            shared_tiles = set(source_tiles).intersection(target_tiles)
            if shared_tiles:
                edge_xml = ET.tostring(elem, encoding="unicode")
                for tile_id in shared_tiles:
                    writers[tile_id].write(edge_xml + "\n")
                    counts[tile_id]["edges"] += 1
    finally:
        _close_tile_writers(writers)

    invalid = []
    validation = tile_validation_status()
    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            tile_id = get_tile_id(row, col)
            path = tile_graphml_path(row, col)
            count = counts[tile_id]
            result = validation["tiles"][tile_id]
            size_mb = os.path.getsize(path) / 1_048_576 if os.path.isfile(path) else 0
            usable = (result["valid"] and result["nodes"] > 0 and result["edges"] > 0
                      and count["nodes"] > 0 and count["edges"] > 0)
            if usable:
                log.info("[TILE] %s VALID nodes=%d edges=%d size=%.1f MB",
                         tile_id, result["nodes"], result["edges"], size_mb)
            else:
                detail = result["error"] or (
                    f"generated {count['nodes']} nodes/{count['edges']} edges; "
                    f"validated {result['nodes']} nodes/{result['edges']} edges"
                )
                invalid.append(f"{tile_id} ({detail})")
                log.error("[TILE] %s INVALID nodes=%d edges=%d size=%.1f MB: %s",
                          tile_id, result["nodes"], result["edges"], size_mb, detail)

    missing = missing_tile_ids()
    if missing:
        invalid.extend(f"{tile_id} (missing)" for tile_id in missing)
    if invalid:
        raise RuntimeError("Tile generation validation failed: " + "; ".join(invalid))
    if _file_sha256(GRAPHML_PATH) != source_sha256:
        raise RuntimeError("Source GraphML changed during tile generation; rebuild required.")

    _write_manifest(source_sha256)
    log.info("Generated and validated all %d/%d tiles in %.1fs.",
             GRID_ROWS * GRID_COLS, GRID_ROWS * GRID_COLS,
             time.monotonic() - started)


@contextmanager
def _generation_lock():
    """Serialize repair attempts across multiple app worker processes."""
    lock_path = os.path.join(os.path.dirname(TILES_DIR), ".tiles-bootstrap.lock")
    os.makedirs(os.path.dirname(lock_path), exist_ok=True)
    with open(lock_path, "a+b") as lock_file:
        if os.name == "nt":
            import msvcrt

            lock_file.seek(0)
            if not lock_file.read(1):
                lock_file.seek(0)
                lock_file.write(b"0")
                lock_file.flush()
            lock_file.seek(0)
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_LOCK, 1)
            try:
                yield
            finally:
                lock_file.seek(0)
                msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def ensure_tiles_ready():
    """Keep an invalid or stale tile directory from reaching the router."""
    if not tiles_available() or not _manifest_matches_source():
        with _generation_lock():
            if not tiles_available() or not _manifest_matches_source():
                log.warning("Routing tiles are incomplete or stale; regenerating from %s",
                            GRAPHML_PATH)
                build_tiles(overwrite=True)

    validation = tile_validation_status()
    if not validation["routing_ready"]:
        invalid = {
            tile_id: tile for tile_id, tile in validation["tiles"].items()
            if not tile["valid"] or tile["nodes"] <= 0 or tile["edges"] <= 0
        }
        raise RuntimeError(f"Routing tile bootstrap failed: {invalid}")

    log.info("Routing tiles ready: %d/%d valid tiles.",
             validation["valid_tiles"], GRID_ROWS * GRID_COLS)
    return validation


def main():
    parser = argparse.ArgumentParser(description="Stream GraphML into the full Nagpur tile grid")
    parser.add_argument("--overwrite", action="store_true", help="rebuild the complete tile grid")
    args = parser.parse_args()
    try:
        build_tiles(overwrite=args.overwrite)
    except Exception as error:
        log.exception("Tile generation failed: %s", error)
        sys.exit(1)


if __name__ == "__main__":
    main()
