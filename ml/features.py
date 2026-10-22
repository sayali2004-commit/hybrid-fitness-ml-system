"""Profile payload → model feature frame.

The browser sends the profile exactly as it is stored in ``localStorage``
(``assets/js/app.js`` → ``readProfileForm``). This module translates that
payload into the feature frame the trained pipelines expect, applies sane
defaults for anything the browser did not send and reports which values had to
be assumed, so the UI can stay transparent about it.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

import pandas as pd

from .config import (
    ACTIVITY_MAP,
    EQUIPMENT_MAP,
    EXPERIENCE_MAP,
    GOAL_MAP,
    PREFERRED_FOCUS,
)

#: Values used when the browser sends nothing for a field.
DEFAULTS: Dict[str, Any] = {
    "age": 30,
    "sex": "other",
    "height": 170.0,
    "weight": 70.0,
    "goal": "health",
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
    "sleepHours": 7,
    "steps": 6000,
    "motivation": 5,
    "screenBeforeBed": False,
    "tracksProgress": False,
    "preference": "auto",
}

NUMERIC_FIELDS = {
    "age": "age",
    "height": "height_cm",
    "weight": "weight_kg",
    "daysPerWeek": "planned_days_per_week",
    "workoutsPerWeek": "workouts_per_week",
    "skippedPerWeek": "skipped_per_week",
    "sessionMinutes": "session_minutes",
    "dietQuality": "diet_quality",
    "proteinMeals": "protein_meals",
    "junkFoodPerWeek": "junk_food_per_week",
    "waterGlasses": "water_glasses",
    "sleepHours": "sleep_hours",
    "steps": "daily_steps",
    "motivation": "motivation",
}


def _as_float(value: Any, fallback: float) -> Tuple[float, bool]:
    if value is None or value == "":
        return float(fallback), True
    try:
        return float(value), False
    except (TypeError, ValueError):
        return float(fallback), True


def _as_bool(value: Any, fallback: bool) -> bool:
    if value is None or value == "":
        return fallback
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def derive_preference(
    goal: str,
    experience: str,
    workouts_per_week: float,
    session_minutes: float,
) -> str:
    """Fallback used when the user did not pick a training preference."""
    if goal == "endurance":
        return "cardio"
    if goal == "muscle":
        return "strength"
    if goal == "loss":
        return "hiit" if workouts_per_week >= 4 else "cardio"
    if session_minutes <= 45:
        return "mobility"
    return "strength" if experience in ("intermediate", "advanced") else "mobility"


def profile_to_features(profile: Dict[str, Any]) -> Tuple[pd.DataFrame, List[str]]:
    """Convert a browser profile into a one-row model feature frame.

    Returns the frame plus the list of fields that had to be defaulted.
    """
    profile = profile or {}
    assumed: List[str] = []

    def pick(key: str):
        value = profile.get(key, None)
        if value is None or value == "":
            assumed.append(key)
            return DEFAULTS[key]
        return value

    features: Dict[str, Any] = {}

    for field, column in NUMERIC_FIELDS.items():
        number, missing = _as_float(pick(field), DEFAULTS[field])
        if missing:
            assumed.append(field)
        features[column] = number

    sex = str(pick("sex")).strip().lower()
    features["sex"] = sex if sex in ("male", "female", "other") else "other"

    goal = GOAL_MAP.get(str(pick("goal")).strip().lower(), "health")
    features["fitness_goal"] = goal

    experience = EXPERIENCE_MAP.get(str(pick("experience")).strip().lower(), "beginner")
    features["experience_level"] = experience

    features["equipment"] = EQUIPMENT_MAP.get(
        str(pick("equipment")).strip().lower(), "basic_gym"
    )
    features["activity_level"] = ACTIVITY_MAP.get(
        str(pick("activityLevel")).strip().lower(), "light"
    )

    features["screen_before_bed"] = int(_as_bool(pick("screenBeforeBed"), False))
    features["tracks_progress"] = int(_as_bool(pick("tracksProgress"), False))

    height_cm = features["height_cm"]
    weight_kg = features["weight_kg"]
    if height_cm and height_cm > 0:
        features["bmi"] = round(weight_kg / ((height_cm / 100.0) ** 2), 1)
    else:
        features["bmi"] = 22.0

    preference = str(profile.get("preference", "auto") or "auto").strip().lower()
    if preference not in PREFERRED_FOCUS:
        preference = derive_preference(
            goal,
            experience,
            features["workouts_per_week"],
            features["session_minutes"],
        )
    features["preferred_focus"] = preference

    frame = pd.DataFrame([features])
    return frame, sorted(set(assumed))
