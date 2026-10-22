"""Loading and validating the labelled training CSV.

The service refuses to make predictions when the dataset on disk cannot
support a model. Every reason is returned as a human readable message so the
dashboard can show an honest "insufficient training data" notice instead of a
made-up prediction.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Tuple

import pandas as pd

from .config import (
    HABIT_LABEL,
    MIN_ROWS_PER_CLASS,
    MIN_TRAIN_ROWS,
    RECOMMENDATION_LABEL,
    REQUIRED_COLUMNS,
    dataset_path,
)


@dataclass
class DatasetReport:
    """Outcome of inspecting the training CSV."""

    path: str
    exists: bool
    rows: int = 0
    sufficient: bool = False
    issues: List[str] = field(default_factory=list)
    summary: List[str] = field(default_factory=list)
    habit_counts: dict = field(default_factory=dict)
    recommendation_counts: dict = field(default_factory=dict)
    missing_cells: int = 0

    @property
    def message(self) -> str:
        if self.sufficient:
            return f"{self.rows} labelled rows are available for training."
        return " ".join(self.summary) if self.summary else (
            "The training dataset is not usable yet."
        )

    def to_dict(self) -> dict:
        return {
            "path": self.path,
            "exists": self.exists,
            "rows": self.rows,
            "sufficient": self.sufficient,
            "issues": list(self.issues),
            "summary": list(self.summary),
            "missingCells": self.missing_cells,
            "habitDistribution": self.habit_counts,
            "recommendationDistribution": self.recommendation_counts,
            "message": self.message,
        }


def inspect_dataset(path: Path | None = None) -> Tuple[pd.DataFrame, DatasetReport]:
    """Load the CSV and report whether it can be used for training."""
    path = Path(path) if path else dataset_path()
    report = DatasetReport(path=str(path), exists=path.exists())

    if not path.exists():
        report.issues.append(
            "No training dataset was found. Run `python -m ml.build_dataset` to create it."
        )
        report.summary.append("No training dataset was found on disk.")
        return pd.DataFrame(), report

    try:
        df = pd.read_csv(path)
    except Exception as exc:  # pragma: no cover - defensive
        report.issues.append(f"The training dataset could not be read: {exc}")
        report.summary.append(f"The training dataset could not be read: {exc}")
        return pd.DataFrame(), report

    report.rows = int(len(df))
    report.missing_cells = int(df.isna().sum().sum())

    missing_columns = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_columns:
        report.issues.append(
            "The training dataset is missing required columns: " + ", ".join(missing_columns) + "."
        )
        report.summary.append(
            f"{len(missing_columns)} required columns are missing from the dataset."
        )

    if report.rows < MIN_TRAIN_ROWS:
        report.issues.append(
            f"Only {report.rows} labelled rows are available; at least {MIN_TRAIN_ROWS} are required."
        )
        report.summary.append(
            f"Only {report.rows} labelled rows are available (at least {MIN_TRAIN_ROWS} required)."
        )

    for label_column in (HABIT_LABEL, RECOMMENDATION_LABEL):
        if label_column not in df.columns:
            continue
        counts = df[label_column].value_counts(dropna=True)
        if label_column == HABIT_LABEL:
            report.habit_counts = counts.to_dict()
        else:
            report.recommendation_counts = counts.to_dict()

        if counts.empty:
            report.issues.append(f"No labels found for `{label_column}`.")
            report.summary.append(f"No labels were found for `{label_column}`.")
        elif len(counts) < 2:
            report.issues.append(
                f"`{label_column}` only contains one class, so no model can be trained."
            )
            report.summary.append(
                f"`{label_column}` contains a single class, so no model can be trained."
            )
        else:
            rare = counts[counts < MIN_ROWS_PER_CLASS]
            if not rare.empty:
                report.issues.append(
                    f"`{label_column}` has classes with fewer than {MIN_ROWS_PER_CLASS} rows: "
                    + ", ".join(f"{cls} ({int(n)})" for cls, n in rare.items())
                    + "."
                )
                report.summary.append(
                    f"{len(rare)} classes of `{label_column}` have fewer than "
                    f"{MIN_ROWS_PER_CLASS} rows."
                )

    report.sufficient = not report.issues
    return df, report


def load_dataset(path: Path | None = None) -> pd.DataFrame:
    """Return the dataset, raising a readable error when it is unusable."""
    df, report = inspect_dataset(path)
    if not report.sufficient:
        raise ValueError(report.message)
    return df
