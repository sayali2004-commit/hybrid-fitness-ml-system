"""Flask service for the Hybrid Fitness Intelligence Model.

The service does two jobs:

1. Serve the existing front-end application (the same ``index.html`` and
   ``assets/`` folder as before) so the whole project runs from one command.
2. Expose the trained models over a tiny JSON API::

       GET  /api/health    -> status of the service and the training dataset
       GET  /api/metrics   -> the full evaluation report (metrics.json)
       POST /api/predict   -> habit classification + workout recommendations
       POST /api/train     -> retrain the models from the CSV

Run it with::

    python -m ml.serve          # http://localhost:5000
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from flask import Blueprint, Flask, jsonify, request, send_from_directory

if __package__ in (None, ""):  # pragma: no cover - direct execution support
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.config import PROJECT_ROOT, dataset_path  # noqa: E402
from ml.dataset import inspect_dataset  # noqa: E402
from ml.predict import predict_profile  # noqa: E402
from ml.train import ensure_model  # noqa: E402

api = Blueprint("api", __name__, url_prefix="/api")

#: File types the web interface is allowed to load. Everything else (Python
#: source, the trained model, the training CSV) stays off the public server.
ALLOWED_STATIC_EXTENSIONS = {
    ".html",
    ".css",
    ".js",
    ".json",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".woff",
    ".woff2",
    ".txt",
    ".map",
}

#: Only these file types may be served from the project root itself.
ALLOWED_ROOT_EXTENSIONS = {".html", ".ico", ".png", ".svg", ".webmanifest"}

#: Folder whose contents are part of the web interface.
PUBLIC_FOLDER = "assets"

_STATE = {"artifacts": None, "report": None, "error": None, "loaded": False}

#: Set to True on read-only deployments (serverless) so the model is fitted in
#: memory instead of being written back to the project folder.
READONLY_DEPLOYMENT = bool(os.environ.get("FHA_ML_READONLY"))


# --------------------------------------------------------------------------- #
# Model lifecycle
# --------------------------------------------------------------------------- #
def refresh_model(force: bool = False, quick: bool = False) -> None:
    """Load (or rebuild) the model so it matches the CSV on disk."""
    try:
        artifacts, report = ensure_model(
            force=force,
            quick=quick or READONLY_DEPLOYMENT,
            persist=not READONLY_DEPLOYMENT,
        )
        _STATE["artifacts"] = artifacts
        _STATE["report"] = report
        _STATE["error"] = None
    except Exception as exc:  # pragma: no cover - defensive
        _STATE["artifacts"] = None
        _STATE["error"] = str(exc)
        _, report = inspect_dataset()
        _STATE["report"] = report
    finally:
        _STATE["loaded"] = True


def _status_payload() -> dict:
    report = _STATE.get("report")
    artifacts = _STATE.get("artifacts")
    if report is None:
        return {"status": "unavailable", "message": "The model has not been loaded yet."}
    if not report.sufficient:
        return {
            "status": "insufficient_data",
            "message": report.message,
            "dataset": report.to_dict(),
        }
    if artifacts is None:
        return {
            "status": "unavailable",
            "message": _STATE.get("error") or "The model could not be loaded.",
            "dataset": report.to_dict(),
        }
    metrics = artifacts.get("metrics", {})
    return {
        "status": "ok",
        "message": report.message,
        "readOnly": READONLY_DEPLOYMENT,
        "dataset": report.to_dict(),
        "model": {
            "classifier": metrics.get("classifier", {}).get("name"),
            "recommender": metrics.get("recommender", {}).get("name"),
            "trainedAt": metrics.get("trainedAt"),
            "rows": metrics.get("dataset", {}).get("rows"),
            "classifierAccuracy": metrics.get("classifier", {}).get("metrics", {}).get("accuracy"),
            "recommenderAccuracy": metrics.get("recommender", {}).get("metrics", {}).get("accuracy"),
        },
    }


# --------------------------------------------------------------------------- #
# API routes
# --------------------------------------------------------------------------- #
@api.get("/health")
def health():
    return jsonify(_status_payload())


@api.get("/metrics")
def metrics():
    artifacts = _STATE.get("artifacts")
    if artifacts is None:
        return jsonify(_status_payload())
    return jsonify(artifacts.get("metrics", {}))


@api.post("/predict")
def predict():
    payload = request.get_json(silent=True) or {}
    profile = payload.get("profile") or payload

    report = _STATE.get("report")
    if report is not None and not report.sufficient:
        return jsonify(
            {
                "status": "insufficient_data",
                "message": report.message,
                "dataset": report.to_dict(),
            }
        )

    artifacts = _STATE.get("artifacts")
    if artifacts is None:
        return jsonify(_status_payload())

    if not isinstance(profile, dict) or not profile:
        return (
            jsonify(
                {
                    "status": "invalid_request",
                    "message": "Send the habit profile as JSON in the `profile` field.",
                }
            ),
            400,
        )

    try:
        result = predict_profile(profile, artifacts)
    except Exception as exc:  # pragma: no cover - defensive
        # The stored model may have been created with a different library
        # release — retrain once from the CSV and try again.
        refresh_model(force=True, quick=True)
        artifacts = _STATE.get("artifacts")
        if artifacts is not None:
            try:
                result = predict_profile(profile, artifacts)
            except Exception as exc:
                return (
                    jsonify({"status": "error", "message": f"Prediction failed: {exc}"}),
                    500,
                )
        else:
            return (
                jsonify({"status": "error", "message": f"Prediction failed: {exc}"}),
                500,
            )

    result["dataset"] = report.to_dict() if report is not None else None
    result["readOnly"] = READONLY_DEPLOYMENT
    return jsonify(result)


@api.post("/train")
def train():
    if READONLY_DEPLOYMENT:
        # Serverless deployments ship a pre-trained model and have no writable
        # disk: retraining there would only burn CPU on every request.
        return (
            jsonify(
                {
                    "status": "read_only",
                    "readOnly": True,
                    "message": "Retraining is disabled on this deployment. "
                    "Run `python -m ml.train` locally and commit ml/artifacts/model.joblib.",
                }
            ),
            403,
        )
    refresh_model(force=True)
    return jsonify(_status_payload())


# --------------------------------------------------------------------------- #
# Application factory
# --------------------------------------------------------------------------- #
def create_app(refresh: bool = True) -> Flask:
    app = Flask(__name__, static_folder=None)

    app.register_blueprint(api)

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        return response

    @app.before_request
    def ensure_model_loaded():
        """Fit the model on the first request (serverless friendly)."""
        if not _STATE["loaded"]:
            refresh_model()
        return None

    @app.route("/", defaults={"filepath": "index.html"})
    @app.route("/<path:filepath>")
    def serve_static(filepath: str):
        """Serve the front-end assets.

        Only the file types that belong to the web interface are allowed —
        source files, the trained model and the training data must never be
        reachable over HTTP.
        """
        target = (PROJECT_ROOT / filepath).resolve()
        try:
            relative = target.relative_to(PROJECT_ROOT.resolve())
        except ValueError:
            return jsonify({"status": "error", "message": "Invalid path."}), 403

        extension = target.suffix.lower()
        if len(relative.parts) == 1:
            allowed = extension in ALLOWED_ROOT_EXTENSIONS
        elif relative.parts[0] == PUBLIC_FOLDER:
            allowed = extension in ALLOWED_STATIC_EXTENSIONS
        else:
            allowed = False

        if not allowed:
            return jsonify({"status": "error", "message": "Not found."}), 404
        if not target.is_file():
            return jsonify({"status": "error", "message": "Not found."}), 404
        return send_from_directory(PROJECT_ROOT, filepath)

    if refresh:
        refresh_model()
    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the app and the fitness ML API.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.environ.get("FHA_ML_PORT", "5000")))
    parser.add_argument("--no-model", action="store_true", help="Skip loading the model on boot.")
    args = parser.parse_args()

    app = create_app(refresh=not args.no_model)
    print(f"Fitness app + ML API running at http://localhost:{args.port}")
    print(f"Training dataset: {dataset_path()}")
    app.run(host=args.host, port=args.port, debug=False, threaded=True)


if __name__ == "__main__":
    main()
