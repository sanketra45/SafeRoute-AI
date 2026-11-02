"""Build the complete Nagpur tile grid from the committed GraphML source.

The source graph is streamed twice instead of being loaded into NetworkX.
Render's small instances cannot safely retain a full graph and sixteen copied
subgraphs in memory during an image build.
"""

import argparse
import logging
import os
import shutil
import sys
import time
import xml.etree.ElementTree as ET
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GRAPHML_PATH = os.path.join(BASE_DIR, "data", "nagpur_road_network.graphml")
TILES_DIR = os.path.join(BASE_DIR, "data", "tiles")
GRAPHML_NS = "http://graphml.graphdrawing.org/xmlns"
NS = "{" + GRAPHML_NS + "}"

sys.path.insert(0, BASE_DIR)
from tile_router import (  # noqa: E402
    GRID_COLS, GRID_ROWS, get_tile_id, missing_tile_ids,
    tile_bbox_with_overlap, tile_graphml_path, tile_validation_status,
    tiles_available,
)

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


def build_tiles(overwrite=False):
    if not os.path.isfile(GRAPHML_PATH):
        raise FileNotFoundError(f"Source GraphML not found: {GRAPHML_PATH}")
    if tiles_available() and not overwrite:
        log.info("All required tiles already exist; use --overwrite to rebuild.")
        return

    # Do not mix generations: a route must never compose old and new fragments.
    if os.path.isdir(TILES_DIR):
        shutil.rmtree(TILES_DIR)
    os.makedirs(TILES_DIR, exist_ok=True)

    started = time.monotonic()
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
            if not result["valid"]:
                invalid.append(f"{tile_id} ({result['error']})")
            elif count["nodes"] == 0 or count["edges"] == 0:
                invalid.append(f"{tile_id} ({count['nodes']} nodes, {count['edges']} edges)")
            else:
                log.info("[SAVED] %s: %d nodes, %d edges, %.1f MB", tile_id,
                         count["nodes"], count["edges"], os.path.getsize(path) / 1_048_576)

    missing = missing_tile_ids()
    if missing:
        invalid.extend(f"{tile_id} (missing)" for tile_id in missing)
    if invalid:
        raise RuntimeError("Tile generation validation failed: " + "; ".join(invalid))

    log.info("Generated and validated all %d tiles in %.1fs.",
             GRID_ROWS * GRID_COLS, time.monotonic() - started)


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
