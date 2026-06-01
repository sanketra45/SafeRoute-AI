"""
SafeRoute AI — Download Nagpur Road Network Graph
==================================================
Run ONCE before starting ml_service.py.
Downloads Nagpur road network from OpenStreetMap via OSMnx.

Usage:  python download_nagpur_graph.py
Output: data/nagpur_road_network.graphml
"""
import os, time

BASE      = os.path.dirname(os.path.abspath(__file__))
DATA_DIR  = os.path.join(BASE, "data")
SAVE_PATH = os.path.join(DATA_DIR, "nagpur_road_network.graphml")

os.makedirs(DATA_DIR, exist_ok=True)

if os.path.exists(SAVE_PATH):
    mb = os.path.getsize(SAVE_PATH) / (1024*1024)
    print(f"[OK] Graph already exists: {SAVE_PATH} ({mb:.1f} MB). Nothing to do.")
    exit(0)

try:
    import osmnx as ox
except ImportError:
    print("[ERROR] osmnx not installed. Run:  pip install osmnx")
    exit(1)

print("=" * 55)
print(" SafeRoute AI — Nagpur Road Network Download")
print("=" * 55)
print("[...] Downloading from OpenStreetMap. Takes 1–3 min.\n")

start = time.time()
try:
    G = ox.graph_from_place(
        "Nagpur, Maharashtra, India",
        network_type="drive",
        retain_all=False,
        simplify=True,
    )
    elapsed = time.time() - start
    print(f"[OK] Downloaded in {elapsed:.1f}s")
    print(f"     Nodes : {G.number_of_nodes():,}")
    print(f"     Edges : {G.number_of_edges():,}")
    print(f"[...] Saving to {SAVE_PATH} ...")
    ox.save_graphml(G, SAVE_PATH)
    mb = os.path.getsize(SAVE_PATH) / (1024*1024)
    print(f"[OK] Saved ({mb:.1f} MB)")
    print("\n[DONE] You can now start:  python ml_service.py")
except Exception as e:
    print(f"[ERROR] {e}")
    print("        Check internet connection and try again.")
