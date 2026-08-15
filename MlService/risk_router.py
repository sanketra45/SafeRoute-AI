"""
SafeRoute AI - Advanced A* Routing Engine
==========================================
Includes:
- cKDTree spatial indexing for fast accident blackspot scoring
- Dynamic live conditions (traffic speed flow & weather condition penalty)
- Multi-objective A* route comparison (safe vs shortest)
"""

import os, math, logging, warnings
from typing import Optional

import numpy as np
import pandas as pd
import networkx as nx

warnings.filterwarnings("ignore", category=FutureWarning)
log = logging.getLogger(__name__)

GRAPHML_PATH        = os.path.join(os.path.dirname(__file__), "data", "nagpur_road_network.graphml")
DATASET_PATH        = os.path.join(os.path.dirname(__file__), "nagpur_accident_dataset.csv")
RISK_PENALTY        = 500
BLACKSPOT_RADIUS_M  = 250

HIGHWAY_RISK = {
    "motorway": 0.85, "motorway_link": 0.80,
    "trunk": 0.75,    "trunk_link": 0.70,
    "primary": 0.55,  "primary_link": 0.50,
    "secondary": 0.45,"secondary_link": 0.40,
    "tertiary": 0.35, "tertiary_link": 0.30,
    "unclassified": 0.30, "residential": 0.20,
    "living_street": 0.10, "service": 0.15,
    "track": 0.40,    "path": 0.35,
}
DEFAULT_HIGHWAY_RISK = 0.35

def _speed_risk(speed_str) -> float:
    try:
        val = float(str(speed_str).split()[0])
    except (ValueError, TypeError):
        return 0.35
    return min(val / 120.0, 1.0)

SURFACE_RISK = {
    "asphalt": 0.10, "paved": 0.10, "concrete": 0.12,
    "paving_stones": 0.20, "sett": 0.25, "cobblestone": 0.30,
    "compacted": 0.35, "fine_gravel": 0.45, "gravel": 0.55,
    "unpaved": 0.65, "dirt": 0.70, "grass": 0.75, "sand": 0.80,
}
DEFAULT_SURFACE_RISK = 0.30

JUNCTION_RISK = {"roundabout": 0.35, "circular": 0.35, "yes": 0.50}
DEFAULT_JUNCTION_RISK = 0.10

WEATHER_RISK = {
    "THUNDERSTORM": 0.90, "RAIN": 0.65, "DRIZZLE": 0.45,
    "SNOW": 0.60, "FOG": 0.70, "MIST": 0.40, "HAZE": 0.35,
    "SMOKE": 0.45, "DUST": 0.45, "SAND": 0.50, "CLOUDS": 0.15,
    "CLOUDY": 0.15, "CLEAR": 0.0,
}

def _live_conditions(conditions):
    """Normalise the Spring Boot traffic/weather payload into safe numeric values."""
    conditions = conditions or {}
    traffic = conditions.get("traffic") or {}
    weather = conditions.get("weather") or {}
    try:
        current_speed = float(traffic.get("currentSpeed", 0))
        free_speed = float(traffic.get("freeFlowSpeed", 0))
    except (TypeError, ValueError):
        current_speed = free_speed = 0.0

    congestion = (max(0.0, min(1.0, 1.0 - current_speed / free_speed))
                  if free_speed > 0 and current_speed > 0 else 0.0)
    condition = str(weather.get("condition") or weather.get("weather") or "CLEAR").upper()
    weather_risk = WEATHER_RISK.get(condition, 0.20)
    return congestion, weather_risk

def _load_blackspot_tree(csv_path):
    if not os.path.exists(csv_path):
        log.warning("Accident dataset not found at %s", csv_path)
        return None, []
    df = pd.read_csv(csv_path)
    severity_map = {"Low": 0.5, "Medium": 0.75, "High": 1.0}
    records = []
    for _, row in df.iterrows():
        try:
            lat   = float(row["latitude"])
            lng   = float(row["longitude"])
            sev   = severity_map.get(str(row.get("risk_level","Medium")).strip(), 0.75)
            count = min(float(row.get("accident_count", 1)) / 10.0, 1.0)
            score = min(sev * (0.5 + 0.5 * count), 1.0)
            records.append((lat, lng, score))
        except (ValueError, TypeError):
            continue
    try:
        from scipy.spatial import cKDTree
        tree = cKDTree(np.array([(lat, lng) for lat, lng, _ in records])) if records else None
    except ImportError:
        tree = None
    log.info("Loaded %d blackspot records%s", len(records), " with spatial index" if tree else "")
    return tree, records

def _haversine_m(lat1, lng1, lat2, lng2):
    R = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2-lat1), math.radians(lng2-lng1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(a))

def _node_blackspot_score(nlat, nlng, blackspots, radius_m=BLACKSPOT_RADIUS_M):
    best = 0.0
    tree, records = blackspots if isinstance(blackspots, tuple) else (None, blackspots)
    candidates = tree.query_ball_point([nlat, nlng], radius_m / 100000.0) if tree else range(len(records))
    for index in candidates:
        blat, blng, bscore = records[index]
        d = _haversine_m(nlat, nlng, blat, blng)
        if d <= radius_m:
            best = max(best, bscore * (1.0 - d/radius_m))
    return best

def load_graph(graphml_path=GRAPHML_PATH):
    if not os.path.exists(graphml_path):
        raise FileNotFoundError(
            f"GraphML not found: {graphml_path}\n"
            "Run: python download_nagpur_graph.py"
        )
    log.info("Loading graph from %s ...", graphml_path)
    try:
        import osmnx as ox
        G = ox.load_graphml(graphml_path)
    except ImportError:
        G = nx.read_graphml(graphml_path)
    log.info("Graph: %d nodes, %d edges", G.number_of_nodes(), G.number_of_edges())

    blackspots = _load_blackspot_tree(DATASET_PATH)
    _annotate_edges(G, blackspots)
    return G

def _edge_risk_score(edge_data, u_lat, u_lng, v_lat, v_lng, blackspots):
    hw = edge_data.get("highway","")
    if isinstance(hw, list): hw = hw[0] if hw else ""
    hw_risk    = HIGHWAY_RISK.get(str(hw).strip(), DEFAULT_HIGHWAY_RISK)
    speed_risk = _speed_risk(edge_data.get("maxspeed"))
    lit        = str(edge_data.get("lit","")).strip().lower()
    light_risk = 0.10 if lit=="yes" else (0.70 if lit in ("no","") else 0.40)
    surf_risk  = SURFACE_RISK.get(str(edge_data.get("surface","")).strip().lower(), DEFAULT_SURFACE_RISK)
    junc_risk  = JUNCTION_RISK.get(str(edge_data.get("junction","")).strip().lower(), DEFAULT_JUNCTION_RISK)
    mid_lat    = (u_lat + v_lat) / 2.0
    mid_lng    = (u_lng + v_lng) / 2.0
    acc_risk   = _node_blackspot_score(mid_lat, mid_lng, blackspots)
    risk = (0.20*hw_risk + 0.20*speed_risk + 0.15*light_risk +
            0.15*surf_risk + 0.10*junc_risk + 0.20*acc_risk)
    return float(np.clip(risk, 0.0, 1.0))

def _annotate_edges(G, blackspots):
    node_data = dict(G.nodes(data=True))
    for u, v, key, data in G.edges(keys=True, data=True):
        u_info = node_data.get(u, {})
        v_info = node_data.get(v, {})
        u_lat, u_lng = float(u_info.get("y",0)), float(u_info.get("x",0))
        v_lat, v_lng = float(v_info.get("y",0)), float(v_info.get("x",0))
        length_m = float(data.get("length", 50.0))
        risk     = _edge_risk_score(data, u_lat, u_lng, v_lat, v_lng, blackspots)
        G[u][v][key]["risk_score"]  = risk
        G[u][v][key]["safe_weight"] = length_m + (risk * RISK_PENALTY)

def _astar_heuristic(G):
    node_data = dict(G.nodes(data=True))
    def h(u, target):
        ui = node_data.get(u, {})
        ti = node_data.get(target, {})
        return _haversine_m(float(ui.get("y",0)), float(ui.get("x",0)),
                            float(ti.get("y",0)), float(ti.get("x",0)))
    return h

def _nearest_node(G, lat, lng):
    try:
        import osmnx as ox
        return ox.nearest_nodes(G, X=lng, Y=lat)
    except (ImportError, KeyError, ValueError):
        pass
    best_node, best_dist = None, float("inf")
    for node, data in G.nodes(data=True):
        d = _haversine_m(lat, lng, float(data.get("y",0)), float(data.get("x",0)))
        if d < best_dist:
            best_dist, best_node = d, node
    return best_node

def compute_safe_route(G, origin_lat, origin_lng, dest_lat, dest_lng,
                       risk_penalty=RISK_PENALTY, live_conditions=None):
    try:
        origin_node = _nearest_node(G, origin_lat, origin_lng)
        dest_node   = _nearest_node(G, dest_lat, dest_lng)
        if origin_node is None or dest_node is None:
            return {"success": False, "error": "Could not snap coordinates to graph nodes."}
        if origin_node == dest_node:
            return {"success": False, "error": "Origin and destination snap to the same node."}

        heuristic = _astar_heuristic(G)
        congestion, weather_risk = _live_conditions(live_conditions)

        def weight_fn(u, v, edge_dict):
            min_w = float("inf")
            for key, data in edge_dict.items():
                length = float(data.get("length", 50.0))
                base_risk = float(data.get("risk_score", 0.35))
                dynamic_risk = min(1.0, base_risk + 0.25 * weather_risk + 0.20 * congestion)
                w = length * (1.0 + 1.5 * congestion) + dynamic_risk * risk_penalty
                min_w = min(min_w, w)
            return min_w

        path_nodes = nx.astar_path(G, source=origin_node, target=dest_node,
                                   heuristic=heuristic, weight=weight_fn)

        node_data    = dict(G.nodes(data=True))
        route_coords = []
        for n in path_nodes:
            nd = node_data.get(n, {})
            route_coords.append([round(float(nd.get("y",0)),6),
                                  round(float(nd.get("x",0)),6)])

        total_dist_m, edge_risks = 0.0, []
        for i in range(len(path_nodes)-1):
            u, v = path_nodes[i], path_nodes[i+1]
            best_data, best_w = None, float("inf")
            for key, data in G[u][v].items():
                length = float(data.get("length", 50.0))
                base_risk = float(data.get("risk_score", 0.35))
                dynamic_risk = min(1.0, base_risk + 0.25 * weather_risk + 0.20 * congestion)
                w = length * (1.0 + 1.5 * congestion) + dynamic_risk * risk_penalty
                if w < best_w:
                    best_w, best_data = w, data
            if best_data:
                total_dist_m += float(best_data.get("length", 0))
                edge_risks.append(min(1.0, float(best_data.get("risk_score", 0.35)) +
                                      0.25 * weather_risk + 0.20 * congestion))

        avg_risk = float(np.mean(edge_risks)) if edge_risks else 0.0
        max_risk = float(np.max(edge_risks))  if edge_risks else 0.0

        return {
            "success":           True,
            "route_nodes":       [str(n) for n in path_nodes],
            "route_coords":      route_coords,
            "total_distance_m":  round(total_dist_m, 1),
            "total_distance_km": round(total_dist_m/1000.0, 3),
            "avg_risk_score":    round(avg_risk, 4),
            "max_risk_score":    round(max_risk, 4),
            "risk_level":        ("High" if avg_risk>=0.55 else "Medium" if avg_risk>=0.25 else "Low"),
            "num_waypoints":     len(path_nodes),
            "origin_node":       str(origin_node),
            "dest_node":         str(dest_node),
            "live_conditions":   {"congestion": round(congestion, 3), "weather_risk": round(weather_risk, 3)},
        }
    except nx.NetworkXNoPath:
        return {"success": False, "error": "No path found between origin and destination."}
    except nx.NodeNotFound as e:
        return {"success": False, "error": f"Node not found: {e}"}
    except Exception as e:
        log.exception("Routing error")
        return {"success": False, "error": str(e)}

def compare_routes(G, origin_lat, origin_lng, dest_lat, dest_lng, live_conditions=None):
    safe    = compute_safe_route(G, origin_lat, origin_lng, dest_lat, dest_lng,
                                 risk_penalty=RISK_PENALTY, live_conditions=live_conditions)
    shortest = compute_safe_route(G, origin_lat, origin_lng, dest_lat, dest_lng,
                                  risk_penalty=0, live_conditions=live_conditions)
    comparison = {}
    if safe.get("success") and shortest.get("success"):
        extra_m      = safe["total_distance_m"] - shortest["total_distance_m"]
        risk_cut     = shortest["avg_risk_score"] - safe["avg_risk_score"]
        comparison   = {
            "extra_distance_m":   round(extra_m, 1),
            "extra_distance_km":  round(extra_m/1000.0, 3),
            "risk_reduction":     round(risk_cut, 4),
            "risk_reduction_pct": round(risk_cut*100, 1),
            "recommendation": (
                "Safe route recommended" if risk_cut > 0.05
                else "Routes are similar — shortest path is fine"
            ),
        }
    return {"safe_route": safe, "short_route": shortest, "comparison": comparison}

_G: Optional[nx.MultiDiGraph] = None

def get_graph():
    global _G
    if _G is None:
        _G = load_graph()
    return _G

