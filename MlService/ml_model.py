"""
SafeRoute AI - Random Forest Accident Risk Prediction Model
===========================================================
Exact column names matching your original ml_model.py:
  weather, road_type, traffic_density, risk_level, time_of_day, accident_count

Run:  python ml_model.py
Output: model.pkl, le_weather.pkl, le_road.pkl, le_density.pkl, le_risk.pkl,
        nagpur_accident_dataset.csv, model_metadata.json
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
import joblib
import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))

# ─────────────────────────────────────────────────────────────────────────────
# 1.  NAGPUR LOCATIONS  (20 real locations from your original)
# ─────────────────────────────────────────────────────────────────────────────
LOCATIONS = [
    ("Sitabuldi Junction",    21.1458, 79.0882),
    ("Wardha Road",           21.0900, 79.0600),
    ("Hingna T Point",        21.1000, 78.9800),
    ("Chatrapati Square",     21.1205, 79.0951),
    ("Ravi Nagar",            21.1350, 79.0550),
    ("Dharampeth",            21.1300, 79.0700),
    ("Civil Lines",           21.1520, 79.0850),
    ("Trimurti Nagar",        21.1450, 79.0480),
    ("Pratap Nagar",          21.1150, 79.0520),
    ("Zero Mile",             21.1462, 79.0876),
    ("Itwari",                21.1578, 79.1012),
    ("Sadar",                 21.1503, 79.0813),
    ("Nandanvan",             21.1300, 79.1200),
    ("Mankapur",              21.1200, 79.0400),
    ("Nagpur Railway Stn",    21.1459, 79.0850),
    ("Ambazari",              21.1264, 78.9893),
    ("Beltarodi",             21.0700, 79.0300),
    ("Koradi",                21.2500, 79.0000),
    ("Butibori",              20.9700, 79.0500),
    ("MIDC Hingna",           21.0900, 79.0000),
]

# Exact values your encoders will be trained on — DO NOT CHANGE ORDER
WEATHERS   = ["Clear", "Rain", "Fog", "Cloudy", "Haze"]
ROAD_TYPES = ["Junction", "Highway", "City Road", "Urban", "Flyover", "Ring Road"]
DENSITIES  = ["Low", "Medium", "High"]

# ─────────────────────────────────────────────────────────────────────────────
# 2.  RISK SCORE FUNCTION  (identical to your original)
# ─────────────────────────────────────────────────────────────────────────────
def risk_score(hour, weather, road, density, accidents):
    s = 0
    if hour >= 20 or hour <= 5:  s += 2.5
    elif hour >= 17:             s += 1.2
    if weather == "Fog":         s += 2.0
    elif weather == "Rain":      s += 1.8
    elif weather == "Haze":      s += 1.2
    if road in ("Junction", "Flyover"): s += 2.0
    elif road == "Highway":             s += 1.5
    if density == "High":    s += 1.5
    elif density == "Medium": s += 0.7
    s += accidents * 0.12
    return s

# ─────────────────────────────────────────────────────────────────────────────
# 3.  GENERATE DATASET  — 2000 records for better model accuracy
# ─────────────────────────────────────────────────────────────────────────────
np.random.seed(42)
N = 2000

records = []
for i in range(N):
    loc     = LOCATIONS[i % len(LOCATIONS)]
    hour    = int(np.random.randint(0, 24))
    weather = str(np.random.choice(WEATHERS,    p=[0.35, 0.25, 0.15, 0.15, 0.10]))
    road    = str(np.random.choice(ROAD_TYPES,  p=[0.25, 0.20, 0.20, 0.15, 0.10, 0.10]))
    density = str(np.random.choice(DENSITIES,   p=[0.30, 0.40, 0.30]))
    accidents = int(np.random.poisson(4))
    score   = risk_score(hour, weather, road, density, accidents) + np.random.normal(0, 0.4)
    risk    = "High" if score >= 5.5 else ("Medium" if score >= 2.5 else "Low")

    records.append({
        "id":              i + 1,
        "location":        loc[0],
        "latitude":        round(loc[1] + np.random.uniform(-0.02, 0.02), 5),
        "longitude":       round(loc[2] + np.random.uniform(-0.02, 0.02), 5),
        "time_of_day":     hour,
        "weather":         weather,        # ← column name used in your app.py
        "road_type":       road,
        "traffic_density": density,
        "accident_count":  accidents,
        "risk_level":      risk,
    })

df = pd.DataFrame(records)
csv_path = os.path.join(BASE, "nagpur_accident_dataset.csv")
df.to_csv(csv_path, index=False)

print("=" * 60)
print(" SafeRoute AI — ML Model Training")
print("=" * 60)
print(f"\n[OK] Dataset generated: {csv_path}")
print(f"     Total records : {len(df)}")
print(f"     Columns       : {list(df.columns)}")
print(f"\n  Risk distribution:")
vc = df["risk_level"].value_counts()
for label, cnt in vc.items():
    print(f"    {label:<8} {cnt:>5}  ({cnt/len(df)*100:.1f}%)")

# ─────────────────────────────────────────────────────────────────────────────
# 4.  ENCODE LABELS
# ─────────────────────────────────────────────────────────────────────────────
le_weather = LabelEncoder()
le_road    = LabelEncoder()
le_density = LabelEncoder()
le_risk    = LabelEncoder()

df["weather_enc"] = le_weather.fit_transform(df["weather"])
df["road_enc"]    = le_road.fit_transform(df["road_type"])
df["density_enc"] = le_density.fit_transform(df["traffic_density"])
df["risk_enc"]    = le_risk.fit_transform(df["risk_level"])

# ← Derived features: IDENTICAL to your app.py predict() function
df["is_night"]       = ((df["time_of_day"] >= 20) | (df["time_of_day"] <= 5)).astype(int)
df["is_peak"]        = (((df["time_of_day"] >= 8)  & (df["time_of_day"] <= 10)) |
                        ((df["time_of_day"] >= 17) & (df["time_of_day"] <= 20))).astype(int)
df["is_bad_weather"] = df["weather"].isin(["Rain", "Fog", "Haze"]).astype(int)

# ← FEATURES list: IDENTICAL to your app.py predict() function
FEATURES = [
    "latitude", "longitude", "time_of_day",
    "weather_enc", "road_enc", "density_enc",
    "accident_count", "is_night", "is_peak", "is_bad_weather",
]

X = df[FEATURES]
y = df["risk_enc"]

print(f"\n[OK] Encoder classes:")
print(f"     weather  : {list(le_weather.classes_)}")
print(f"     road     : {list(le_road.classes_)}")
print(f"     density  : {list(le_density.classes_)}")
print(f"     risk     : {list(le_risk.classes_)}")

# ─────────────────────────────────────────────────────────────────────────────
# 5.  TRAIN / TEST SPLIT
# ─────────────────────────────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"\n[OK] Train: {len(X_train)} | Test: {len(X_test)}")

# ─────────────────────────────────────────────────────────────────────────────
# 6.  TRAIN RANDOM FOREST  (identical hyperparams to your original)
# ─────────────────────────────────────────────────────────────────────────────
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    min_samples_split=5,
    min_samples_leaf=2,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1,
)
print("\n[...] Training RandomForestClassifier ...")
model.fit(X_train, y_train)
print("[OK]  Training complete.")

# ─────────────────────────────────────────────────────────────────────────────
# 7.  EVALUATE
# ─────────────────────────────────────────────────────────────────────────────
y_pred = model.predict(X_test)
acc    = accuracy_score(y_test, y_pred)

# 5-fold cross-validation for a reliable accuracy estimate
cv_scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")

print(f"\n[OK] Test Accuracy  : {acc*100:.2f}%")
print(f"[OK] CV Accuracy    : {cv_scores.mean()*100:.2f}% ± {cv_scores.std()*100:.2f}%")
print(f"\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=le_risk.classes_))
print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

importances = dict(zip(FEATURES, model.feature_importances_))
print("\nFeature Importances:")
for feat, val in sorted(importances.items(), key=lambda x: -x[1]):
    bar = "#" * int(val * 50)
    print(f"  {feat:<22} {bar} {val:.4f}")

# ─────────────────────────────────────────────────────────────────────────────
# 8.  SAVE MODEL & ENCODERS
# ─────────────────────────────────────────────────────────────────────────────
joblib.dump(model,      os.path.join(BASE, "model.pkl"))
joblib.dump(le_weather, os.path.join(BASE, "le_weather.pkl"))
joblib.dump(le_road,    os.path.join(BASE, "le_road.pkl"))
joblib.dump(le_density, os.path.join(BASE, "le_density.pkl"))
joblib.dump(le_risk,    os.path.join(BASE, "le_risk.pkl"))

meta = {
    "accuracy":          round(float(acc), 4),
    "cv_accuracy_mean":  round(float(cv_scores.mean()), 4),
    "cv_accuracy_std":   round(float(cv_scores.std()), 4),
    "features":          FEATURES,
    "classes":           list(le_risk.classes_),
    "weather_classes":   list(le_weather.classes_),
    "road_classes":      list(le_road.classes_),
    "density_classes":   list(le_density.classes_),
    "n_estimators":      100,
    "max_depth":         10,
    "dataset_size":      N,
}
with open(os.path.join(BASE, "model_metadata.json"), "w") as f:
    json.dump(meta, f, indent=2)

print("\n[OK] Saved files:")
print("     model.pkl, le_weather.pkl, le_road.pkl, le_density.pkl, le_risk.pkl")
print("     nagpur_accident_dataset.csv, model_metadata.json")
print("\n[DONE] Run ml_service.py to start the microservice.")
