"""Automated tests for the Hybrid Fitness Intelligence Model.

Run them from the project root with::

    python -m pytest ml/tests -q
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.config import (  # noqa: E402
    HABIT_CATEGORY_META,
    MIN_TRAIN_ROWS,
    WORKOUT_CATEGORY_META,
    dataset_path,
)
from ml.dataset import inspect_dataset  # noqa: E402
from ml.features import profile_to_features  # noqa: E402
from ml.labels import label_habit_category, label_recommended_category  # noqa: E402
from ml.preprocess import (  # noqa: E402
    build_classifier_preprocessor,
    build_recommender_preprocessor,
)
from ml.config import (  # noqa: E402
    BINARY_FEATURES,
    CATEGORICAL_FEATURES,
    KNN_CATEGORICAL_FEATURES,
    KNN_NUMERIC_FEATURES,
    NUMERIC_FEATURES,
    RF_FEATURES,
)

DEMO_PROFILE = {
    "age": 27,
    "sex": "male",
    "height": 175,
    "weight": 76.8,
    "goal": "loss",
    "experience": "beginner",
    "daysPerWeek": 3,
    "sessionMinutes": 45,
    "equipment": "basic_gym",
    "activityLevel": "light",
    "workoutsPerWeek": 2,
    "skippedPerWeek": 1,
    "dietQuality": 5,
    "proteinMeals": 2,
    "junkFoodPerWeek": 4,
    "waterGlasses": 6,
    "sleepHours": 6.5,
    "steps": 5200,
    "motivation": 6,
    "screenBeforeBed": True,
    "tracksProgress": True,
    "preference": "auto",
}


# --------------------------------------------------------------------------- #
# Dataset
# --------------------------------------------------------------------------- #
def test_training_dataset_is_usable():
    df, report = inspect_dataset()
    assert report.exists, "the labelled training CSV must exist"
    assert report.sufficient, report.message
    assert report.rows >= MIN_TRAIN_ROWS
    for column in RF_FEATURES:
        assert column in df.columns, f"missing feature column: {column}"
    assert df["habit_category"].notna().all()
    assert df["recommended_category"].notna().all()
    assert set(df["habit_category"].unique()) <= set(HABIT_CATEGORY_META)
    assert set(df["recommended_category"].unique()) <= set(WORKOUT_CATEGORY_META)


def test_training_dataset_contains_missing_values():
    """The cohort must exercise the imputation path of the preprocessor."""
    df = pd.read_csv(dataset_path())
    assert df.isna().sum().sum() > 0, "the dataset should contain missing cells"


def test_insufficient_data_is_reported(tmp_path):
    tiny = tmp_path / "tiny.csv"
    tiny.write_text(
        "age,habit_category,recommended_category\n30,steady_improver,full_body_hybrid\n",
        encoding="utf-8",
    )
    _, report = inspect_dataset(tiny)
    assert not report.sufficient
    assert "rows" in report.message.lower() or "columns" in report.message.lower()
    assert report.issues


def test_label_rules_are_deterministic():
    assert label_habit_category(0, 3, 8, 9, 9, 3) == "sedentary_struggler"
    assert label_habit_category(4, 4, 8, 8, 9, 0) == "consistent_athlete"
    assert label_habit_category(6, 6, 5, 6, 4, 0) == "overtraining_risk"
    assert label_recommended_category("endurance", "intermediate", 2, 60, "cardio") == "endurance_base"
    assert label_recommended_category("muscle", "advanced", 5, 60, "strength") == "push_pull_strength"
    assert label_recommended_category("loss", "beginner", 2, 45, "cardio") == "full_body_hybrid"


# --------------------------------------------------------------------------- #
# Feature engineering + preprocessing
# --------------------------------------------------------------------------- #
def test_profile_maps_to_model_features():
    frame, assumed = profile_to_features(DEMO_PROFILE)
    assert len(frame) == 1
    for column in RF_FEATURES:
        assert column in frame.columns
    assert frame.loc[0, "fitness_goal"] == "loss"
    assert frame.loc[0, "experience_level"] == "beginner"
    assert frame.loc[0, "bmi"] == pytest.approx(25.1, abs=0.2)
    assert assumed == []


def test_profile_defaults_are_reported_when_fields_are_missing():
    frame, assumed = profile_to_features({"goal": "muscle"})
    assert "age" in assumed and "workoutsPerWeek" in assumed
    assert frame.loc[0, "fitness_goal"] == "muscle"
    assert not frame[RF_FEATURES].isna().any().any()


def test_preprocessor_imputes_missing_values():
    df = pd.read_csv(dataset_path())
    prep = build_classifier_preprocessor(
        NUMERIC_FEATURES, BINARY_FEATURES, CATEGORICAL_FEATURES
    )
    matrix = prep.fit_transform(df[RF_FEATURES])
    assert matrix.shape[0] == len(df)
    assert not np.isnan(matrix).any(), "no missing values may survive preprocessing"
    assert matrix.shape[1] > len(RF_FEATURES), "one-hot encoding must expand the features"


def test_knn_preprocessor_scales_numeric_features():
    df = pd.read_csv(dataset_path())
    knn_features = KNN_NUMERIC_FEATURES + KNN_CATEGORICAL_FEATURES
    prep = build_recommender_preprocessor(KNN_NUMERIC_FEATURES, KNN_CATEGORICAL_FEATURES)
    matrix = prep.fit_transform(df[knn_features])
    assert not np.isnan(matrix).any()
    numeric_block = matrix[:, : len(KNN_NUMERIC_FEATURES)]
    assert abs(float(np.mean(numeric_block))) < 0.6, "numeric features must be centred"
    assert float(np.max(np.abs(numeric_block))) < 6, "numeric features must be scaled"


# --------------------------------------------------------------------------- #
# Training + prediction
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="module")
def trained(tmp_path_factory):
    from ml.train import train_models

    df, report = inspect_dataset()
    assert report.sufficient, report.message
    classifier, recommender, metrics, context = train_models(df)
    return {
        "classifier": classifier,
        "recommender": recommender,
        "metrics": metrics,
        "context": context,
    }


def test_models_reach_useful_accuracy(trained):
    metrics = trained["metrics"]
    classifier = metrics["classifier"]
    recommender = metrics["recommender"]

    assert classifier["metrics"]["accuracy"] >= 0.70
    assert recommender["metrics"]["accuracy"] >= 0.65
    assert classifier["metrics"]["accuracy"] > classifier["majorityBaseline"]
    assert recommender["metrics"]["accuracy"] > recommender["majorityBaseline"]
    assert len(classifier["metrics"]["confusionMatrix"]) == len(HABIT_CATEGORY_META)
    assert recommender["top3HitRate"] >= recommender["metrics"]["accuracy"]
    assert classifier["topFeatures"], "feature importances must be reported"


def test_prediction_returns_class_and_recommendations(trained):
    from ml.predict import predict_profile

    result = predict_profile(DEMO_PROFILE, trained)
    assert result["status"] == "ok"
    assert result["habit"]["category"] in HABIT_CATEGORY_META
    assert 0.0 <= result["habit"]["confidence"] <= 1.0
    assert len(result["habit"]["probabilities"]) == len(HABIT_CATEGORY_META)
    assert sum(p["value"] for p in result["habit"]["probabilities"]) == pytest.approx(1.0, abs=1e-3)

    assert result["recommendations"]
    assert len(result["recommendations"]) == 3
    for item in result["recommendations"]:
        assert item["category"] in WORKOUT_CATEGORY_META
        assert 0.0 <= item["match"] <= 1.0
    matches = [item["match"] for item in result["recommendations"]]
    assert matches == sorted(matches, reverse=True)


def test_prediction_is_not_hardcoded(trained):
    """Two different profiles must not collapse to the same habit class."""
    from ml.predict import predict_profile

    sedentary = dict(
        DEMO_PROFILE,
        goal="health",
        workoutsPerWeek=0,
        skippedPerWeek=4,
        dietQuality=2,
        sleepHours=5,
        motivation=2,
        daysPerWeek=2,
    )
    athlete = dict(
        DEMO_PROFILE,
        goal="muscle",
        experience="advanced",
        workoutsPerWeek=5,
        skippedPerWeek=0,
        dietQuality=9,
        sleepHours=8,
        motivation=9,
        daysPerWeek=5,
    )
    first = predict_profile(sedentary, trained)["habit"]["category"]
    second = predict_profile(athlete, trained)["habit"]["category"]
    assert first != second


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="module")
def client(tmp_path_factory):
    from ml.serve import create_app

    app = create_app()
    app.config.update(TESTING=True)
    with app.test_client() as test_client:
        yield test_client


def test_api_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] in ("ok", "insufficient_data")
    assert "dataset" in payload


def test_api_predict(client):
    response = client.post("/api/predict", json={"profile": DEMO_PROFILE})
    assert response.status_code == 200
    payload = response.get_json()
    if payload["status"] == "insufficient_data":
        pytest.skip("the configured dataset is intentionally too small")
    assert payload["status"] == "ok"
    assert payload["habit"]["category"] in HABIT_CATEGORY_META
    assert payload["recommendations"]


def test_api_metrics(client):
    response = client.get("/api/metrics")
    assert response.status_code == 200
    payload = response.get_json()
    assert "classifier" in payload and "recommender" in payload


def test_api_reports_insufficient_data(monkeypatch, tmp_path):
    from ml import serve

    tiny = tmp_path / "tiny.csv"
    tiny.write_text(
        "age,habit_category,recommended_category\n30,steady_improver,full_body_hybrid\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("FHA_ML_DATASET", str(tiny))
    monkeypatch.setenv("FHA_ML_ARTIFACTS", str(tmp_path / "artifacts"))

    app = serve.create_app()
    with app.test_client() as test_client:
        health = test_client.get("/api/health").get_json()
        assert health["status"] == "insufficient_data"
        assert health["message"]

        response = test_client.post("/api/predict", json={"profile": DEMO_PROFILE})
        assert response.status_code == 200
        payload = response.get_json()
        assert payload["status"] == "insufficient_data"
        assert payload["message"]


def test_static_frontend_is_served(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"Fitness Habit Analysis" in response.data


def test_root_entrypoint_exposes_a_wsgi_app(monkeypatch):
    """app.py is the entrypoint Vercel looks for — it must expose `app`."""
    import importlib.util

    monkeypatch.delenv("FHA_ML_READONLY", raising=False)
    spec = importlib.util.spec_from_file_location(
        "fha_entrypoint", PROJECT_ROOT / "app.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert callable(module.app)
    with module.app.test_client() as entrypoint_client:
        response = entrypoint_client.get("/")
        assert response.status_code == 200
        assert b"Fitness Habit Analysis" in response.data
        health = entrypoint_client.get("/api/health")
        assert health.status_code == 200
        assert health.get_json()["status"] in ("ok", "insufficient_data")


def test_readonly_deployment_trains_in_memory(monkeypatch, tmp_path):
    """On a read-only file system the model is fitted in memory, not written."""
    from ml.train import ensure_model

    artifacts, report = ensure_model(quick=True, persist=False)
    assert report.sufficient
    assert artifacts is not None
    assert artifacts["classifier"] is not None
    assert artifacts["recommender"] is not None
