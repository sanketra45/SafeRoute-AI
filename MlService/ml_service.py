"""
SafeRoute AI — ML Microservice
================================
Port: 5001
Called by: Spring Boot MlService.java

Endpoints:
  GET  /health        → readiness check
  POST /predict-risk  → risk prediction
  POST /safe-route    → A* safe + fast route comparison
  GET  /geocode       → Photon geocoding proxy

EXACT encoder classes from trained model:
  le_weather : ['Clear', 'Cloudy', 'Fog', 'Haze', 'Rain']
  le_road    : ['City Road', 'Flyover', 'Highway', 'Junction', 'Ring Road', 'Urban']
  le_density : ['High', 'Low', 'Medium']
  le_risk    : ['High', 'Low', 'Medium']

EXACT feature order the model was trained on:
  latitude, longitude, time_of_day, weather_enc, road_enc,
  density_enc, accident_count, is_night, is_peak, is_bad_weather
"""

import os, pathlib, logging, threading, json
from datetime import datetime

# Load .env
_env = pathlib.Path(__file__).parent / ".env"
if _env.exists():
    for line in _env.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib, numpy as np, pandas as pd

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://localhost:8080", "http://localhost:3000"])

BASE = pathlib.Path(__file__).parent

# ─────────────────────────────────────────────────────────
# MODEL LOADING
# ─────────────────────────────────────────────────────────
MODEL_LOADED = False
model = le_weather = le_road = le_density = le_risk = None
MODEL_META = {}

def load_model():
    global model, le_weather, le_road, le_density, le_risk, MODEL_LOADED, MODEL_META
    try:
        model      = joblib.load(BASE / "model.pkl")
        le_weather = joblib.load(BASE / "le_weather.pkl")
        le_road    = joblib.load(BASE / "le_road.pkl")
        le_density = joblib.load(BASE / "le_density.pkl")
        le_risk    = joblib.load(BASE / "le_risk.pkl")
        MODEL_LOADED = True

        meta_path = BASE / "model_metadata.json"
        if meta_path.exists():
            with open(meta_path) as f:
                MODEL_META = json.load(f)

        log.info("[OK] Model loaded | accuracy=%.2f%% | classes=%s",
                 MODEL_META.get("accuracy", 0) * 100,
                 list(le_risk.classes_))
    except Exception as e:
        MODEL_LOADED = False
        log.error("[FAIL] Model load failed: %s", e)
        log.error("       Run: python ml_model.py  to generate model.pkl")

load_model()

# ─────────────────────────────────────────────────────────
# GRAPH LOADING (lazy, background)
# ─────────────────────────────────────────────────────────
_router_graph = None
_graph_loading = False
_graph_error   = None

def _load_graph_bg():
    global _router_graph, _graph_loading, _graph_error
    _graph_loading = True
    try:
        from risk_router import load_graph
        log.info("[ROUTER] Loading Nagpur road network ...")
        _router_graph = load_graph()
        log.info("[ROUTER] Ready: %d nodes, %d edges",
                 _router_graph.number_of_nodes(),
                 _router_graph.number_of_edges())
        _graph_error = None
    except FileNotFoundError as e:
        _graph_error = str(e)
        log.error("[ROUTER] GraphML missing: %s", e)
        log.error("         Run: python download_nagpur_graph.py")
    except Exception as e:
        _graph_error = str(e)
        log.error("[ROUTER] Load failed: %s", e)
    finally:
        _graph_loading = False

threading.Thread(target=_load_graph_bg, daemon=True).start()

def _get_graph():
    return _router_graph

# ─────────────────────────────────────────────────────────
# LABEL NORMALISATION MAPS
# These map Spring Boot's DTO values → exact encoder classes
# ─────────────────────────────────────────────────────────

# Spring Boot sends: CLEAR, RAIN, FOG, CLOUDY, HAZE (uppercase)
# Model expects:     Clear, Cloudy, Fog, Haze, Rain
WEATHER_MAP = {
    "CLEAR": "Clear", "CLOUDY": "Cloudy", "FOG": "Fog",
    "HAZE": "Haze",   "RAIN": "Rain",
    # Also accept title-case and lowercase
    "Clear": "Clear", "Cloudy": "Cloudy", "Fog": "Fog",
    "Haze": "Haze",   "Rain": "Rain",
    "clear": "Clear", "cloudy": "Cloudy", "fog": "Fog",
    "haze": "Haze",   "rain": "Rain",
}

# Spring Boot sends: MAIN_ROAD, RESIDENTIAL, HIGHWAY, JUNCTION, FLYOVER, RING_ROAD, URBAN
# Model expects:     City Road, Flyover, Highway, Junction, Ring Road, Urban
ROAD_MAP = {
    "MAIN_ROAD": "City Road",   "RESIDENTIAL": "City Road",
    "CITY_ROAD": "City Road",   "HIGHWAY": "Highway",
    "JUNCTION": "Junction",     "FLYOVER": "Flyover",
    "RING_ROAD": "Ring Road",   "URBAN": "Urban",
    # Also accept model's exact values
    "City Road": "City Road",   "Highway": "Highway",
    "Junction": "Junction",     "Flyover": "Flyover",
    "Ring Road": "Ring Road",   "Urban": "Urban",
}

# Spring Boot sends: LOW, MEDIUM, HIGH
# Model expects:     High, Low, Medium (LabelEncoder sorts alphabetically)
DENSITY_MAP = {
    "HIGH": "High", "MEDIUM": "Medium", "LOW": "Low",
    "High": "High", "Medium": "Medium", "Low": "Low",
    "high": "High", "medium": "Medium", "low": "Low",
}

# ─────────────────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────────────────
def _safe_encode(encoder, value, fallback, field_name):
    """Encode with a clear error if value not in encoder classes."""
    try:
        return int(encoder.transform([value])[0])
    except ValueError:
        log.warning("[ENCODE] Unknown %s='%s', using fallback='%s'. Valid: %s",
                    field_name, value, fallback, list(encoder.classes_))
        return int(encoder.transform([fallback])[0])

# ─────────────────────────────────────────────────────────
# GET /health
# ─────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    G = _get_graph()
    return jsonify({
        "status":        "ok",
        "model_loaded":  MODEL_LOADED,
        "model_accuracy": MODEL_META.get("accuracy", 0),
        "graph_loaded":  G is not None,
        "graph_loading": _graph_loading,
        "graph_error":   _graph_error,
        "graph_nodes":   G.number_of_nodes() if G else 0,
        "graph_edges":   G.number_of_edges() if G else 0,
        "encoder_classes": {
            "weather":  list(le_weather.classes_) if MODEL_LOADED else [],
            "road":     list(le_road.classes_)    if MODEL_LOADED else [],
            "density":  list(le_density.classes_) if MODEL_LOADED else [],
            "risk":     list(le_risk.classes_)    if MODEL_LOADED else [],
        }
    })

# ─────────────────────────────────────────────────────────
# POST /predict
# Called by Spring Boot MlService.predictRisk()
#
# Request  (Spring Boot RiskRequest DTO - camelCase):
#   { "latitude":21.1458, "longitude":79.0882,
#     "timeOfDay":"NIGHT", "weatherCondition":"RAIN",
#     "trafficDensity":"HIGH", "roadType":"MAIN_ROAD" }
#
# Response (Spring Boot RiskResponse DTO):
#   { "riskLevel":"HIGH", "confidence":0.85, "message":"..." }
# ─────────────────────────────────────────────────────────
@app.route("/predict-risk", methods=["POST"])
def predict():
    if not MODEL_LOADED:
        return jsonify({"error": "Model not loaded. Run: python ml_model.py"}), 503

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    # 1. Coordinates (required)
    try:
        lat = float(data["latitude"])
        lng = float(data["longitude"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "'latitude' and 'longitude' are required numeric fields"}), 400

    # 2. Time of day → hour integer
    tod_raw = data.get("timeOfDay") or data.get("time_of_day")
    TOD_TO_HOUR = {
        "MORNING_PEAK": 9, "MORNING": 9,
        "DAY": 13,
        "EVENING_PEAK": 18, "EVENING": 18,
        "NIGHT": 22,
    }
    if tod_raw:
        hour = TOD_TO_HOUR.get(str(tod_raw).upper(), datetime.now().hour)
    else:
        hour = datetime.now().hour  # auto-derive (your original behaviour)

    # 3. Weather — normalise to model's exact label
    weather_raw  = str(data.get("weatherCondition") or data.get("weather") or "Clear")
    weather_label = WEATHER_MAP.get(weather_raw, "Clear")

    # 4. Traffic density — normalise
    density_raw  = str(data.get("trafficDensity") or data.get("traffic_density") or "Low")
    density_label = DENSITY_MAP.get(density_raw, "Low")

    # 5. Road type — normalise
    road_raw  = str(data.get("roadType") or data.get("road_type") or "City Road")
    road_label = ROAD_MAP.get(road_raw, "City Road")

    # 6. Encode — using exact classes from trained model
    w_enc = _safe_encode(le_weather, weather_label, "Clear",     "weather")
    r_enc = _safe_encode(le_road,    road_label,    "City Road", "road_type")
    d_enc = _safe_encode(le_density, density_label, "Low",       "traffic_density")

    accident_count = int(data.get("accidentCount") or data.get("accident_count") or 5)

    # 7. Build feature DataFrame — EXACT same column names & order as training
    features = pd.DataFrame([{
        "latitude":       lat,
        "longitude":      lng,
        "time_of_day":    hour,
        "weather_enc":    w_enc,
        "road_enc":       r_enc,
        "density_enc":    d_enc,
        "accident_count": accident_count,
        "is_night":       1 if (hour >= 20 or hour <= 5) else 0,
        "is_peak":        1 if ((8 <= hour <= 10) or (17 <= hour <= 20)) else 0,
        "is_bad_weather": 1 if weather_label in ("Rain", "Fog", "Haze") else 0,
    }])

    # 8. Inference
    try:
        probas   = model.predict_proba(features)[0]
        classes  = list(le_risk.classes_)          # ['High', 'Low', 'Medium']
        pred_idx = int(np.argmax(probas))
        risk_raw = classes[pred_idx]               # e.g. 'High'
        confidence = float(probas[pred_idx])
    except Exception as e:
        log.exception("Inference error")
        return jsonify({"error": f"Inference failed: {e}"}), 500

    # 9. Map to Spring Boot's DTO format (uppercase)
    risk_level_out = risk_raw.upper()   # 'HIGH' / 'LOW' / 'MEDIUM'

    MESSAGES = {
        "HIGH":   "High risk detected at this location. Please consider an alternate route.",
        "MEDIUM": "Moderate risk. Drive with caution at this location.",
        "LOW":    "Low risk area. Road conditions are generally safe.",
    }

    log.info("[PREDICT] lat=%.4f lng=%.4f hour=%d weather=%s road=%s density=%s → %s (%.1f%%)",
             lat, lng, hour, weather_label, road_label, density_label,
             risk_level_out, confidence * 100)

    return jsonify({
        "riskLevel":  risk_level_out,         # matches Spring Boot RiskResponse
        "confidence": round(confidence, 4),
        "message":    MESSAGES[risk_level_out],
        "debug": {
            "probabilities": {
                c.upper(): round(float(p), 4)
                for c, p in zip(classes, probas)
            },
            "inputsUsed": {
                "latitude": lat, "longitude": lng, "hour": hour,
                "weather": weather_label, "roadType": road_label,
                "trafficDensity": density_label, "accidentCount": accident_count,
            }
        }
    })


# ─────────────────────────────────────────────────────────
# POST /safe-route
# Called by Spring Boot MlService.getSafeRoute()
#
# Request  (Spring Boot RouteRequest DTO):
#   { "originLat":21.1481, "originLon":79.0862,
#     "destLat":21.17, "destLon":79.09 }
#
# Response (Spring Boot RouteResponse DTO):
#   { "safeRoute":[{"lat":21.14,"lon":79.08},...],
#     "fastRoute":[...], "safeDistance":2340.5,
#     "fastDistance":1800.0, "safeRiskScore":0.21,
#     "fastRiskScore":0.47, "message":"..." }
# ─────────────────────────────────────────────────────────
@app.route("/safe-route", methods=["POST"])
def safe_route():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    try:
        origin_lat = float(data["originLat"])
        origin_lon = float(data["originLon"])
        dest_lat   = float(data["destLat"])
        dest_lon   = float(data["destLon"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "originLat, originLon, destLat, destLon are required numeric fields"}), 400

    G = _get_graph()
    if G is None:
        return jsonify({
            "error":        "Road network graph not yet loaded. Retry in a few seconds.",
            "graphLoading": _graph_loading,
            "graphError":   _graph_error,
        }), 503

    try:
        from risk_router import compare_routes
        result = compare_routes(G, origin_lat, origin_lon, dest_lat, dest_lon, {
            "traffic": data.get("traffic"),
            "weather": data.get("weather"),
        })
    except Exception as e:
        log.exception("Routing error")
        return jsonify({"error": f"Routing failed: {e}"}), 500

    safe   = result.get("safe_route", {})
    fast   = result.get("short_route", {})
    comp   = result.get("comparison", {})

    if not safe.get("success"):
        return jsonify({"error": safe.get("error", "Safe route not found")}), 422
    if not fast.get("success"):
        return jsonify({"error": fast.get("error", "Fast route not found")}), 422

    # Convert [[lat,lon],...] → [{"lat":..,"lon":..},...]  (Spring Boot Coordinate DTO)
    def to_coords(lst):
        return [{"lat": c[0], "lon": c[1]} for c in lst]

    extra_km  = comp.get("extra_distance_km", 0)
    risk_cut  = comp.get("risk_reduction_pct", 0)
    rec       = comp.get("recommendation", "Safe route recommended")
    message   = (f"Safe route is {extra_km:.2f} km longer but reduces risk "
                 f"by {risk_cut:.1f}%. {rec}.")

    log.info("[ROUTE] (%.4f,%.4f)→(%.4f,%.4f) safe=%.2fkm fast=%.2fkm",
             origin_lat, origin_lon, dest_lat, dest_lon,
             safe["total_distance_km"], fast["total_distance_km"])

    return jsonify({
        "safeRoute":     to_coords(safe["route_coords"]),
        "fastRoute":     to_coords(fast["route_coords"]),
        "safeDistance":  safe["total_distance_m"],
        "fastDistance":  fast["total_distance_m"],
        "safeRiskScore": safe["avg_risk_score"],
        "fastRiskScore": fast["avg_risk_score"],
        "message":       message,
        "comparison":    comp,
        "liveConditions": safe.get("live_conditions", {}),
    })


# ─────────────────────────────────────────────────────────
# GET /geocode  (Photon proxy — same as your original app.py)
# ─────────────────────────────────────────────────────────
import requests as req_lib

_geocode_cache = {}

@app.route("/geocode", methods=["GET"])
def geocode_proxy():
    q = request.args.get("q", "").strip()
    if not q or len(q) < 2:
        return jsonify([])
    limit     = min(int(request.args.get("limit", 8)), 15)
    cache_key = f"{q.lower()}:{limit}"
    if cache_key in _geocode_cache:
        return jsonify(_geocode_cache[cache_key])

    results = _photon(q, limit)
    if not results and "nagpur" not in q.lower():
        results = _photon(f"{q} Nagpur", limit)
    _geocode_cache[cache_key] = results
    return jsonify(results)

def _photon(query, n=8):
    try:
        resp = req_lib.get(
            "https://photon.komoot.io/api/",
            params={"q": query, "limit": n * 2, "lang": "en",
                    "lat": "21.1458", "lon": "79.0882"},
            headers={"Accept-Language": "en;q=0.9"}, timeout=7,
        )
        resp.raise_for_status()
        out = []
        for f in resp.json().get("features", []):
            props  = f.get("properties", {})
            coords = f.get("geometry", {}).get("coordinates", [])
            if len(coords) < 2: continue
            lon_r, lat_r = float(coords[0]), float(coords[1])
            if abs(lat_r - 21.1458) > 2.5 or abs(lon_r - 79.0882) > 2.5: continue
            name  = props.get("name", "")
            city  = props.get("city") or props.get("town") or ""
            state = props.get("state", "")
            parts = list(dict.fromkeys(p for p in [name, city, state, "India"] if p))
            out.append({"display_name": ", ".join(parts),
                        "lat": str(lat_r), "lon": str(lon_r)})
            if len(out) >= n: break
        return out
    except Exception as e:
        log.warning("[PHOTON] %s", e)
        return []


# ─────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("ML_SERVICE_PORT", 5001))
    log.info("=" * 55)
    log.info(" SafeRoute AI — ML Microservice  (port %d)", port)
    log.info(" Model accuracy : %.2f%%", MODEL_META.get("accuracy", 0) * 100)
    log.info(" Endpoints:")
    log.info("   GET  /health")
    log.info("   POST /predict-risk")
    log.info("   POST /safe-route")
    log.info("   GET  /geocode?q=<text>")
    log.info("=" * 55)
    app.run(host="0.0.0.0", port=port, debug=False)
