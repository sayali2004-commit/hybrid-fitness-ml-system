"""Run the trained models against a user profile.

``predict_profile`` is the only entry point the API server uses. It never
hard-codes an answer: the habit category comes from the Random Forest
probabilities and the workout suggestions come from the KNN neighbour vote.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from .config import (
    HABIT_CATEGORY_META,
    KNN_CATEGORICAL_FEATURES,
    KNN_NUMERIC_FEATURES,
    RF_FEATURES,
    WORKOUT_CATEGORY_META,
)
from .features import profile_to_features
from .labels import habit_meta, recommendation_reason, workout_meta

TOP_RECOMMENDATIONS = 3


def _habit_payload(classifier, frame: pd.DataFrame) -> Dict[str, Any]:
    probabilities = classifier.predict_proba(frame[RF_FEATURES])[0]
    classes = list(classifier.named_steps["clf"].classes_)
    pairs = sorted(
        (
            {
                "category": str(cls),
                "label": habit_meta(str(cls))["label"],
                "tone": habit_meta(str(cls))["tone"],
                "value": round(float(value), 4),
            }
            for cls, value in zip(classes, probabilities)
        ),
        key=lambda item: item["value"],
        reverse=True,
    )
    best = pairs[0]
    meta = HABIT_CATEGORY_META.get(best["category"], {})
    return {
        "category": best["category"],
        "label": meta.get("label", best["category"]),
        "tone": meta.get("tone", "warn"),
        "summary": meta.get("summary", ""),
        "confidence": best["value"],
        "probabilities": pairs,
    }


def _recommendation_payload(recommender, frame: pd.DataFrame, context: Dict[str, Any]) -> Dict[str, Any]:
    knn_features = KNN_NUMERIC_FEATURES + KNN_CATEGORICAL_FEATURES
    matrix = recommender.named_steps["prep"].transform(frame[knn_features])
    model = recommender.named_steps["clf"]
    probabilities = model.predict_proba(matrix)[0]
    classes = list(model.classes_)

    ranked = sorted(
        (
            {"category": str(cls), "value": float(value)}
            for cls, value in zip(classes, probabilities)
        ),
        key=lambda item: item["value"],
        reverse=True,
    )

    distances, indices = model.kneighbors(matrix)
    neighbour_labels: List[str] = []
    train = context.get("recommendationTrain")
    if train is not None and len(train):
        neighbour_labels = [
            str(train.iloc[int(i)]["recommended_category"]) for i in indices[0]
        ]

    recommendations = []
    for rank, item in enumerate(ranked[:TOP_RECOMMENDATIONS], start=1):
        meta = workout_meta(item["category"])
        recommendations.append(
            {
                "rank": rank,
                "category": item["category"],
                "label": meta.get("label", item["category"]),
                "focus": meta.get("focus", ""),
                "summary": meta.get("summary", ""),
                "match": round(item["value"], 4),
                "reason": recommendation_reason(item["category"], frame.iloc[0].to_dict()),
            }
        )

    return {
        "recommendations": recommendations,
        "neighbours": {
            "count": int(len(indices[0])),
            "labels": neighbour_labels,
            "distances": [round(float(d), 3) for d in distances[0]],
        },
    }


def predict_profile(
    profile: Dict[str, Any],
    artifacts: Dict[str, Any],
) -> Dict[str, Any]:
    """Classify the habit profile and recommend workout categories."""
    classifier = artifacts["classifier"]
    recommender = artifacts["recommender"]
    context = artifacts.get("context", {}) or {}

    frame, assumed = profile_to_features(profile)

    habit = _habit_payload(classifier, frame)
    recommendation = _recommendation_payload(recommender, frame, context)

    metrics = artifacts.get("metrics", {})
    return {
        "status": "ok",
        "habit": habit,
        "recommendations": recommendation["recommendations"],
        "neighbours": recommendation["neighbours"],
        "assumedFields": assumed,
        "model": {
            "classifier": metrics.get("classifier", {}).get("name", "RandomForestClassifier"),
            "recommender": metrics.get("recommender", {}).get("name", "KNeighborsClassifier"),
            "trainedAt": metrics.get("trainedAt"),
            "datasetRows": metrics.get("dataset", {}).get("rows"),
            "classifierAccuracy": metrics.get("classifier", {}).get("metrics", {}).get("accuracy"),
            "recommenderAccuracy": metrics.get("recommender", {}).get("metrics", {}).get("accuracy"),
            "classifierCvAccuracy": metrics.get("classifier", {}).get("cvAccuracyMean"),
            "recommenderCvAccuracy": metrics.get("recommender", {}).get("cvAccuracyMean"),
        },
    }


def default_profile() -> Dict[str, Any]:
    """A neutral profile used by the demo button in the dashboard."""
    return {
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
