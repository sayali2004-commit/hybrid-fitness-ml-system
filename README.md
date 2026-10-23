# Fitness Habit Analysis & Personalized Workout Recommendation System

**College field project** — a browser-based web application that analyses the daily fitness habits of gym users, identifies their specific problems, and generates a personalised workout plan, weekly schedule and lifestyle guidance.

The front-end is **dependency-free**: no framework, no build step, no external libraries. All user data is stored in the browser's `localStorage`.

On top of the rule-based engine sits an optional **Hybrid Fitness Intelligence Model** (`ml/`): a Python service that trains a **Random Forest classifier** (fitness habit category) and a **KNN recommender** (workout category) with Pandas + Scikit-learn and feeds the predictions back into the dashboard. Everything runs locally — see [`ml/README.md`](ml/README.md).

---

## 1. The problem this solves

Common problems reported by gym users:

| Problem | How the system addresses it |
| --- | --- |
| Irregular workout routines | Scores training consistency against the user's own plan and flags the gap between planned and actual sessions |
| Lack of motivation | Scores motivation separately, detects "no progress tracking" as a root cause and suggests habit-anchoring techniques |
| Difficulty choosing exercises | Generates a complete plan (exercises, sets, reps, rest, coaching cues) from goal + experience + equipment + available time |
| Poor progress tracking | Provides a daily check-in with weight, workouts, water, sleep, steps and mood, plus five charts and adherence tracking |
| Unhealthy lifestyle habits | Analyses diet quality, protein coverage, processed-food frequency, hydration, sleep and daily steps against explicit targets |
| "Which kind of training suits me today?" | The hybrid model classifies the habit profile and ranks workout categories with a KNN recommender trained on a labelled cohort |

---

## 2. Features

1. **Fitness habit analysis with problem identification and improvement suggestions**
   Six habit dimensions are scored 0–100, 26 problem-detection rules identify what is going wrong, and each problem is paired with a concrete, prioritised suggestion. Every scoring rule is displayed in the app so the analysis is transparent rather than a black box.

2. **Personalised workout plans based on fitness goals and experience**
   The plan adapts to goal (lose fat / build muscle / endurance / general health), experience level (beginner / intermediate / advanced), training days per week, session length and available equipment.

3. **Weekly workout schedules with suitable exercises and rest days**
   A seven-day grid places the correct session type on each training day, leaves real rest days, and gives each rest day its own recovery activity.

4. **Fitness progress tracking with simple charts**
   Weight trend (with target line), workouts per week vs planned, hydration vs target, sleep vs target, and training adherence. Data can be exported as CSV or JSON.

5. **General diet, hydration, sleep and fitness tips**
   41 general lifestyle tips plus a rotating "tip of the day" and personalised reminders derived from the user's own analysis.

6. **A dashboard showing fitness analysis and recommended solutions**
   Overall score gauge, six-dimension breakdown, prioritised problems, ranked solutions, a week-at-a-glance strip and personalised daily targets.

7. **Hybrid Fitness Intelligence Model (machine learning)**
   A Random Forest classifier predicts the trainee's **fitness habit category** (consistent athlete, steady improver, inconsistent athlete, sedentary struggle, overtraining risk) and a KNN recommender ranks **workout categories** from the goal, training frequency, experience, session length and preferences. The prediction, the class probabilities and the ranked categories are shown on the dashboard with charts — and the panel honestly reports when the service is offline or the training data is insufficient.

8. **Graphical report page**
   A dedicated Report page with a year-end style overview: score gauge, 12-month score trend, planned versus
   completed sessions, habit dimension breakdown, training split donut, monthly steps and a summary table.
   Every figure on that page is clearly-labelled **fictional demo data** (banner, per-card hints and per-row
   Demo tags) and is never mixed with the user's own log.

---

## 3. Project structure

```
Fitnes_Model/
├── index.html                 # Application shell: all 8 pages + navigation
├── app.py                     # WSGI entrypoint (Vercel / any WSGI server)
├── requirements.txt           # Root dependencies — Vercel installs from here
├── vercel.json                # Vercel build + routing configuration
├── server.js                  # Optional zero-dependency static server (Node)
├── README.md                  # This file
├── assets/
│   ├── css/
│   │   └── style.css          # Light-theme design system (tokens, components, responsive)
│   └── js/
│       ├── data.js            # Exercise library (58), session templates (24), prescriptions, 41 tips, sample data
│       ├── storage.js         # localStorage wrapper with in-memory fallback
│       ├── engine.js          # Rule-based analysis + plan/schedule generation (the "brain")
│       ├── charts.js          # Dependency-free SVG charts (line, bar, gauge, horizontal bars)
│       ├── ml.js              # Hybrid model client: API calls + dashboard panel rendering
│       ├── report.js              # Illustrated demo report: fictional dataset + charts
│       └── app.js             # UI rendering, navigation, forms, events
└── ml/                        # Hybrid Fitness Intelligence Model (Python)
    ├── README.md              # Setup, data dictionary, metrics, API reference
    ├── requirements.txt       # pandas, scikit-learn, numpy, joblib, Flask, pytest
    ├── config.py              # Paths, feature lists, label vocabulary, thresholds
    ├── labels.py              # Transparent labelling rules for both targets
    ├── build_dataset.py       # Public dataset → labelled training CSV
    ├── dataset.py             # Loading + validation (insufficient-data messages)
    ├── features.py            # Browser profile → model feature frame
    ├── preprocess.py          # Imputation / one-hot encoding / scaling pipelines
    ├── train.py               # Training, evaluation, artifact + metrics output
    ├── predict.py             # Inference for a user profile
    ├── serve.py               # Flask app: static frontend + JSON API
    ├── tests/test_model.py    # 18 automated tests
    ├── data/                  # Raw public CSV + labelled training cohort (1,733 rows)
    └── artifacts/             # model.joblib + metrics.json (generated)
```

**Front-end: 8 files, ~4,300 lines, zero dependencies, no build step. ML layer: 11 Python modules, ~2,030 lines (Pandas + Scikit-learn + Flask).**

---

## 4. How to run

### Option A — front-end only (simplest)
Double-click `index.html`. Everything works except the ML card, which shows a "model service not reachable" notice.

> Some browsers restrict `localStorage` on `file://` URLs. The app detects this and shows a banner, falling back to an in-memory store so it still runs.

### Option B — full stack with the hybrid model (recommended)
```bash
cd Fitnes_Model
pip install -r requirements.txt
python -m ml.serve
```
Then open **<http://localhost:5000>**. The Flask service trains the models from `ml/data/fitness_habits.csv` on first start, serves the dashboard and exposes the prediction API.

The same service can be started through the WSGI entrypoint that Vercel uses:
```bash
python -m flask --app app run --port 5000
```

### Option C — static web server
```bash
cd Fitnes_Model
node server.js             # or: npx serve  /  python -m http.server 8000
```
Then open `http://localhost:8000`. The dashboard works; if the Python service is also running on port 5000 the ML card picks it up automatically.

Requires a modern browser (Chrome, Edge, Firefox, Safari). No build step either way.

### Deep links
Each page has its own URL hash, so you can link straight to one screen:
`index.html#dashboard`, `#profile`, `#analysis`, `#plan`, `#schedule`, `#progress`, `#report`, `#tips`.

### For a live demo
Open the browser console on any page and use the small public API:

```js
FitnessApp.loadSampleData();   // load the labelled demonstration data
FitnessApp.showPage('plan');    // jump to the workout plan
FitnessApp.getState();          // inspect the current analysis / plan / logs
FitnessApp.clearAll();          // wipe everything
```

---

## 5. How the analysis works

### 5.1 Six habit dimensions

| Dimension | Weight | Core rule |
| --- | --- | --- |
| Workout Consistency | 25% | `45 + 55 × min(actual ÷ planned, 1)`, −6 per skipped session beyond the first |
| Diet & Nutrition | 20% | 50% diet self-rating + 50% protein-meal coverage, −15 for 7+ junk foods/week |
| Hydration | 15% | Target = 35 ml × body weight ÷ 250 ml per glass; below target `70 × (actual ÷ target)` |
| Sleep & Recovery | 15% | Curve: 7–9 h = 75–100, 6–7 h = 45–75, under 6 h scaled down; −8 for screen use before bed |
| Daily Activity | 15% | Step-count bands (4,000 / 8,000 / 12,000) plus a lifestyle-activity modifier |
| Motivation & Tracking | 10% | Motivation rating × 8, +20 for keeping a progress-tracking habit |

The **overall score** is the weighted sum. Status bands: 75+ Excellent, 60–74 Good, 40–59 Needs attention, below 40 Poor.

### 5.2 Problem detection
26 rules in `engine.js` (`PROBLEM_RULES`), each with a severity (high / medium / low) and an impact weight used for prioritisation. Examples:

- *No structured training* — workouts per week = 0
- *High skips* — 3+ sessions skipped per week
- *Too much volume for a beginner* — 5+ sessions per week at beginner level
- *Dieting without resistance training* — fat-loss goal with ≤1 session and low diet rating
- *Muscle-gain goal at a high BMI* — goal vs body-composition mismatch
- *Sleep limiting endurance gains* — endurance goal with under 7 hours of sleep

### 5.3 Personalised targets (rule-based estimates)
- **BMR** — Mifflin-St Jeor equation
- **Maintenance** — BMR × lifestyle activity factor (1.25 / 1.4 / 1.55 / 1.7)
- **Energy target** — maintenance ± goal adjustment (−400 for fat loss, +300 for muscle gain, −100 for general health), never below BMR × 1.05
- **Protein** — 1.2–2.0 g/kg depending on goal and experience
- **Water** — 35 ml/kg body weight
- **Steps** — 7,000–10,000 base adjusted by goal

### 5.4 Plan generation
1. Pick the training split from the goal and the number of training days.
2. Map session types onto the training days of the week (2 days → Mon/Thu, 3 → Mon/Wed/Fri, 4 → Mon/Tue/Thu/Fri, 5 → weekdays, 6 → Mon–Sat).
3. For every exercise in the template, resolve an **equipment-appropriate** movement (an explicit substitution table plus a muscle-group similarity fallback) and a **beginner-safe** movement where needed.
4. Size the session to the user's time budget: reduce working sets if needed, size the cardio work (one long block, secondary blocks or interval rounds), and never drop below three movements.
5. Apply sets, reps, rest and coaching cues from the goal + experience prescription table.
6. Attach progression, deload and recovery rules.

---

## 6. The hybrid fitness intelligence model

Full documentation — data dictionary, preprocessing, metrics and API reference — is in [`ml/README.md`](ml/README.md). The short version:

**Training data** — `ml/data/fitness_habits.csv`, 1,733 labelled rows built from the public
*Gym Members Exercise Dataset* (973 real sessions) plus a documented, seeded simulator for the lifestyle attributes the public dataset does not contain (goal, motivation, diet, sleep, tracking) and a cohort expansion for the rare habit classes. 863 cells are deliberately left blank so the imputation path is always exercised.

**Preprocessing** — `SimpleImputer` (median for numeric, most frequent for categorical) → `OneHotEncoder(handle_unknown="ignore")` for the categorical features → `StandardScaler` for the KNN's numeric features (without it the step count would dominate the neighbour search). `train_test_split(test_size=0.2, stratify=label, random_state=42)` plus 5-fold `StratifiedKFold` cross-validation.

**Models**

| Model | Target | Classes | Test accuracy | 5-fold CV |
| --- | --- | --- | --- | --- |
| `RandomForestClassifier` (300 trees, depth 10, balanced) | `habit_category` | 5 | **0.8876** | 0.8656 ± 0.0184 |
| `KNeighborsClassifier` (k = 9, distance-weighted) | `recommended_category` | 6 | **0.8588** | 0.8390 ± 0.0252 |

Both beat the majority-class baseline (0.36 / 0.35) by more than 45 points. The recommender's top-2 hit rate is 0.948 and its top-3 hit rate 0.968, so the right category is almost always inside the three suggestions shown.

**In the app** — the *Hybrid Fitness Intelligence* card at the bottom of the dashboard shows the predicted habit category with its confidence, a probability chart per class, the three ranked workout categories with match scores, and the model's accuracy. The panel never invents a result: if the Python service is not running it shows a "model service not reachable" notice, and if the training data is too small it shows exactly which requirement is not met.

---

## 7. Deployment on Vercel

The repository is ready for Vercel — `app.py` (Flask entrypoint), `requirements.txt` (root) and `vercel.json` are all included.

```bash
npm i -g vercel
vercel --prod
```

Pick **Flask** when Vercel asks for the framework, and leave the **Root Directory empty** (the repository root) — the entrypoint, the requirements file and the routing config all live there. If the Root Directory is pointed at a sub-folder such as `ml`, the build fails with `No Flask entrypoint found`.

The dashboard, the static assets and the `/api` endpoints are all served by the same function. Serverless deployments have a read-only file system, so the service loads the trained model from the bundle and, if it is missing, retrains from `ml/data/fitness_habits.csv` in memory (about a second) instead of failing.

---

## 8. Sample data

The app ships with **clearly-labelled demonstration data** only:

- **Sample profile** — a 27-year-old beginner training 2×/week in a basic gym.
- **Sample progress log** — 8 weeks (56 days) of plausible entries.

When sample data is active:

- A yellow banner appears at the top of the Progress page: *"SAMPLE DATA IS LOADED"*.
- A `SAMPLE DATA MODE` badge appears in the header.
- Every sample row in the log table carries a **Sample** tag and is highlighted.
- Each stored entry is flagged `sample: true`.
- The exported CSV/JSON includes a `sample` column and an explanatory note.

**"Remove sample data"** deletes the sample log and the sample profile and returns the app to its empty state.

---

## 9. Data storage

All data lives in the browser under these `localStorage` keys:

| Key | Contents |
| --- | --- |
| `fha.profile` | The saved habit profile |
| `fha.progressLogs` | All daily check-in entries |
| `fha.settings` | Flags such as `sample: true` |
| `fha.checklist` | Daily habit checklist tick state, keyed by date |
| `fha.lastUndo` | The last deleted entry, for the Undo button |

Nothing is ever sent anywhere. The optional Python service runs on `127.0.0.1`; the profile is sent to it only when the ML panel asks for a prediction, and it is never written to disk by the service. **"Clear all data"** removes everything.

---

## 10. Testing

| Suite | Coverage | Result |
| --- | --- | --- |
| Logic test | 960 profile combinations (4 goals × 3 levels × 4 equipment types × 5 day counts × 4 session lengths) — verifies every plan produces a valid, equipment-usable, in-budget session with correct rest days | **All passed** |
| UI test | Full jsdom integration: profile submit → analysis → plan → schedule → checklist persistence → progress logging → charts → delete/undo → sample data → tips → navigation → clear data → **browser reload restores everything from storage** | **All passed, 0 console errors** |
| Model test (`ml/tests/test_model.py`) | Dataset schema, deliberate missing values, insufficient-data detection, label rules, feature mapping, imputation + scaling, achieved accuracy, "two different profiles → two different classes", every API endpoint, the Vercel WSGI entrypoint, the read-only (serverless) training path, static file serving | **18 passed** |

```bash
python -m pytest ml/tests -q
```

---

## 11. Disclaimer

This is an **educational demonstration**. The advice shown is general information, not medical or personalised dietary prescription. The calorie figures are simple rule-based estimates and may be inaccurate for any individual. The habit classification and workout categories come from models trained on a documented cohort whose lifestyle columns are simulated — they describe patterns in that cohort, not measured clinical outcomes. Anyone with a medical condition, an injury, who is pregnant, or who takes regular medication should consult a qualified doctor, physiotherapist or registered dietitian before changing training or diet.

---

## 12. Future scope

- Habit heat-map calendar view
- Export of the full workout plan to PDF / printable format
- Goal re-assessment after a set number of weeks
- More exercise movements and machine-specific alternatives
- Optional multi-user comparison of adherence rates
