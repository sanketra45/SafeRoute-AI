"""Train SafeRoute's risk model from the canonical blackspot dataset.

The project currently has 20 independently supplied blackspot records.  This
script deliberately does not manufacture variants of those records: doing so
would cause data leakage and misleading accuracy figures.
"""

import json
import os
import shutil
import sys

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

BASE = os.path.dirname(os.path.abspath(__file__))
SOURCE_CSV = os.path.join(BASE, "nagpur_accident_dataset.csv")
TRAINING_CSV = os.path.join(BASE, "nagpur_accident_training_data.csv")
REQUIRED_COLUMNS = {
    "id", "location", "latitude", "longitude", "time_of_day", "weather",
    "road_type", "traffic_density", "accident_count", "risk_level",
}
FEATURES = [
    "latitude", "longitude", "time_of_day", "weather_enc", "road_enc",
    "density_enc", "accident_count", "is_night", "is_peak", "is_bad_weather",
]


def fail(message):
    print(f"[ERROR] {message}", file=sys.stderr)
    raise SystemExit(1)


def load_clean_blackspots(path):
    if not os.path.exists(path):
        fail(f"Canonical blackspot dataset is missing: {path}")
    try:
        raw = pd.read_csv(path)
    except Exception as exc:
        fail(f"Could not read canonical blackspot dataset: {exc}")

    missing = REQUIRED_COLUMNS - set(raw.columns)
    if missing:
        fail(f"Canonical dataset is missing required columns: {', '.join(sorted(missing))}")

    raw_count = len(raw)
    clean = raw.drop_duplicates().copy()
    exact_duplicates = raw_count - len(clean)

    # `id` is the dataset's explicit blackspot identity.  Do not silently
    # collapse conflicting records with the same id; that requires source-data
    # correction, not automated guessing.
    duplicate_ids = clean[clean.duplicated(subset=["id"], keep=False)]
    if not duplicate_ids.empty:
        fail("Canonical dataset contains conflicting duplicate blackspot ids: "
             + ", ".join(map(str, sorted(duplicate_ids["id"].unique()))))

    clean = clean.dropna(subset=REQUIRED_COLUMNS).copy()
    numeric_columns = ["latitude", "longitude", "time_of_day", "accident_count"]
    for column in numeric_columns:
        clean[column] = pd.to_numeric(clean[column], errors="coerce")
    clean = clean.dropna(subset=numeric_columns)
    clean = clean[clean["latitude"].between(-90, 90) & clean["longitude"].between(-180, 180)]
    if clean.empty:
        fail("No valid blackspot records remain after validation")
    return raw_count, exact_duplicates, clean.reset_index(drop=True)


def write_training_data(clean):
    # Preserve the pre-fix generated file exactly once for auditability before
    # replacing it with the deterministic cleaned output.
    if os.path.exists(TRAINING_CSV):
        backup = TRAINING_CSV + ".pre_dedup_backup"
        if not os.path.exists(backup):
            shutil.copy2(TRAINING_CSV, backup)
            print(f"[OK] Backed up previous training data: {backup}")
    clean.to_csv(TRAINING_CSV, index=False)


def main():
    original_count, exact_duplicates, df = load_clean_blackspots(SOURCE_CSV)
    write_training_data(df)
    print("=" * 60)
    print(" SafeRoute AI - ML Model Training")
    print("=" * 60)
    print(f"[OK] Original source rows       : {original_count}")
    print(f"[OK] Unique blackspot records  : {len(df)}")
    print(f"[OK] Exact duplicate rows removed: {exact_duplicates}")
    print(f"[OK] Final cleaned row count    : {len(df)}")
    print("[WARN] Only 20 independent blackspot records are available; evaluation is exploratory, not production-grade.")

    le_weather, le_road, le_density, le_risk = (LabelEncoder() for _ in range(4))
    df["weather_enc"] = le_weather.fit_transform(df["weather"])
    df["road_enc"] = le_road.fit_transform(df["road_type"])
    df["density_enc"] = le_density.fit_transform(df["traffic_density"])
    df["risk_enc"] = le_risk.fit_transform(df["risk_level"])
    df["is_night"] = ((df["time_of_day"] >= 20) | (df["time_of_day"] <= 5)).astype(int)
    df["is_peak"] = (((df["time_of_day"] >= 8) & (df["time_of_day"] <= 10)) |
                     ((df["time_of_day"] >= 17) & (df["time_of_day"] <= 20))).astype(int)
    df["is_bad_weather"] = df["weather"].isin(["Rain", "Fog", "Haze"]).astype(int)

    class_counts = df["risk_enc"].value_counts()
    if len(df) < 10 or class_counts.min() < 2:
        fail("Insufficient independent records for a stratified train/test split")
    X, y = df[FEATURES], df["risk_enc"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
    model = RandomForestClassifier(
        n_estimators=100, max_depth=10, min_samples_split=5, min_samples_leaf=2,
        class_weight="balanced", random_state=42, n_jobs=-1,
    )
    model.fit(X_train, y_train)
    accuracy = accuracy_score(y_test, model.predict(X_test))
    print(f"[OK] Train: {len(X_train)} | Test: {len(X_test)} | Exploratory accuracy: {accuracy:.2%}")
    print(classification_report(y_test, model.predict(X_test), target_names=le_risk.classes_, zero_division=0))

    for name, value in (("model.pkl", model), ("le_weather.pkl", le_weather), ("le_road.pkl", le_road),
                        ("le_density.pkl", le_density), ("le_risk.pkl", le_risk)):
        joblib.dump(value, os.path.join(BASE, name))
    with open(os.path.join(BASE, "model_metadata.json"), "w", encoding="utf-8") as out:
        json.dump({"accuracy": round(float(accuracy), 4), "features": FEATURES,
                   "classes": list(le_risk.classes_), "dataset_size": len(df),
                   "training_data_limitation": "20 independent blackspot records; no synthetic duplication."}, out, indent=2)
    print("[DONE] Model and encoders saved.")


if __name__ == "__main__":
    main()
