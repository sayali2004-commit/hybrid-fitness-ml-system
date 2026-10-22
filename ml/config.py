"""Configuration, paths and shared schema for the Hybrid Fitness Intelligence Model.

Everything the rest of the ``ml`` package needs to know about *where things live*
and *what a row looks like* is declared here, so the training script, the API
server and the test-suite can never drift apart.
"""

from __future__ import annotations

import os
from pathlib import Path

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
ARTIFACT_DIR = BASE_DIR / "artifacts"

#: Public source of the real cohort (Kaggle "Gym Members Exercise Dataset",
#: Vala Khorasani) mirrored in a public GitHub repository.
RAW_DATASET_URL = (
    "https://raw.githubusercontent.com/"
    "surabhimetpally/GymMembers_exercise_tracking_R/main/"
    "gym_members_exercise_tracking.csv"
)

RAW_DATASET_PATH = RAW_DIR / "gym_members_exercise_tracking.csv"
TRAINING_DATASET_PATH = DATA_DIR / "fitness_habits.csv"
MODEL_PATH = ARTIFACT_DIR / "model.joblib"
METRICS_PATH = ARTIFACT_DIR / "metrics.json"


def _env_path(name: str, default: Path) -> Path:
    """Allow the dataset / artifact location to be overridden by env var.

    Used by the test-suite to point the service at a deliberately broken or
    tiny CSV in order to exercise the "insufficient training data" path.
    """
    value = os.environ.get(name)
    return Path(value).expanduser().resolve() if value else default


def dataset_path() -> Path:
    return _env_path("FHA_ML_DATASET", TRAINING_DATASET_PATH)


def artifacts_dir() -> Path:
    return _env_path("FHA_ML_ARTIFACTS", ARTIFACT_DIR)


def model_path() -> Path:
    return artifacts_dir() / "model.joblib"


def metrics_path() -> Path:
    return artifacts_dir() / "metrics.json"


# --------------------------------------------------------------------------- #
# Training / validation thresholds
# --------------------------------------------------------------------------- #
#: Minimum number of labelled rows required before the model may be trained.
MIN_TRAIN_ROWS = int(os.environ.get("FHA_ML_MIN_ROWS", "80"))
#: Minimum number of rows each target class must contain.
MIN_ROWS_PER_CLASS = int(os.environ.get("FHA_ML_MIN_ROWS_PER_CLASS", "15"))
#: Fraction of the dataset held out for testing.
TEST_SIZE = 0.2
#: Seed used everywhere so results are reproducible.
RANDOM_STATE = 42
#: Cross-validation folds used for the reported stability metrics.
CV_FOLDS = 5

# --------------------------------------------------------------------------- #
# Feature schema
# --------------------------------------------------------------------------- #
#: Numeric features used by both models.
NUMERIC_FEATURES = [
    "age",
    "height_cm",
    "weight_kg",
    "bmi",
    "planned_days_per_week",
    "workouts_per_week",
    "skipped_per_week",
    "session_minutes",
    "diet_quality",
    "protein_meals",
    "junk_food_per_week",
    "water_glasses",
    "sleep_hours",
    "daily_steps",
    "motivation",
]

#: Binary features (0/1) derived from the check-boxes in the profile form.
BINARY_FEATURES = [
    "screen_before_bed",
    "tracks_progress",
]

#: Categorical features, one-hot encoded by the preprocessor.
CATEGORICAL_FEATURES = [
    "sex",
    "fitness_goal",
    "experience_level",
    "equipment",
    "activity_level",
    "preferred_focus",
]

#: Every feature the Random Forest classifier sees.
RF_FEATURES = NUMERIC_FEATURES + BINARY_FEATURES + CATEGORICAL_FEATURES

#: The KNN recommender is deliberately fed the "what should I train today"
#: subset of features: goal, frequency, experience, session length and the
#: user's stated preferences.
KNN_FEATURES = [
    "fitness_goal",
    "workouts_per_week",
    "planned_days_per_week",
    "experience_level",
    "session_minutes",
    "preferred_focus",
    "equipment",
    "activity_level",
]

#: Numeric part of the KNN feature set (these are standardised).
KNN_NUMERIC_FEATURES = [
    "workouts_per_week",
    "planned_days_per_week",
    "session_minutes",
]

#: Categorical part of the KNN feature set (one-hot encoded).
KNN_CATEGORICAL_FEATURES = [
    "fitness_goal",
    "experience_level",
    "preferred_focus",
    "equipment",
    "activity_level",
]

#: Label column names inside the training CSV.
HABIT_LABEL = "habit_category"
RECOMMENDATION_LABEL = "recommended_category"

# --------------------------------------------------------------------------- #
# Label vocabulary
# --------------------------------------------------------------------------- #
GOALS = ["loss", "muscle", "endurance", "health"]
EXPERIENCES = ["beginner", "intermediate", "advanced"]
EQUIPMENT = ["full_gym", "basic_gym", "home", "outdoor"]
ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active"]
PREFERRED_FOCUS = ["strength", "cardio", "hiit", "mobility"]
SEXES = ["male", "female", "other"]

#: Human readable names + one-line explanations for the four habit categories.
HABIT_CATEGORY_META = {
    "consistent_athlete": {
        "label": "Consistent Athlete",
        "tone": "good",
        "summary": "Sessions are frequent, recovery is good and nutrition supports the training.",
    },
    "steady_improver": {
        "label": "Steady Improver",
        "tone": "good",
        "summary": "Regular training with a few gaps — the foundation is sound and still improving.",
    },
    "inconsistent_athlete": {
        "label": "Inconsistent Athlete",
        "tone": "warn",
        "summary": "Training happens, but skipped sessions and unstable habits break the progression.",
    },
    "sedentary_struggler": {
        "label": "Sedentary Struggler",
        "tone": "bad",
        "summary": "Very little training volume — the first win is simply showing up more often.",
    },
    "overtraining_risk": {
        "label": "Overtraining Risk",
        "tone": "bad",
        "summary": "High planned volume with poor recovery — the body is not keeping up with the plan.",
    },
}

#: Human readable names + focus description for the six workout categories.
#: The names deliberately match the session taxonomy used by the rule based
#: plan generator in ``assets/js/data.js``.
WORKOUT_CATEGORY_META = {
    "full_body_hybrid": {
        "label": "Full Body Hybrid",
        "focus": "Whole body · strength + conditioning",
        "summary": "A full body session that mixes strength work with a short conditioning finish.",
    },
    "push_pull_strength": {
        "label": "Push / Pull Strength",
        "focus": "Upper body · strength focus",
        "summary": "Separate push and pull days built around heavier compound lifts.",
    },
    "lower_body_focus": {
        "label": "Lower Body Focus",
        "focus": "Legs · glutes · hamstrings",
        "summary": "Concentrated lower body work for squats, hinges and single-leg strength.",
    },
    "conditioning_intervals": {
        "label": "Conditioning Intervals",
        "focus": "Cardio · fat loss focus",
        "summary": "Short hard intervals and metabolic circuits that keep the heart rate high.",
    },
    "endurance_base": {
        "label": "Endurance Base",
        "focus": "Aerobic base · stamina",
        "summary": "Longer steady-state work that grows your aerobic capacity.",
    },
    "core_stability_mobility": {
        "label": "Core & Mobility",
        "focus": "Core · stability · recovery",
        "summary": "Core control, hip mobility and recovery work that protects the joints.",
    },
}

#: Order in which the habit categories are evaluated when labelling a row.
#: The first matching rule wins (documented in ``ml/build_dataset.py``).
HABIT_LABEL_PRECEDENCE = [
    "sedentary_struggler",
    "overtraining_risk",
    "consistent_athlete",
    "steady_improver",
    "inconsistent_athlete",
]

#: Mapping from the app's form values to the CSV vocabulary.
GOAL_MAP = {
    "loss": "loss",
    "muscle": "muscle",
    "endurance": "endurance",
    "health": "health",
}

EXPERIENCE_MAP = {
    "beginner": "beginner",
    "intermediate": "intermediate",
    "advanced": "advanced",
}

EQUIPMENT_MAP = {
    "full_gym": "full_gym",
    "basic_gym": "basic_gym",
    "home": "home",
    "outdoor": "outdoor",
}

ACTIVITY_MAP = {
    "sedentary": "sedentary",
    "light": "light",
    "moderate": "moderate",
    "active": "active",
}

#: Columns that must exist in the training CSV.
REQUIRED_COLUMNS = sorted(
    set(
        RF_FEATURES
        + [HABIT_LABEL, RECOMMENDATION_LABEL]
    )
)
