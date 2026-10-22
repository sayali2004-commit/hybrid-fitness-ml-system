"""Preprocessing pipelines for the two models.

Both models consume the same labelled CSV but need different treatment:

* **Random Forest classifier** — imputes missing values and one-hot encodes the
  categorical columns. Tree models do not need the features to be on a common
  scale, so the numeric branch is left unscaled.
* **KNN recommender** — the same imputation and encoding, but the numeric
  branch is additionally standardised with ``StandardScaler``. KNN measures
  euclidean distance, so unscaled columns such as ``daily_steps`` (thousands)
  would otherwise completely dominate the neighbour search.
"""

from __future__ import annotations

from typing import List

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def _numeric_branch(scale: bool) -> Pipeline:
    steps = [("impute", SimpleImputer(strategy="median"))]
    if scale:
        steps.append(("scale", StandardScaler()))
    return Pipeline(steps=steps)


def _binary_branch() -> Pipeline:
    return Pipeline(steps=[("impute", SimpleImputer(strategy="most_frequent"))])


def _categorical_branch(scale: bool = False) -> Pipeline:
    steps = [
        ("impute", SimpleImputer(strategy="most_frequent")),
        ("encode", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ]
    if scale:
        steps.append(("scale", StandardScaler()))
    return Pipeline(steps=steps)


def build_classifier_preprocessor(
    numeric_features: List[str],
    binary_features: List[str],
    categorical_features: List[str],
) -> ColumnTransformer:
    """Preprocessor used by the Random Forest habit classifier."""
    return ColumnTransformer(
        transformers=[
            ("num", _numeric_branch(scale=False), list(numeric_features)),
            ("bin", _binary_branch(), list(binary_features)),
            ("cat", _categorical_branch(), list(categorical_features)),
        ],
        remainder="drop",
    )


def build_recommender_preprocessor(
    numeric_features: List[str],
    categorical_features: List[str],
) -> ColumnTransformer:
    """Preprocessor used by the KNN workout recommender (scaled)."""
    return ColumnTransformer(
        transformers=[
            ("num", _numeric_branch(scale=True), list(numeric_features)),
            ("cat", _categorical_branch(scale=False), list(categorical_features)),
        ],
        remainder="drop",
    )
