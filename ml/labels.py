"""Deterministic labelling rules for the hybrid fitness model.

Two labels are derived for every row of the training cohort:

``habit_category``
    The *fitness habit class* predicted by the Random Forest classifier.
    It is a rule based read of the habit profile: how often the person trains
    versus how often they plan to, how they recover, and how well they eat.

``recommended_category``
    The *workout category* predicted by the KNN recommender. It is a rule
    based read of the goal, the training frequency, the experience level, the
    session length and the stated preferences.

Both rule sets are intentionally transparent so the whole project can be
explained in a viva: the models learn these surfaces from data, they do not
invent them.
"""

from __future__ import annotations

from typing import Dict, Optional

from .config import (
    HABIT_CATEGORY_META,
    WORKOUT_CATEGORY_META,
)

# --------------------------------------------------------------------------- #
# Habit category
# --------------------------------------------------------------------------- #


def adherence(workouts: float, planned: float) -> float:
    """Completed sessions divided by planned sessions (capped at 1.0)."""
    if not planned or planned <= 0:
        return 0.0
    return min(1.0, float(workouts) / float(planned))


def label_habit_category(
    workouts_per_week: float,
    planned_days_per_week: float,
    sleep_hours: float,
    diet_quality: float,
    motivation: float,
    skipped_per_week: float,
) -> str:
    """Return the habit class for one profile.

    Rules are evaluated in this order (first match wins)::

        1. sedentary_struggler  — one session or less per week
        2. overtraining_risk    — high planned volume with poor recovery
        3. consistent_athlete   — high adherence, good sleep, decent diet
        4. steady_improver      — moderate adherence, acceptable recovery
        5. inconsistent_athlete — everything else
    """
    ad = adherence(workouts_per_week, planned_days_per_week)

    if workouts_per_week <= 1:
        return "sedentary_struggler"

    if planned_days_per_week >= 5 and sleep_hours <= 6 and motivation <= 6:
        return "overtraining_risk"

    if ad >= 0.85 and sleep_hours >= 7 and diet_quality >= 6:
        return "consistent_athlete"

    if ad >= 0.6 and sleep_hours >= 6 and diet_quality >= 5:
        return "steady_improver"

    return "inconsistent_athlete"


# --------------------------------------------------------------------------- #
# Recommended workout category
# --------------------------------------------------------------------------- #


def label_recommended_category(
    fitness_goal: str,
    experience_level: str,
    workouts_per_week: float,
    session_minutes: float,
    preferred_focus: str,
) -> str:
    """Return the workout category that suits the profile.

    Rules (first match wins)::

        endurance  -> endurance_base (low volume / long sessions)
                      conditioning_intervals (otherwise)
        muscle     -> push_pull_strength (trained intermediate+ on 4+ days)
                      lower_body_focus (advanced on <= 3 days)
                      full_body_hybrid (otherwise)
        loss       -> conditioning_intervals (4+ days/week or HIIT preference)
                      full_body_hybrid (otherwise)
        health     -> core_stability_mobility (mobility preference or <= 45 min)
                      full_body_hybrid (otherwise)
    """
    goal = (fitness_goal or "health").strip().lower()

    if goal == "endurance":
        if workouts_per_week <= 3 and session_minutes >= 45:
            return "endurance_base"
        return "conditioning_intervals"

    if goal == "muscle":
        if experience_level in ("intermediate", "advanced") and workouts_per_week >= 4:
            return "push_pull_strength"
        if experience_level == "advanced" and workouts_per_week <= 3:
            return "lower_body_focus"
        return "full_body_hybrid"

    if goal == "loss":
        if workouts_per_week >= 4 or preferred_focus == "hiit":
            return "conditioning_intervals"
        return "full_body_hybrid"

    # health
    if preferred_focus == "mobility" or session_minutes <= 45:
        return "core_stability_mobility"
    return "full_body_hybrid"


# --------------------------------------------------------------------------- #
# Presentation helpers
# --------------------------------------------------------------------------- #


def habit_meta(category: str) -> Dict[str, str]:
    return HABIT_CATEGORY_META.get(
        category,
        {"label": category.replace("_", " ").title(), "tone": "warn", "summary": ""},
    )


def workout_meta(category: str) -> Dict[str, str]:
    return WORKOUT_CATEGORY_META.get(
        category,
        {
            "label": category.replace("_", " ").title(),
            "focus": "",
            "summary": "",
        },
    )


def habit_description(category: str) -> str:
    return habit_meta(category).get("summary", "")


def recommendation_reason(category: str, profile: Optional[dict] = None) -> str:
    """A short, data driven sentence explaining why a category was suggested."""
    meta = workout_meta(category)
    base = meta.get("summary", "")
    if not profile:
        return base

    goal = profile.get("fitness_goal") or profile.get("goal") or "your goal"
    exp = profile.get("experience_level") or profile.get("experience") or "your level"
    freq = profile.get("workouts_per_week", profile.get("workoutsPerWeek"))
    mins = profile.get("session_minutes", profile.get("sessionMinutes"))

    detail = []
    if freq is not None:
        detail.append(f"{int(freq)}×/week")
    if mins is not None:
        detail.append(f"{int(mins)} min sessions")
    if detail:
        return f"{base} Matched to {goal} at {exp} level, {', '.join(detail)}."
    return base
