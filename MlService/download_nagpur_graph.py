"""
SafeRoute AI — Download Nagpur Road Network Graph
==================================================
Downloads a smaller road network around central Nagpur.
"""

import os
import time
import osmnx as ox

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, "data")
SAVE_PATH = os.path.join(DATA_DIR, "nagpur_road_network.graphml")

os.makedirs(DATA_DIR, exist_ok=True)

print("=" * 55)
print(" SafeRoute AI — Smaller Nagpur Road Network")
print("=" * 55)

# Download a smaller road network around central Nagpur
print("[...] Downloading road network from OpenStreetMap...")

start = time.time()

try:
    G = ox.graph_from_point(
        (21.1458, 79.0882),
        dist=8000,
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