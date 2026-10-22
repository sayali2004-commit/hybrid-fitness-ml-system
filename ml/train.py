"""Train and evaluate the hybrid fitness model.

Two models are trained on the same labelled CSV:

``RandomForestClassifier``
    Classifies the trainee's **fitness habit category**
    (consistent athlete, steady improver, inconsistent athlete,
    sedentary struggle, overtraining risk).

``KNeighborsClassifier``
    Recommends a **workout category** from the goal, the training frequency,
    the experience level, the session length and the user's preferences.

The script prints an evaluation report and stores both the fitted pipelines
and the metrics as JSON so the dashboard and the API can use them.
"""

from __future__ import annotations

import argparse
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline

if __package__ in (None, ""):  # pragma: no cover - direct execution support
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.config import (  # noqa: E402
    BINARY_FEATURES,
    CATEGORICAL_FEATURES,
    CV_FOLDS,
    HABIT_CATEGORY_META,
    HABIT_LABEL,
    KNN_CATEGORICAL_FEATURES,
    KNN_NUMERIC_FEATURES,
    MIN_ROWS_PER_CLASS,
    MIN_TRAIN_ROWS,
    NUMERIC_FEATURES,
    RANDOM_STATE,
    RECOMMENDATION_LABEL,
    RF_FEATURES,
    TEST_SIZE,
    WORKOUT_CATEGORY_META,
    artifacts_dir,
    dataset_path,
    metrics_path,
    model_path,
)
from ml.dataset import inspect_dataset  # noqa: E402
from ml.preprocess import (  # noqa: E402
    build_classifier_preprocessor,
    build_recommender_preprocessor,
)

RF_PARAMS = {
    "n_estimators": 300,
    "max_depth": 10,
    "min_samples_leaf": 2,
    "max_features": "sqrt",
    "class_weight": "balanced",
    "random_state": RANDOM_STATE,
    "n_jobs": -1,
}

KNN_PARAMS = {
    "n_neighbors": 9,
    "weights": "distance",
    "p": 2,
}


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _readable_feature_name(raw: str) -> str:
    name = raw.split("__", 1)[-1]
    name = name.replace("_", " ")
    return name


def _classification_metrics(y_true, y_pred, labels) -> Dict[str, Any]:
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precisionMacro": round(float(precision_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "recallMacro": round(float(recall_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "f1Macro": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "f1Weighted": round(float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
        "labels": list(labels),
        "confusionMatrix": confusion_matrix(y_true, y_pred, labels=list(labels)).tolist(),
        "report": classification_report(
            y_true, y_pred, labels=list(labels), output_dict=True, zero_division=0
        ),
    }


def _majority_baseline(y_train, y_test) -> float:
    counts = pd.Series(y_train).value_counts()
    majority = counts.index[0]
    return round(float((pd.Series(y_test) == majority).mean()), 4)


def _top_k_hit_rate(pipeline: Pipeline, X_test, y_test, k: int = 3) -> float:
    """Share of test rows whose true label is inside the model's top-k classes."""
    matrix = pipeline.named_steps["prep"].transform(X_test)
    model = pipeline.named_steps["clf"]
    proba = model.predict_proba(matrix)
    classes = list(model.classes_)
    order = np.argsort(-proba, axis=1)[:, :k]
    hits = 0
    for index, true_label in enumerate(np.asarray(y_test)):
        if true_label in [classes[j] for j in order[index]]:
            hits += 1
    return round(hits / len(y_test), 4)


# --------------------------------------------------------------------------- #
# Training
# --------------------------------------------------------------------------- #
def build_classifier_pipeline() -> Pipeline:
    preprocessor = build_classifier_preprocessor(
        NUMERIC_FEATURES, BINARY_FEATURES, CATEGORICAL_FEATURES
    )
    return Pipeline(
        steps=[
            ("prep", preprocessor),
            ("clf", RandomForestClassifier(**RF_PARAMS)),
        ]
    )


def build_recommender_pipeline() -> Pipeline:
    preprocessor = build_recommender_preprocessor(
        KNN_NUMERIC_FEATURES, KNN_CATEGORICAL_FEATURES
    )
    return Pipeline(
        steps=[
            ("prep", preprocessor),
            ("clf", KNeighborsClassifier(**KNN_PARAMS)),
        ]
    )


def train_models(
    df: pd.DataFrame,
    quick: bool = False,
) -> Tuple[Pipeline, Pipeline, Dict[str, Any], Dict[str, Any]]:
    """Fit both models on the labelled cohort and return them with metrics.

    ``quick=True`` skips the cross-validation pass. It is used when the model
    has to be fitted on the fly (for example on a read-only serverless file
    system) where a fast answer matters more than the stability estimate.
    """
    X = df[RF_FEATURES]
    y_habit = df[HABIT_LABEL].astype(str)
    y_rec = df[RECOMMENDATION_LABEL].astype(str)

    X_train, X_test, yh_train, yh_test = train_test_split(
        X, y_habit, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y_habit
    )
    Xr_train, Xr_test, yr_train, yr_test = train_test_split(
        df[KNN_NUMERIC_FEATURES + KNN_CATEGORICAL_FEATURES],
        y_rec,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y_rec,
    )

    classifier = build_classifier_pipeline()
    classifier.fit(X_train, yh_train)
    habit_pred = classifier.predict(X_test)
    habit_metrics = _classification_metrics(
        yh_test, habit_pred, sorted(HABIT_CATEGORY_META)
    )

    recommender = build_recommender_pipeline()
    recommender.fit(Xr_train, yr_train)
    rec_pred = recommender.predict(Xr_test)
    rec_metrics = _classification_metrics(
        yr_test, rec_pred, sorted(WORKOUT_CATEGORY_META)
    )

    importances = classifier.named_steps["clf"].feature_importances_
    names = classifier.named_steps["prep"].get_feature_names_out()
    ranked = sorted(
        (
            {"feature": _readable_feature_name(name), "importance": round(float(value), 5)}
            for name, value in zip(names, importances)
        ),
        key=lambda item: item["importance"],
        reverse=True,
    )

    if quick:
        habit_cv = rec_cv = None
    else:
        cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
        habit_cv = cross_val_score(classifier, X, y_habit, cv=cv, scoring="accuracy", n_jobs=-1)
        rec_cv = cross_val_score(
            recommender,
            df[KNN_NUMERIC_FEATURES + KNN_CATEGORICAL_FEATURES],
            y_rec,
            cv=cv,
            scoring="accuracy",
            n_jobs=-1,
        )

    metrics: Dict[str, Any] = {
        "trainedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "quick": bool(quick),
        "dataset": {
            "rows": int(len(df)),
            "trainRows": int(len(X_train)),
            "testRows": int(len(X_test)),
            "testSize": TEST_SIZE,
            "missingCells": int(df.isna().sum().sum()),
            "habitDistribution": y_habit.value_counts().to_dict(),
            "recommendationDistribution": y_rec.value_counts().to_dict(),
        },
        "classifier": {
            "name": "RandomForestClassifier",
            "params": {k: v for k, v in RF_PARAMS.items() if k != "n_jobs"},
            "features": RF_FEATURES,
            "metrics": habit_metrics,
            "cvAccuracyMean": round(float(habit_cv.mean()), 4) if habit_cv is not None else None,
            "cvAccuracyStd": round(float(habit_cv.std()), 4) if habit_cv is not None else None,
            "majorityBaseline": _majority_baseline(yh_train, yh_test),
            "topFeatures": ranked[:12],
        },
        "recommender": {
            "name": "KNeighborsClassifier",
            "params": KNN_PARAMS,
            "features": KNN_NUMERIC_FEATURES + KNN_CATEGORICAL_FEATURES,
            "metrics": rec_metrics,
            "cvAccuracyMean": round(float(rec_cv.mean()), 4) if rec_cv is not None else None,
            "cvAccuracyStd": round(float(rec_cv.std()), 4) if rec_cv is not None else None,
            "majorityBaseline": _majority_baseline(yr_train, yr_test),
            "top3HitRate": _top_k_hit_rate(recommender, Xr_test, yr_test, 3),
            "top2HitRate": _top_k_hit_rate(recommender, Xr_test, yr_test, 2),
        },
        "environment": {
            "python": platform.python_version(),
            "scikitLearn": sklearn.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
        },
    }
    context: Dict[str, Any] = {
        "habitTrain": df[RF_FEATURES + [HABIT_LABEL]].reset_index(drop=True),
        "recommendationTrain": df[
            KNN_NUMERIC_FEATURES + KNN_CATEGORICAL_FEATURES + [RECOMMENDATION_LABEL]
        ].reset_index(drop=True),
    }
    return classifier, recommender, metrics, context


def save_artifacts(
    classifier: Pipeline,
    recommender: Pipeline,
    metrics: Dict[str, Any],
    context: Dict[str, Any] | None = None,
) -> bool:
    """Write the fitted pipelines and the metrics report to disk.

    Returns ``False`` instead of raising when the file system is read-only
    (serverless deployments) so the caller can keep using the in-memory model.
    """
    try:
        target_dir = artifacts_dir()
        target_dir.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "classifier": classifier,
                "recommender": recommender,
                "metrics": metrics,
                "context": context or {},
                "savedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            },
            model_path(),
        )
        metrics_path().write_text(json.dumps(metrics, indent=2), encoding="utf-8")
        return True
    except Exception as exc:  # pragma: no cover - read-only file systems
        print(f"[ml] could not write the model artifacts: {exc}")
        return False


def load_artifacts() -> Dict[str, Any] | None:
    path = model_path()
    if not path.exists():
        return None
    try:
        return joblib.load(path)
    except Exception:  # pragma: no cover - defensive
        return None


def artifacts_usable(artifacts: Dict[str, Any] | None, df: pd.DataFrame) -> bool:
    """Check that the stored pipelines can still run in this environment.

    A model that was pickled with a different scikit-learn release cannot be
    restored reliably, so it is smoke tested here. When it fails the model is
    simply retrained from the CSV instead of breaking the service.
    """
    if not artifacts:
        return False
    try:
        frame = df.head(1)
        artifacts["classifier"].predict(frame[RF_FEATURES])
        artifacts["recommender"].predict(frame[KNN_NUMERIC_FEATURES + KNN_CATEGORICAL_FEATURES])
        return True
    except Exception as exc:  # pragma: no cover - environment dependent
        print(f"[ml] the stored model cannot be used here ({exc}); retraining from the CSV")
        return False


def ensure_model(
    force: bool = False,
    data_path: Path | None = None,
    quick: bool = False,
    persist: bool = True,
):
    """Load the trained model, training it when the artifacts are missing/stale.

    ``quick=True`` skips the cross-validation pass (used on a cold serverless
    start), ``persist=False`` skips writing the artifacts to disk.
    """
    df, report = inspect_dataset(data_path)
    if not report.sufficient:
        return None, report

    artifacts = load_artifacts()
    if artifacts and not force:
        saved = artifacts.get("metrics", {}).get("dataset", {})
        if saved.get("rows") == report.rows and artifacts_usable(artifacts, df):
            return artifacts, report

    classifier, recommender, metrics, context = train_models(df, quick=quick)
    if persist:
        save_artifacts(classifier, recommender, metrics, context)
    return {"classifier": classifier, "recommender": recommender, "metrics": metrics, "context": context}, report


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def _print_report(metrics: Dict[str, Any]) -> None:
    classifier = metrics["classifier"]
    recommender = metrics["recommender"]
    dataset = metrics["dataset"]

    print("\n=== Hybrid Fitness Intelligence — training report ===")
    print(f"Rows: {dataset['rows']}  |  train {dataset['trainRows']}  |  test {dataset['testRows']}")
    print(f"Missing cells in the cohort: {dataset['missingCells']} (imputed during preprocessing)\n")

    print("-- Random Forest classifier (fitness habit category) --")
    cm = classifier["metrics"]
    print(f"  accuracy          : {cm['accuracy']}")
    print(f"  macro F1          : {cm['f1Macro']}")
    print(f"  weighted F1       : {cm['f1Weighted']}")
    print(f"  {CV_FOLDS}-fold CV accuracy : {classifier['cvAccuracyMean']} (+/- {classifier['cvAccuracyStd']})")
    print(f"  majority baseline : {classifier['majorityBaseline']}")
    print("  top features      : " + ", ".join(f"{f['feature']} ({f['importance']:.3f})" for f in classifier["topFeatures"][:6]))

    print("\n-- KNN recommender (workout category) --")
    rm = recommender["metrics"]
    print(f"  accuracy          : {rm['accuracy']}")
    print(f"  macro F1          : {rm['f1Macro']}")
    print(f"  {CV_FOLDS}-fold CV accuracy : {recommender['cvAccuracyMean']} (+/- {recommender['cvAccuracyStd']})")
    print(f"  majority baseline : {recommender['majorityBaseline']}")
    print(f"  top-2 hit rate    : {recommender['top2HitRate']}")
    print(f"  top-3 hit rate    : {recommender['top3HitRate']}")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the hybrid fitness model.")
    parser.add_argument("--data", default=None, help="Path to the labelled CSV")
    parser.add_argument("--retrain", action="store_true", help="Force a retrain")
    args = parser.parse_args()

    path = Path(args.data) if args.data else dataset_path()
    df, report = inspect_dataset(path)

    print(f"Dataset: {report.path}")
    print(f"Rows: {report.rows}   missing cells: {report.missing_cells}")
    if not report.sufficient:
        print("\nINSUFFICIENT TRAINING DATA")
        print(report.message)
        sys.exit(2)

    print("Training the Random Forest classifier and the KNN recommender ...")
    classifier, recommender, metrics, context = train_models(df)
    save_artifacts(classifier, recommender, metrics, context)
    _print_report(metrics)
    print(f"Model written to   : {model_path()}")
    print(f"Metrics written to : {metrics_path()}")


if __name__ == "__main__":
    main()
