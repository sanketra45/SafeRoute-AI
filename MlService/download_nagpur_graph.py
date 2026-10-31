"""
SafeRoute AI — Download Nagpur Road Network Graph
==================================================
Downloads the FULL Nagpur city road network (no radius limit).

NOTE: For production/Render deployment, use the tile-based approach instead:
  python generate_tiles.py

This script downloads a single monolithic graph (useful for local dev only).
The full graph may exceed Render's free-tier memory (512 MB).
"""

import os
import time
import osmnx as ox

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, "data")
SAVE_PATH = os.path.join(DATA_DIR, "nagpur_road_network.graphml")

os.makedirs(DATA_DIR, exist_ok=True)

print("=" * 55)
print(" SafeRoute AI — Full Nagpur Road Network")
print("=" * 55)

# Download the FULL Nagpur city road network (no radius limit)
print("[...] Downloading full Nagpur road network from OpenStreetMap...")
print("      This may take a few minutes for the complete city graph.")

start = time.time()

try:
    G = ox.graph_from_place(
        "Nagpur, Maharashtra, India",
        network_type="drive",
        simplify=True,
    )

    elapsed = time.time() - start

    print(f"[OK] Downloaded in {elapsed:.1f} seconds")
    print(f"     Nodes: {G.number_of_nodes():,}")
    print(f"     Edges: {G.number_of_edges():,}")

    print(f"[...] Saving to {SAVE_PATH}...")
    ox.save_graphml(G, SAVE_PATH)

    mb = os.path.getsize(SAVE_PATH) / (1024 * 1024)

    print(f"[OK] Graph saved: {mb:.2f} MB")
    print("[DONE] New road graph generated successfully!")

except Exception as e:
    print(f"[ERROR] {e}")