"""WSGI entrypoint — used by Vercel and by any WSGI server.

Vercel's Python runtime looks for a Flask application called ``app`` in one of
``app.py``, ``index.py``, ``server.py``, ``main.py``, ``wsgi.py`` or ``asgi.py``
at the project root (or inside ``src/``, ``app/`` or ``api/``). This file is
that entrypoint, so the project can be deployed with a single click:

    vercel deploy --prod

It exposes exactly the same service as ``python -m ml.serve`` — the dashboard,
the static assets and the JSON API under ``/api``.

Run it locally with:

    python -m flask --app app run --port 5000
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Serverless file systems are read-only, so the fitted model is kept in memory
# instead of being written back into the project folder. Set this to "0" to
# allow the artifacts to be saved again.
os.environ.setdefault("FHA_ML_READONLY", "1")

from ml.serve import create_app  # noqa: E402

# The model is fitted on the first request so a cold start stays fast.
app = create_app(refresh=False)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")))
