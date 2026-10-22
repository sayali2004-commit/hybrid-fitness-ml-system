/* =====================================================================
   engine.js  —  Rule-based analysis + workout plan generation
   ---------------------------------------------------------------------
   No database, no machine learning. Every number produced here comes
   from an explicit rule that you can read in the "How the analysis works"
   panel of the app. This keeps the project explainable for a field
   project and easy to extend with new rules.
   ===================================================================== */

const Engine = (function () {

  /* -------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------- */
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const round1 = v => Math.round(v * 10) / 10;
  const round0 = v => Math.round(v);

  const EXERCISE_BY_ID = EXERCISES.reduce((map, ex) => { map[ex.id] = ex; return map; }, {});

  /* -------------------------------------------------------------------
     1. PERSONALISED TARGETS  (rule based estimates)
     ------------------------------------------------------------------- */
  const GOAL_PROTEIN_G = { loss: 1.8, muscle: 2.0, endurance: 1.4, health: 1.2 };
  const GOAL_PROTEIN_G_BEGINNER = { loss: 1.8, muscle: 1.6, endurance: 1.4, health: 1.2 };
  const GOAL_CALORIE_ADJUST = { loss: -400, muscle: 300, endurance: 0, health: -100 };
  const ACTIVITY_FACTOR = { sedentary: 1.25, light: 1.4, moderate: 1.55, active: 1.7 };
  const STEP_BASE = { sedentary: 7000, light: 8000, moderate: 9000, active: 10000 };
  const STEP_GOAL_ADJUST = { loss: 1000, muscle: 0, endurance: 500, health: 0 };

  function bmiInfo(weightKg, heightCm) {
    const h = heightCm / 100;
    const bmi = round1(weightKg / (h * h));
    let label = 'Healthy range', tone = 'good';
    if (bmi < 18.5) { label = 'Underweight'; tone = 'warn'; }
    else if (bmi < 25) { label = 'Healthy range'; tone = 'good'; }
    else if (bmi < 30) { label = 'Overweight'; tone = 'warn'; }
    else if (bmi < 35) { label = 'Obese (class I)'; tone = 'bad'; }
    else if (bmi < 40) { label = 'Obese (class II)'; tone = 'bad'; }
    else { label = 'Obese (class III)'; tone = 'bad'; }
    return { bmi: bmi, label: label, tone: tone };
  }

  function bmrEstimate(profile) {
    const w = Number(profile.weight) || 70;
    const h = Number(profile.height) || 170;
    const a = Number(profile.age) || 25;
    const male = 10 * w + 6.25 * h - 5 * a + 5;
    const female = 10 * w + 6.25 * h - 5 * a - 161;
    if (profile.sex === 'male') return round0(male);
    if (profile.sex === 'female') return round0(female);
    return round0((male + female) / 2);
  }

  function targets(profile) {
    const goal = profile.goal || 'health';
    const bmr = bmrEstimate(profile);
    const factor = ACTIVITY_FACTOR[profile.activityLevel] || 1.4;
    const tdee = round0(bmr * factor);
    const adjust = GOAL_CALORIE_ADJUST[goal] || 0;
    let calories = tdee + adjust;
    if (goal === 'loss') calories = Math.max(calories, round0(bmr * 1.05));
    calories = round0(calories);

    const pFactor = (profile.experience === 'beginner' ? GOAL_PROTEIN_G_BEGINNER : GOAL_PROTEIN_G)[goal];
    const protein = round0((Number(profile.weight) || 70) * pFactor);

    const waterMl = round0((Number(profile.weight) || 70) * 35);
    const waterGlasses = Math.max(6, round0(waterMl / 250));

    const steps = (STEP_BASE[profile.activityLevel] || 8000) + (STEP_GOAL_ADJUST[goal] || 0);
    const sleep = 8;

    const bmi = bmiInfo(profile.weight, profile.height);
    const workoutMinutes = (Number(profile.daysPerWeek) || 3) * (Number(profile.sessionMinutes) || 45);

    return {
      bmr: bmr,
      tdee: tdee,
      calories: calories,
      protein: protein,
      proteinPerKg: pFactor,
      waterMl: waterMl,
      waterGlasses: waterGlasses,
      steps: steps,
      sleep: sleep,
      bmi: bmi,
      workoutMinutes: workoutMinutes
    };
  }

  /* -------------------------------------------------------------------
     2. HABIT DIMENSION SCORING
     Each dimension returns { score, notes[], rules[] } — the rules are
     shown to the user so the scoring is never a black box.
     ------------------------------------------------------------------- */
  const DIMENSION_WEIGHTS = {
    consistency: 0.25,
    nutrition: 0.20,
    hydration: 0.15,
    sleep: 0.15,
    activity: 0.15,
    motivation: 0.10
  };

  function scoreConsistency(p) {
    const target = Number(p.daysPerWeek) || 3;
    const actual = Number(p.workoutsPerWeek) || 0;
    const skipped = Number(p.skippedPerWeek) || 0;
    const motivation = Number(p.motivation) || 5;
    const rules = [];
    let score;
    let notes = [];

    if (actual === 0) {
      score = 5;
      notes.push('No structured training recorded in the last 4 weeks.');
      rules.push({ c: 'workouts per week = 0', e: 'Consistency score set to 5/100' });
    } else {
      const ratio = actual / target;
      score = 45 + 55 * Math.min(ratio, 1);
      rules.push({ c: 'score = 45 + 55 × min(actual ÷ planned, 1)', e: 'Frequent, planned training scores highest' });
      if (ratio > 1) notes.push('You train more often than your own plan — make sure recovery keeps up.');
      else if (ratio < 0.4) notes.push('You complete well under half of the sessions you planned.');
      else if (ratio < 0.95) notes.push('You complete ' + Math.round(ratio * 100) + '% of the sessions you planned.');
      else notes.push('You complete your planned sessions reliably.');
    }

    if (skipped > 1) {
      score -= 6 * (skipped - 1);
      notes.push(skipped + ' sessions skipped per week.');
      rules.push({ c: 'skipped sessions > 1', e: '−6 points for each extra skipped session' });
    }
    if (motivation !== 5) {
      score += (motivation - 5) * 2;
      rules.push({ c: 'motivation rating differs from 5', e: '±2 points per rating point' });
    }

    return { score: clamp(round0(score), 0, 100), notes: notes, rules: rules };
  }

  function scoreNutrition(p) {
    const diet = Number(p.dietQuality) || 5;
    const proteinMeals = Number(p.proteinMeals) || 0;
    const junk = Number(p.junkFoodPerWeek) || 0;
    const rules = [];
    let notes = [];

    let score = 0.5 * (diet * 10) + 0.5 * (proteinMeals / 4 * 100);
    rules.push({ c: '50% diet rating + 50% protein-meal coverage', e: 'Both food quality and protein spread are required' });

    if (junk >= 7) { score -= 15; notes.push('Junk food or sugary drinks appear ' + junk + ' times a week.'); rules.push({ c: 'junk food ≥ 7 / week', e: '−15 points' }); }
    else if (junk >= 4) { score -= 8; notes.push('Junk food or sugary drinks appear ' + junk + ' times a week.'); rules.push({ c: 'junk food 4–6 / week', e: '−8 points' }); }
    else if (junk <= 1) { score += 5; notes.push('Processed food intake is well controlled.'); rules.push({ c: 'junk food ≤ 1 / week', e: '+5 points' }); }

    if (proteinMeals <= 1) notes.push('Protein is present in only ' + proteinMeals + ' meal(s) a day.');
    else if (proteinMeals >= 3) notes.push('Protein is spread across ' + proteinMeals + ' meals a day.');

    return { score: clamp(round0(score), 0, 100), notes: notes, rules: rules };
  }

  function scoreHydration(p, t) {
    const target = t.waterGlasses;
    const actual = Number(p.waterGlasses) || 0;
    const rules = [{ c: 'target = 35 ml × body weight ÷ 250 ml per glass', e: 'Minimum 6 glasses' }];
    let notes = [];
    let score;

    if (actual === 0) { score = 0; }
    else if (actual >= target) {
      score = Math.min(100, 95 + (actual - target) * 2);
      notes.push('You reach your hydration target of ' + target + ' glasses.');
    } else {
      score = 70 * (actual / target);
      notes.push('You drink ' + actual + ' of ' + target + ' recommended glasses (' + Math.round(actual / target * 100) + '%).');
    }
    rules.push({ c: 'below target → 70 × (actual ÷ target); at or above target → 95+', e: 'Rewards steady, adequate fluid intake' });

    return { score: clamp(round0(score), 0, 100), notes: notes, rules: rules };
  }

  function scoreSleep(p) {
    const h = Number(p.sleepHours) || 0;
    const screen = !!p.screenBeforeBed;
    const rules = [{ c: '7–9 h = 75–100 points, 6–7 h = 45–75, under 6 h scaled down', e: 'Sleep is scored on a curve, not a pass/fail' }];
    let notes = [];
    let score;

    if (h < 6) { score = 45 * (h / 6); notes.push('You average ' + h + ' h — this is a sleep deficit.'); }
    else if (h < 7) { score = 45 + (h - 6) * 30; notes.push('You average ' + h + ' h — slightly below the 7–9 h range.'); }
    else if (h < 8.5) { score = 75 + (h - 7) / 1.5 * 25; notes.push('You average ' + h + ' h — inside the optimal 7–9 h range.'); }
    else { score = 100; notes.push('You average ' + h + ' h — more than most people need.'); }

    if (screen) {
      score -= 8;
      notes.push('Screen use in the hour before bed delays sleep onset.');
      rules.push({ c: 'screen use before bed', e: '−8 points' });
    }
    return { score: clamp(round0(score), 0, 100), notes: notes, rules: rules };
  }

  function scoreActivity(p) {
    const steps = Number(p.steps) || 0;
    const level = p.activityLevel || 'light';
    const rules = [{ c: 'steps under 4 000 → scaled 0–50; 4 000–8 000 → 50–85; above 8 000 → 85–100', e: 'Daily movement is scored independently of formal training' }];
    let notes = [];
    let score;

    if (steps < 4000) score = 50 * (steps / 4000);
    else if (steps < 8000) score = 50 + (steps - 4000) / 4000 * 35;
    else if (steps < 12000) score = 85 + (steps - 8000) / 4000 * 15;
    else score = 100;

    const levelAdj = { sedentary: -10, light: 0, moderate: 5, active: 10 }[level];
    if (levelAdj) {
      score += levelAdj;
      rules.push({ c: 'job / lifestyle activity modifier', e: (levelAdj > 0 ? '+' : '') + levelAdj + ' points' });
    }

    if (steps < 5000) notes.push('Your daily step count is low — most calories are still unused.');
    else if (steps < 8000) notes.push('You are ' + (8000 - steps) + ' steps below the classic 8 000-step goal.');
    else notes.push('Your daily movement level is good.');

    return { score: clamp(round0(score), 0, 100), notes: notes, rules: rules };
  }

  function scoreMotivation(p) {
    const motivation = Number(p.motivation) || 5;
    const tracks = !!p.tracksProgress;
    const rules = [
      { c: 'motivation rating × 8', e: 'Contributes up to 80 points' },
      { c: 'progress tracking habit used', e: '+20 points' }
    ];
    let notes = [];
    let score = motivation * 8;

    if (tracks) { score += 20; notes.push('You already record your training or food — this is the strongest habit for long-term change.'); }
    else { notes.push('You do not currently record your training, food or weight.'); }

    if (motivation <= 4) notes.push('Your motivation rating is low — the plan should start small and be easy to win.');
    else if (motivation >= 8) notes.push('Your motivation rating is high — you can afford slightly more ambitious targets.');

    return { score: clamp(round0(score), 0, 100), notes: notes, rules: rules };
  }

  function statusOf(score) {
    if (score >= 75) return { label: 'Excellent', tone: 'good' };
    if (score >= 60) return { label: 'Good', tone: 'good' };
    if (score >= 40) return { label: 'Needs attention', tone: 'warn' };
    return { label: 'Poor', tone: 'bad' };
  }

  /* -------------------------------------------------------------------
     3. PROBLEM DETECTION RULES
     Each rule is a plain condition that returns an object when it fires.
     ------------------------------------------------------------------- */
  const PROBLEM_RULES = [
    {
      id: 'no_training', dimension: 'consistency', severity: 'high', impact: 10,
      when: p => (Number(p.workoutsPerWeek) || 0) === 0,
      title: 'No structured training at all',
      detail: 'You reported zero workouts per week. Without a training stimulus, fat loss stalls and muscle, bone and cardiovascular fitness decline.',
      suggestion: 'Start with just 2 full-body sessions per week, 30–45 minutes each. Consistency in the first month matters far more than intensity.'
    },
    {
      id: 'very_low_frequency', dimension: 'consistency', severity: 'medium', impact: 7,
      when: p => { const a = Number(p.workoutsPerWeek) || 0; return a === 1; },
      title: 'Training frequency is below the effective minimum',
      detail: 'One session per week gives only about half the stimulus needed to progress, and each session becomes a recovery bottleneck for the other six days.',
      suggestion: 'Add one more session per week — even a 25-minute full-body circuit counts. Two sessions per week is the recognised minimum for visible change.'
    },
    {
      id: 'plan_gap', dimension: 'consistency', severity: 'medium', impact: 6,
      when: p => { const a = Number(p.workoutsPerWeek) || 0; const t = Number(p.daysPerWeek) || 3; return a >= 2 && a < t; },
      title: 'A gap between your plan and your practice',
      detail: p => 'You have scheduled ' + ((Number(p.daysPerWeek)) || 3) + ' training days but only complete ' + ((Number(p.workoutsPerWeek)) || 0) + '. The plan is realistic only if you shrink it or fix the gap.',
      suggestion: 'Either move two of your scheduled sessions to times you actually protect (same slot, same days), or reduce the plan to the number of days you can genuinely keep.'
    },
    {
      id: 'high_skips', dimension: 'consistency', severity: 'high', impact: 8,
      when: p => (Number(p.skippedPerWeek) || 0) >= 3,
      title: 'Frequent skipped sessions',
      detail: p => 'You skip ' + ((Number(p.skippedPerWeek)) || 0) + ' sessions per week. Repeated cancellations are the strongest predictor of quitting a programme altogether.',
      suggestion: 'Fix the trigger, not the willpower: pack the bag the night before, keep a fixed time slot, and use a "minimum session" rule — even 10 minutes counts on a bad day.'
    },
    {
      id: 'beginner_overvolume', dimension: 'consistency', severity: 'high', impact: 7,
      when: p => (Number(p.workoutsPerWeek) || 0) >= 5 && p.experience === 'beginner',
      title: 'Too much volume for a beginner',
      detail: 'Five or more sessions a week is demanding for a new trainee. The most common result is early burnout, soreness and quitting before any habit forms.',
      suggestion: 'Hold at 3 sessions per week for 4–6 weeks. Build the habit first, then add volume — the opposite order usually fails.'
    },
    {
      id: 'irregular_pattern', dimension: 'consistency', severity: 'medium', impact: 6,
      when: p => (Number(p.skippedPerWeek) || 0) >= 2 && (Number(p.workoutsPerWeek) || 0) >= 1,
      title: 'Irregular training pattern',
      detail: 'Your sessions come and go rather than following a fixed weekly rhythm. Irregular training produces irregular results, which is what makes people believe "it does not work".',
      suggestion: 'Pick a fixed number of days (for example Tuesday, Thursday, Saturday) and treat them like appointments. Write them into your calendar as non-negotiable events.'
    },
    {
      id: 'availability_mismatch', dimension: 'consistency', severity: 'medium', impact: 5,
      when: p => (Number(p.daysPerWeek) || 3) >= 5 && (Number(p.workoutsPerWeek) || 0) <= 2,
      title: 'Schedule does not match the time you actually have',
      detail: p => 'You have scheduled ' + ((Number(p.daysPerWeek)) || 3) + ' days but use only ' + ((Number(p.workoutsPerWeek)) || 0) + '. A plan that does not fit the calendar will always be skipped.',
      suggestion: 'Rewrite the plan around your real week: two or three reliable sessions you will never miss beat five theoretical ones.'
    },
    {
      id: 'low_diet_quality', dimension: 'nutrition', severity: 'high', impact: 8,
      when: p => (Number(p.dietQuality) || 5) <= 4,
      title: 'Low diet quality',
      detail: p => 'Your own rating of your diet is ' + ((Number(p.dietQuality)) || 5) + '/10. Poor diet quality is the most common reason weight-loss plateaus happen even while training is going well.',
      suggestion: 'Change one thing at a time: build one solid protein meal and one vegetable dish into every main meal for two weeks before adding any other change.'
    },
    {
      id: 'junk_food_high', dimension: 'nutrition', severity: 'high', impact: 7,
      when: p => (Number(p.junkFoodPerWeek) || 0) >= 7,
      title: 'Frequent junk food and sugary drinks',
      detail: p => 'You consume junk food or sugary drinks ' + ((Number(p.junkFoodPerWeek)) || 0) + ' times a week. Even a small number of high-calorie items can erase a whole week of careful eating.',
      suggestion: 'Set a hard limit of 2 planned instances per week and remove sugary drinks from your daily routine entirely — this is usually the single biggest calorie lever.'
    },
    {
      id: 'junk_food_moderate', dimension: 'nutrition', severity: 'low', impact: 4,
      when: p => { const j = Number(p.junkFoodPerWeek) || 0; return j >= 4 && j < 7; },
      title: 'Processed food appears most days',
      detail: p => 'Junk food or sugary drinks appear ' + ((Number(p.junkFoodPerWeek)) || 0) + ' times a week — close to daily.',
      suggestion: 'Bring the number down to 3 times a week by planning two "clean" meals in advance for the days you know are at risk.'
    },
    {
      id: 'low_protein', dimension: 'nutrition', severity: 'medium', impact: 6,
      when: p => (Number(p.proteinMeals) || 0) <= 1,
      title: 'Protein is not spread through the day',
      detail: p => 'Protein appears in only ' + ((Number(p.proteinMeals)) || 0) + ' meal(s) per day. Muscle repair and fullness both depend on protein arriving regularly, not in one big meal.',
      suggestion: 'Aim for a protein source in 3–4 meals. Eggs, curd, dal, paneer, chicken, fish, tofu, beans or Greek yoghurt are inexpensive options.'
    },
    {
      id: 'dehydration', dimension: 'hydration', severity: 'high', impact: 7,
      when: (p, t) => (Number(p.waterGlasses) || 0) < t.waterGlasses * 0.6,
      title: 'Dehydration risk',
      detail: (p, t) => 'You drink about ' + ((Number(p.waterGlasses)) || 0) + ' glasses a day against a recommended ' + t.waterGlasses + '. Mild dehydration raises perceived effort, impairs concentration and can be mistaken for low motivation.',
      suggestion: 'Front-load: drink 500–700 ml within an hour of waking, then keep a filled bottle visible at your desk.'
    },
    {
      id: 'low_hydration', dimension: 'hydration', severity: 'medium', impact: 5,
      when: (p, t) => { const w = Number(p.waterGlasses) || 0; return w >= t.waterGlasses * 0.6 && w < t.waterGlasses; },
      title: 'Hydration is below target',
      detail: (p, t) => 'You are about ' + (t.waterGlasses - (Number(p.waterGlasses) || 0)) + ' glasses a day short of your target.',
      suggestion: 'Set two fixed "drink" reminders in your phone, at times you are always free, and attach them to existing routines such as after your morning tea or after lunch.'
    },
    {
      id: 'sleep_deficit', dimension: 'sleep', severity: 'high', impact: 9,
      when: p => (Number(p.sleepHours) || 0) < 6,
      title: 'Chronic sleep deficit',
      detail: p => 'You average ' + ((Number(p.sleepHours)) || 0) + ' hours of sleep. Short sleep raises hunger, reduces training quality and impairs recovery — it works against every other goal you set.',
      suggestion: 'Move your bedtime back by 15–20 minutes every three days rather than one big jump. Protect a fixed wake time, including on rest days.'
    },
    {
      id: 'sleep_below_optimal', dimension: 'sleep', severity: 'medium', impact: 6,
      when: p => { const h = Number(p.sleepHours) || 0; return h >= 6 && h < 7.5; },
      title: 'Sleep is below the optimal range',
      detail: p => 'At ' + ((Number(p.sleepHours)) || 0) + ' hours you are slightly under the 7–9 hour range that most adults need for good training output.',
      suggestion: 'Aim for a 7.5–8 hour window. Morning daylight and no screens in the last hour are the two changes with the fastest effect.'
    },
    {
      id: 'screen_before_bed', dimension: 'sleep', severity: 'medium', impact: 5,
      when: p => !!p.screenBeforeBed,
      title: 'Screen use before bed',
      detail: 'Using a phone or TV in the hour before bed delays sleep onset and shortens total sleep time, which then affects the next day of training.',
      suggestion: 'Charge the phone outside the bedroom and replace the screen hour with reading, a short stretch routine or slow breathing.'
    },
    {
      id: 'sedentary_days', dimension: 'activity', severity: 'medium', impact: 6,
      when: p => (Number(p.steps) || 0) < 5000,
      title: 'Low daily movement',
      detail: p => 'You average ' + ((Number(p.steps)) || 0) + ' steps a day. A sedentary day outside the gym can cancel much of the calorie burn from a 45-minute session.',
      suggestion: 'Add a 10–15 minute walk after two meals each day. Walking is the lowest-effort, highest-return activity for daily activity.'
    },
    {
      id: 'steps_below_target', dimension: 'activity', severity: 'low', impact: 4,
      when: p => { const s = Number(p.steps) || 0; return s >= 5000 && s < 8000; },
      title: 'Step count is below the daily target',
      detail: p => 'At ' + ((Number(p.steps)) || 0) + ' steps you are below the 8 000-step level that is associated with better cardiovascular and metabolic health.',
      suggestion: 'Add 1 500–2 000 steps on top of your current habit — a short walk after lunch is usually enough to close the gap.'
    },
    {
      id: 'low_motivation', dimension: 'motivation', severity: 'high', impact: 8,
      when: p => (Number(p.motivation) || 0) <= 4,
      title: 'Low motivation towards training',
      detail: p => 'You rated your motivation ' + ((Number(p.motivation)) || 0) + '/10. Low motivation is usually a symptom — unclear goals, no visible progress, or an intimidating routine.',
      suggestion: 'Set one tiny daily action (for example "show up for 20 minutes") and one visible measure to track. Visible small wins rebuild motivation faster than motivation builds results.'
    },
    {
      id: 'no_tracking', dimension: 'motivation', severity: 'medium', impact: 6,
      when: p => !p.tracksProgress,
      title: 'No progress tracking habit',
      detail: 'You are not recording workouts, meals or weight. Without a record, improvement is invisible — and unseen progress is the main reason people quit.',
      suggestion: 'Use the Progress tab in this app. One entry a day (weight, water, sleep, workouts) takes about 30 seconds and turns effort into evidence.'
    },
    {
      id: 'diet_without_training', dimension: 'nutrition', severity: 'high', impact: 9,
      when: p => p.goal === 'loss' && (Number(p.dietQuality) || 5) <= 4 && (Number(p.workoutsPerWeek) || 0) <= 1,
      title: 'Dieting without resistance training',
      detail: 'With little training and a low diet rating, weight loss comes mostly from muscle rather than fat, and your resting metabolism drops as a result.',
      suggestion: 'Keep the diet change, but add 2 resistance sessions per week. Preserving muscle is what makes a calorie deficit work without damaging your shape or metabolism.'
    },
    {
      id: 'muscle_goal_high_bmi', dimension: 'nutrition', severity: 'medium', impact: 6,
      when: (p, t) => p.goal === 'muscle' && t.bmi.bmi >= 30,
      title: 'Muscle-gain goal while carrying excess body fat',
      detail: 'A surplus-calorie muscle plan started at a high body fat level mainly adds fat. This is a coaching judgement, not a medical one, and it is worth discussing with a professional.',
      suggestion: 'Move to a maintenance or mild deficit phase first for 8–12 weeks, then build muscle slowly from a leaner base.'
    },
    {
      id: 'loss_goal_low_bmi', dimension: 'nutrition', severity: 'medium', impact: 6,
      when: (p, t) => p.goal === 'loss' && t.bmi.bmi < 18.5,
      title: 'Fat-loss goal while already below the healthy BMI range',
      detail: (p, t) => 'Your BMI of ' + t.bmi.bmi + ' is below the standard healthy range, so a calorie deficit may not be the right starting point.',
      suggestion: 'Aim for maintenance plus performance (strength, endurance, mobility) instead of a deficit. Please talk to a doctor or dietitian before restricting calories.'
    },
    {
      id: 'endurance_sleep_issue', dimension: 'sleep', severity: 'medium', impact: 6,
      when: p => p.goal === 'endurance' && (Number(p.sleepHours) || 0) < 7,
      title: 'Endurance training is being limited by sleep',
      detail: p => 'Endurance adaptation happens mostly during recovery. At ' + ((Number(p.sleepHours)) || 0) + ' hours of sleep, extra training volume is absorbed less efficiently.',
      suggestion: 'Protect sleep before adding kilometres. Keep easy days genuinely easy so recovery is not the limiting factor.'
    },
    {
      id: 'long_sessions_beginner', dimension: 'consistency', severity: 'low', impact: 3,
      when: p => (Number(p.sessionMinutes) || 45) >= 75 && p.experience === 'beginner',
      title: 'Sessions are too long for a beginner',
      detail: p => 'A ' + ((Number(p.sessionMinutes)) || 45) + '-minute session is hard to sustain when you are new, and long sessions raise the chance of skipped workouts.',
      suggestion: 'Cut the session to 35–45 minutes and focus on 4–5 exercises done well. You can extend it later once it stops feeling like a chore.'
    },
    {
      id: 'session_time_mismatch', dimension: 'consistency', severity: 'low', impact: 4,
      when: p => (Number(p.workoutsPerWeek) || 0) >= 3 && (Number(p.sessionMinutes) || 45) >= 75,
      title: 'Total weekly time commitment is very high',
      detail: p => (Number(p.daysPerWeek) || 3) + ' sessions of ' + ((Number(p.sessionMinutes)) || 45) + ' minutes is roughly ' + ((Number(p.daysPerWeek) || 3) * (Number(p.sessionMinutes) || 45)) + ' minutes a week — a large commitment that is easy to break.',
      suggestion: 'Keep the same number of days but shorten the sessions to 45–50 minutes by removing the lowest-priority accessories.'
    }
  ];

  /* -------------------------------------------------------------------
     4. SUGGESTION LIBRARY (general + goal specific)
     ------------------------------------------------------------------- */
  const GENERAL_SUGGESTIONS = {
    start_small: { title: 'Start smaller than you think', action: 'Commit to 2 sessions of 30 minutes per week for the first 4 weeks.', why: 'A habit you keep beats a plan you abandon. Volume can be increased later, but a missed week is hard to recover from.' },
    fixed_slot: { title: 'Anchor training to a fixed time slot', action: 'Pick the same 3 slots in your week (e.g. Tue/Thu/Sat 6:30 pm) and treat them as appointments.', why: 'Fixed timing removes daily decision-making, which is where most routines quietly die.' },
    minimum_session: { title: 'Use a minimum-session rule', action: 'On a bad day, do a 10-minute version of the session instead of skipping it entirely.', why: 'The rule protects the habit while keeping momentum. Often the full session follows once you have started.' },
    progressive_overload: { title: 'Progress in small, measurable steps', action: 'Add 1 rep per set or 2–5% more load once you complete every set at the top of the rep range.', why: 'Muscle and fitness only adapt when the demand slightly exceeds current ability.' },
    warm_up: { title: 'Never skip the warm-up', action: 'Spend 5–10 minutes on easy cardio and dynamic mobility before the first working set.', why: 'Warmed-up muscles and joints perform better and are far less likely to be injured.' },
    deload: { title: 'Plan a lighter week every 4–6 weeks', action: 'Cut the load or the number of sets by about 40% for one week.', why: 'Deloading clears fatigue so the next training block produces progress instead of a plateau.' },
    track: { title: 'Log every session', action: 'Record the exercise, load and reps for each set in the Progress tab.', why: 'Records remove guesswork from progression and make motivation self-reinforcing.' },
    sleep_first: { title: 'Treat sleep as a training session', action: 'Protect a fixed 7.5–8 hour sleep window, starting 30 days before you expect results.', why: 'Sleep drives recovery, appetite control and focus. It is the cheapest performance gain available.' },
    walk: { title: 'Add a 15-minute walk after two meals', action: 'Walk briskly for 15 minutes after lunch and dinner, every day.', why: 'Walking is the easiest way to raise daily activity and it reliably improves appetite and glucose control.' },
    protein_spread: { title: 'Spread protein across the day', action: 'Include a protein source in 3–4 meals instead of one large evening portion.', why: 'Evenly distributed protein supports muscle repair and keeps you full between meals.' },
    reduce_junk: { title: 'Cut sugary drinks first', action: 'Replace sugary drinks with water or unsweetened tea for two weeks.', why: 'Liquid calories are the easiest to remove and give the fastest visible change in body composition.' },
    meal_prep: { title: 'Batch-prep two meals a week', action: 'Cook two main meals during a free window on a non-training day.', why: 'Preparation removes the decision on the days when you are tired, which is when takeouts win.' },
    track_progress: { title: 'Track progress in three numbers only', action: 'Record weight (weekly), workouts completed and sleep average.', why: 'A small number of consistent measures is easier to maintain and enough to see real trends.' },
    set_goals: { title: 'Write down one specific goal', action: 'Write a single measurable goal, e.g. "complete 3 sessions per week for 8 weeks".', why: 'Vague goals create inconsistent effort; specific, countable goals create a checklist.' },
    rest_day: { title: 'Keep rest days genuinely restful', action: 'Schedule rest days and use them for a walk and mobility work, not for "catch-up" training.', why: 'Rest days are when adaptation happens. Training hard on rest days usually just slows progress down.' }
  };

  const GOAL_SUGGESTIONS = {
    loss: {
      deficit: { title: 'Use a moderate calorie deficit', action: 'Aim for roughly a 300–500 kcal daily deficit rather than a crash diet.', why: 'A moderate deficit protects muscle, training quality and your mental energy, and is far more likely to be maintained.' },
      protein: { title: 'Protect muscle with adequate protein', action: 'Target about 1.6–1.8 g of protein per kg of body weight per day.', why: 'In a deficit, protein determines how much of the weight lost is fat rather than muscle.' },
      resistance: { title: 'Keep resistance training in the plan', action: 'Train with weights at least 2 times per week even when focusing on fat loss.', why: 'Resistance training signals your body to keep muscle while it loses fat, which also protects your metabolism.' },
      cardio: { title: 'Add daily movement, not just gym cardio', action: 'Aim for your step target and keep the formal cardio short and intense.', why: 'Non-exercise activity burns more calories over a week than most people realise, and it is easier to sustain.' }
    },
    muscle: {
      progressive: { title: 'Track progressive overload', action: 'Write down the load and reps for every set and beat last week\'s numbers.', why: 'Muscle growth requires the demand to slowly rise over time; identical workouts stop producing results.' },
      protein: { title: 'Hit a higher protein target', action: 'Target about 1.6–2.0 g of protein per kg of body weight per day.', why: 'Protein supplies the building material for muscle repair and supports training recovery.' },
      surplus: { title: 'Eat a small, controlled surplus', action: 'Eat around 200–300 kcal above your maintenance estimate.', why: 'A large surplus mostly adds fat, while a small surplus supports muscle gain without excess fat gain.' },
      sleep: { title: 'Prioritise recovery for muscle growth', action: 'Keep 7.5–8.5 hours of sleep and keep a rest day between hard muscle sessions.', why: 'Muscle is built during recovery, not during the session itself.' }
    },
    endurance: {
      intervals: { title: 'Use intervals plus one long easy session', action: 'Do 1 interval session and 1 steady easy session of 30–45 minutes per week.', why: 'Intervals build fitness quickly; a long easy session builds the aerobic base that supports them.' },
      easy_days: { title: 'Keep easy days genuinely easy', action: 'Hold easy sessions at a pace where you could talk in full sentences.', why: 'Easy volume creates the aerobic base; hard days on top of it simply create fatigue.' },
      fuel: { title: 'Fuel endurance sessions with carbohydrates', action: 'Eat a carbohydrate-rich meal 2–3 hours before a long session and bring water.', why: 'Carbohydrate is the primary fuel for endurance work, and under-fuelling ends sessions early.' },
      progressive: { title: 'Build volume gradually', action: 'Increase total weekly distance or time by no more than about 10% per week.', why: 'A measured increase lets the body adapt; sudden jumps cause injury and burnout.' }
    },
    health: {
      balanced: { title: 'Build a balanced weekly rhythm', action: 'Aim for 2–3 full-body sessions, regular daily movement and a consistent sleep window.', why: 'General health improves through a repeatable weekly pattern rather than through any single method.' },
      variety: { title: 'Mix strength, cardio and mobility', action: 'Include strength work, some cardio and 10 minutes of mobility each week.', why: 'Different training modes train different capacities, and variety reduces boredom and injury.' },
      consistency: { title: 'Protect consistency over intensity', action: 'Choose an easy-to-sustain effort level and keep it for 8 weeks before progressing.', why: 'Consistent moderate training outperforms intense bursts followed by long breaks.' }
    }
  };

  /* -------------------------------------------------------------------
     5. ANALYSIS PIPELINE
     ------------------------------------------------------------------- */
  function analyse(profile) {
    if (!profile) return null;
    const t = targets(profile);

    const dims = [
      { key: 'consistency', ...scoreConsistency(profile) },
      { key: 'nutrition', ...scoreNutrition(profile) },
      { key: 'hydration', ...scoreHydration(profile, t) },
      { key: 'sleep', ...scoreSleep(profile) },
      { key: 'activity', ...scoreActivity(profile) },
      { key: 'motivation', ...scoreMotivation(profile) }
    ].map(d => {
      const st = statusOf(d.score);
      return Object.assign({}, d, {
        label: LABELS.dimension[d.key],
        weight: DIMENSION_WEIGHTS[d.key],
        status: st.label,
        tone: st.tone
      });
    });

    const overall = clamp(round0(dims.reduce((s, d) => s + d.score * d.weight, 0)), 0, 100);

    const problems = PROBLEM_RULES
      .filter(rule => rule.when(profile, t))
      .map(rule => ({
        id: rule.id,
        dimension: rule.dimension,
        dimensionLabel: LABELS.dimension[rule.dimension],
        severity: rule.severity,
        impact: rule.impact,
        title: typeof rule.title === 'function' ? rule.title(profile, t) : rule.title,
        detail: typeof rule.detail === 'function' ? rule.detail(profile, t) : rule.detail,
        suggestion: typeof rule.suggestion === 'function' ? rule.suggestion(profile, t) : rule.suggestion
      }))
      .sort((a, b) => b.impact - a.impact);

    /* Build the suggestion list: one per detected problem first, then
       goal-specific and general habits. */
    const suggestions = [];
    const used = new Set();
    problems.forEach(pr => {
      if (suggestions.length >= 8) return;
      if (used.has(pr.suggestion)) return;
      used.add(pr.suggestion);
      suggestions.push({
        title: pr.title,
        action: pr.suggestion,
        why: pr.detail,
        source: 'Fix this first',
        priority: pr.impact,
        tone: pr.severity === 'high' ? 'bad' : pr.severity === 'medium' ? 'warn' : 'info'
      });
    });

    const goalSug = GOAL_SUGGESTIONS[profile.goal] || GOAL_SUGGESTIONS.health;
    Object.keys(goalSug).forEach(key => {
      if (suggestions.length >= 12) return;
      const g = goalSug[key];
      if (used.has(g.title)) return;
      used.add(g.title);
      suggestions.push({
        title: g.title, action: g.action, why: g.why,
        source: 'Goal: ' + (LABELS.goal[profile.goal] || 'General fitness'),
        priority: 6, tone: 'info'
      });
    });

    const generalOrder = ['fixed_slot', 'protein_spread', 'sleep_first', 'track_progress', 'walk', 'progressive_overload', 'warm_up', 'track', 'deload', 'rest_day', 'meal_prep', 'reduce_junk', 'minimum_session', 'start_small', 'set_goals'];
    generalOrder.forEach(key => {
      if (suggestions.length >= 14) return;
      const g = GENERAL_SUGGESTIONS[key];
      if (!g || used.has(g.title)) return;
      used.add(g.title);
      suggestions.push({
        title: g.title, action: g.action, why: g.why,
        source: 'General habit', priority: 4, tone: 'info'
      });
    });

    suggestions.sort((a, b) => b.priority - a.priority);

    return {
      profile: profile,
      targets: t,
      dimensions: dims,
      overall: overall,
      overallStatus: statusOf(overall),
      problems: problems,
      suggestions: suggestions,
      problemCounts: {
        high: problems.filter(p => p.severity === 'high').length,
        medium: problems.filter(p => p.severity === 'medium').length,
        low: problems.filter(p => p.severity === 'low').length
      }
    };
  }

  /* -------------------------------------------------------------------
     6. WORKOUT PLAN GENERATION
     ------------------------------------------------------------------- */

  /* Explicit substitutions keep the plan realistic per equipment level
     instead of silently dropping exercises. */
  const EQUIPMENT_SUB = {
    back_squat:     { basic_gym: 'leg_press', home: 'squat_goblet', outdoor: 'squat_goblet' },
    bench_barbell:  { basic_gym: 'db_bench', home: 'push_up', outdoor: 'push_up' },
    deadlift:       { basic_gym: 'rdl_db', home: 'rdl_db', outdoor: 'rdl_db' },
    barbell_row:    { basic_gym: 'db_row', home: 'db_row', outdoor: 'db_row' },
    pull_up:        { basic_gym: 'lat_pulldown', home: 'band_row', outdoor: 'band_row' },
    lat_pulldown:   { home: 'band_row', outdoor: 'band_row' },
    cable_row:      { basic_gym: 'db_row', home: 'band_row', outdoor: 'band_row' },
    leg_press:      { home: 'squat_goblet', outdoor: 'squat_goblet' },
    hip_thrust:     { basic_gym: 'glute_bridge', home: 'glute_bridge', outdoor: 'glute_bridge' },
    leg_curl:       { basic_gym: 'glute_bridge', home: 'glute_bridge', outdoor: 'glute_bridge' },
    lateral_raise:  { basic_gym: 'db_lateral_raise', home: 'db_lateral_raise', outdoor: 'band_pullapart' },
    face_pull:      { basic_gym: 'rear_delt_db', home: 'band_pullapart', outdoor: 'band_pullapart' },
    triceps_push:   { basic_gym: 'close_grip_pushup', home: 'close_grip_pushup', outdoor: 'close_grip_pushup' },
    treadmill:      { basic_gym: 'bike', home: 'jump_rope', outdoor: 'brisk_walk' },
    row_erg:        { basic_gym: 'battle_rope', home: 'jump_rope', outdoor: 'jump_rope' },
    battle_rope:    { basic_gym: 'jump_rope', home: 'jump_rope', outdoor: 'jump_rope' },
    sled_push:      { basic_gym: 'brisk_walk', home: 'brisk_walk', outdoor: 'brisk_walk' },
    bike:           { home: 'jump_rope', outdoor: 'brisk_walk' },
    stair_climber:  { basic_gym: 'jump_rope', home: 'jump_rope', outdoor: 'brisk_walk' },
    box_jump:       { basic_gym: 'squat_jump', home: 'squat_jump', outdoor: 'squat_jump' },
    hanging_leg_raise: { basic_gym: 'leg_raise', home: 'leg_raise', outdoor: 'leg_raise' }
  };

  /* Beginner-friendly swaps for advanced movements. */
  const LEVEL_SUB = {
    back_squat: 'leg_press',
    bench_barbell: 'db_bench',
    pull_up: 'lat_pulldown',
    barbell_row: 'db_row',
    deadlift: 'rdl_db',
    hanging_leg_raise: 'leg_raise',
    box_jump: 'squat_jump'
  };

  /* Two muscle groups are treated as related when one is part of the
     other, e.g. "Glutes" and "Quads / Glutes". */
  function muscleOverlap(a, b) {
    const x = String(a).toLowerCase(), y = String(b).toLowerCase();
    return x === y || x.indexOf(y) !== -1 || y.indexOf(x) !== -1;
  }

  /* Pick the best possible movement for this user.
     `avoid` holds movements already used in the same session so the plan
     does not repeat the same exercise twice. */
  function resolveExercise(id, equipment, experience, avoid) {
    avoid = avoid || new Set();
    const original = EXERCISE_BY_ID[id] || EXERCISE_BY_ID['plank'];
    const available = e => !!e && e.equipment.indexOf(equipment) !== -1;
    const fresh = e => available(e) && !avoid.has(e.id);

    /* Perfect match: the movement works with this equipment. */
    if (fresh(original)) {
      if (experience === 'beginner' && original.level >= 3) {
        const swap = EXERCISE_BY_ID[LEVEL_SUB[original.id]];
        if (fresh(swap) && swap.level < original.level) return swap;
        /* No explicit swap available — look for any easier version of the
           same movement that this user can perform. */
        const easier = EXERCISES.find(e =>
          fresh(e) && e.level < original.level && muscleOverlap(e.muscle, original.muscle));
        if (easier) return easier;
      }
      return original;
    }

    /* Otherwise choose in priority order:
       equipment substitute → simpler variant → same muscle → related
       muscle → compound movement → same type → any                             */
    const candidates = [];
    const eqMap = EQUIPMENT_SUB[original.id];
    if (eqMap && eqMap[equipment]) candidates.push(EXERCISE_BY_ID[eqMap[equipment]]);
    if (LEVEL_SUB[original.id]) candidates.push(EXERCISE_BY_ID[LEVEL_SUB[original.id]]);
    EXERCISES.filter(e => e.muscle === original.muscle).forEach(e => candidates.push(e));
    EXERCISES.filter(e => muscleOverlap(e.muscle, original.muscle)).forEach(e => candidates.push(e));
    EXERCISES.filter(e => e.type === 'compound').forEach(e => candidates.push(e));
    EXERCISES.filter(e => e.type === original.type).forEach(e => candidates.push(e));
    EXERCISES.filter(e => e.type === 'cardio').forEach(e => candidates.push(e));
    EXERCISES.forEach(e => candidates.push(e));

    return candidates.find(fresh) || original;
  }

  /* Cardio movements split into two kinds:
     LONG    — continuous machines / walking (treadmill, bike, rower…)
     CIRCUIT — interval-style movements (burpees, jump rope, climbers…)   */
  const LONG_CARDIO = ['treadmill', 'bike', 'row_erg', 'stair_climber', 'brisk_walk'];
  const CIRCUIT_CARDIO = ['burpee', 'mountain_climber', 'squat_jump', 'high_knees',
    'jumping_jack', 'jump_rope', 'battle_rope', 'sled_push', 'box_jump', 'kettlebell_swing'];

  /* Estimated minutes per exercise, given the working-set count actually
     used and the length of the cardio block. */
  function estimateMinutes(ex, sets) {
    switch (ex.type) {
      case 'core':      return 1.5 * (sets || 1) + 1;
      case 'mobility':  return 1.5;
      case 'isolation': return 2.5 * (sets || 1) + 1;
      default:          return 3.5 * (sets || 1) + 1;
    }
  }

  function prescribeExercise(ex, presc, sets, card) {
    switch (ex.type) {
      case 'cardio':
        if (card.kind === 'block')     return { sets: '1 block', reps: card.minutes + ' min continuous', rest: 60 };
        if (card.kind === 'secondary') return { sets: '1 block', reps: card.minutes + ' min', rest: 60 };
        return { sets: card.rounds + ' rounds', reps: '30 s work / 60 s rest', rest: 0 };
      case 'core':
        return { sets: sets, reps: '30–60 sec hold / 12–20 reps', rest: 30 };
      case 'mobility':
        return { sets: 1, reps: '30–45 sec each side', rest: 15 };
      default:
        if (ex.presc) return { sets: sets, reps: ex.presc, rest: presc.rest };
        return { sets: sets, reps: presc.reps, rest: presc.rest };
    }
  }

  /* -------------------------------------------------------------------
     Build one session that fits the user's time budget.
     Step 1  resolve every template pick to an available, non-repeating move
     Step 2  reduce the working-set count until the session fits
     Step 3  size the cardio work (one long block, secondary blocks or rounds)
     Step 4  drop surplus movements — never fewer than three
     ------------------------------------------------------------------- */
  function buildSession(slotId, template, profile, presc, index) {
    const maxMinutes = Number(profile.sessionMinutes) || 45;
    const budget = maxMinutes * 1.05;
    const mode = template.cardioMode || 'none';
    const drillMin = clamp(Math.round(budget * 0.18), 4, 12);
    const secondaryMin = clamp(Math.round(budget * 0.15), 5, 10);

    /* Step 1 — resolve and de-duplicate */
    const candidates = [];
    const seen = new Set();
    template.picks.forEach(function (pickId) {
      const ex = resolveExercise(pickId, profile.equipment, profile.experience, seen);
      if (seen.has(ex.id)) return;
      seen.add(ex.id);
      candidates.push({ ex: ex, pickId: pickId });
    });

    /* Step 2 — pick a working-set count that fits the budget */
    let sets = presc.sets;
    const timeFor = ex => estimateMinutes(ex, sets);
    let items = candidates.map(c => ({ c: c, sets: sets, minutes: timeFor(c.ex), card: null }));
    let total = items.reduce((s, i) => s + i.minutes, 0);

    while (total > budget && sets > 2) {
      sets--;
      items = items.map(i => ({ c: i.c, sets: sets, minutes: timeFor(i.c.ex), card: i.card }));
      total = items.reduce((s, i) => s + i.minutes, 0);
    }

    /* Step 3 — size the cardio work */
    let blockUsed = false;
    items.forEach(function (item) {
      const ex = item.c.ex;
      if (ex.type !== 'cardio') { item.card = null; return; }
      const isLong = LONG_CARDIO.indexOf(ex.id) !== -1;
      if (mode === 'block' && isLong && !blockUsed) {
        blockUsed = true;
        item.card = { kind: 'block', minutes: 0, rounds: 0 };
      } else if (isLong) {
        item.card = { kind: 'secondary', minutes: secondaryMin, rounds: 0 };
      } else {
        item.card = { kind: 'rounds', minutes: drillMin, rounds: Math.max(4, Math.round(drillMin / 1.5)) };
        item.minutes = drillMin;
      }
    });

    const block = items.find(i => i.card && i.card.kind === 'block');
    if (block) {
      const others = items.filter(i => i !== block).reduce((s, i) => s + i.minutes, 0);
      block.card.minutes = Math.max(8, Math.round(budget - others));
      block.minutes = block.card.minutes;
    }
    total = items.reduce((s, i) => s + i.minutes, 0);

    /* Step 4 — drop surplus movements, keeping at least three */
    while (items.length > 3 && total > budget) {
      const last = items.pop();
      total -= last.minutes;
    }

    /* If the session is still short of the budget, lengthen the cardio work
       rather than padding the session with pointless extra sets. */
    total = items.reduce((s, i) => s + i.minutes, 0);
    const slack = budget - total;
    if (slack > budget * 0.2) {
      const cardioItems = items.filter(i => i.card);
      if (cardioItems.length) {
        const each = Math.round(slack / cardioItems.length);
        cardioItems.forEach(function (i) {
          if (i.card.kind === 'rounds') {
            i.card.rounds += Math.max(1, Math.round(each / 1.5));
            i.card.minutes += each;
            i.minutes += each;
          } else {
            i.card.minutes += each;
            i.minutes += each;
          }
        });
        total = items.reduce((s, i) => s + i.minutes, 0);
      }
    }

    const exs = items.map(function (item) {
      const p = prescribeExercise(item.c.ex, presc, item.sets, item.card || { kind: 'none', minutes: 0, rounds: 0 });
      return {
        id: item.c.ex.id,
        name: item.c.ex.name,
        muscle: item.c.ex.muscle,
        type: item.c.ex.type,
        sets: p.sets,
        reps: p.reps,
        rest: p.rest,
        cues: item.c.ex.cues,
        minutes: Math.round(item.minutes),
        note: item.c.ex.id !== item.c.pickId
          ? 'Swapped for an equipment-appropriate version of ' + EXERCISE_BY_ID[item.c.pickId].name
          : ''
      };
    });

    return {
      id: profile.goal + '-' + slotId + '-' + index,
      slot: slotId,
      title: template.title,
      focus: template.focus,
      exercises: exs,
      minutes: Math.round(total),
      setsUsed: sets,
      prescription: presc
    };
  }

  function buildPlan(profile) {
    if (!profile) return null;
    const goal = profile.goal || 'health';
    const exp = profile.experience || 'beginner';
    const days = Number(profile.daysPerWeek) || 3;
    const presc = PRESCRIPTION[goal][exp];
    const seq = SLOT_SEQUENCES[goal] || SLOT_SEQUENCES.health;
    const templates = SESSION_TEMPLATES[goal] || SESSION_TEMPLATES.health;

    /* Work out which session slot falls on each training day, then build
       one session object per distinct slot so the plan never repeats the
       same session card. */
    const daySlots = seq.slice(0, days);
    const distinctSlots = daySlots.filter(function (slotId, i) {
      return daySlots.indexOf(slotId) === i;
    });

    const bySlot = {};
    const sessionTypes = [];
    distinctSlots.forEach(function (slotId, i) {
      const tpl = templates[slotId];
      if (!tpl) return;
      const session = buildSession(slotId, tpl, profile, presc, i);
      bySlot[slotId] = session;
      sessionTypes.push(session);
    });

    /* Map training days (Mon-based) onto the session sequence. */
    const trainDays = TRAINING_DAY_MAP[days] || TRAINING_DAY_MAP[3];
    const week = [];
    let seqIndex = 0;
    for (let d = 0; d < 7; d++) {
      if (trainDays.indexOf(d) !== -1) {
        const slotId = daySlots[seqIndex];
        const s = bySlot[slotId] || sessionTypes[seqIndex % sessionTypes.length];
        week.push({
          dayIndex: d,
          dayName: DAY_NAMES[d],
          type: 'workout',
          session: s,
          label: s.title
        });
        seqIndex++;
      } else {
        week.push({
          dayIndex: d,
          dayName: DAY_NAMES[d],
          type: 'rest',
          session: null,
          label: 'Rest & Recovery'
        });
      }
    }

    /* Make sure no two identical session types land on consecutive days. */
    for (let i = 1; i < week.length; i++) {
      if (week[i].type === 'workout' && week[i - 1].type === 'workout' &&
          week[i].session.slot === week[i - 1].session.slot) {
        const alt = sessionTypes.find(s => s.slot !== week[i - 1].session.slot);
        if (alt) week[i].session = alt;
      }
    }

    const splitNames = {
      loss: days >= 5 ? 'Full Body + Conditioning (5–6 day)' : days === 4 ? 'Full Body + Conditioning (4 day)' : 'Full Body + Conditioning',
      muscle: days === 2 ? 'Upper / Lower (2 day)' : days === 3 ? 'Push / Pull / Legs' : days === 4 ? 'Upper / Lower (4 day)' : days === 5 ? 'Push / Pull / Legs (5 day)' : 'Push / Pull / Legs (6 day)',
      endurance: days === 2 ? 'Interval + Long Easy' : days === 3 ? 'Intervals, Long + Strength' : 'Intervals + Base Building',
      health: days === 2 ? 'Full Body A / B' : days === 3 ? 'Full Body + Cardio' : 'Full Body + Conditioning'
    };

    const setsUsed = sessionTypes.length
      ? Math.min.apply(null, sessionTypes.map(function (s) { return s.setsUsed; }))
      : presc.sets;
    const rules = buildPlanRules(profile, presc, goal, exp, setsUsed);

    return {
      goal: goal,
      goalLabel: LABELS.goal[goal],
      experience: exp,
      experienceLabel: LABELS.experience[exp],
      equipment: profile.equipment,
      equipmentLabel: LABELS.equipment[profile.equipment],
      splitName: splitNames[goal] || splitNames.health,
      daysPerWeek: days,
      sessionMinutes: Number(profile.sessionMinutes) || 45,
      weeklyMinutes: days * (Number(profile.sessionMinutes) || 45),
      prescription: presc,
      sessionTypes: sessionTypes,
      week: week,
      rules: rules,
      progression: progressionBlock(goal, exp),
      createdFor: profile.name || 'you'
    };
  }

  function progressionBlock(goal, exp) {
    const weeks = [
      { w: 'Weeks 1–2', t: 'Learn the movements', d: 'Use a light-to-moderate load. Stop each set with 2–3 good repetitions in reserve. Record every set.' },
      { w: 'Weeks 3–4', t: 'Build the base', d: 'Add 1 repetition per set, or 2–5% more load, once you complete every set at the top of the range. Add one accessory exercise.' },
      { w: 'Weeks 5–6', t: 'Progressive overload', d: 'Keep the same exercise selection and increase load again. If a lift stalls twice, reduce it by 10% and rebuild.' },
      { w: 'Week 7', t: 'Deload', d: 'Reduce load or sets by about 40%. Keep the movement pattern and the frequency — this is what allows the next block to progress.' }
    ];
    if (exp === 'advanced') {
      weeks[1].d = 'Add load on the main lifts (2–5%) and introduce one intensity technique such as a drop set or rest-pause on the last exercise.';
      weeks[3].d = 'Deload by 30–40%. Use the extra recovery to fix technique issues you noticed during the block.';
    }
    if (goal === 'loss') {
      weeks[1].d = 'Add 1 repetition per set or 2–5% more load. Keep the cardio block at the planned duration and do not extend it — the calorie target comes from diet.';
    }
    if (goal === 'endurance') {
      weeks[1].d = 'Increase the long easy session by 5–10 minutes. Add one extra interval round only if recovery has been good.';
    }
    return weeks;
  }

  function buildPlanRules(profile, presc, goal, exp, setsUsed) {
    const sets = setsUsed || presc.sets;
    const setsNote = sets < presc.sets
      ? 'Your session length allows ' + sets + ' working sets rather than ' + presc.sets + ' — add the extra set back once the session fits comfortably. ' + presc.note
      : presc.note;

    const rules = [
      { t: 'Sets, reps & rest', d: sets + ' working sets of ' + presc.reps + ' reps with ' + presc.rest + ' seconds rest between sets. ' + setsNote },
      { t: 'Warm-up', d: '5–10 minutes of easy cardio plus dynamic mobility (arm circles, hip circles, leg swings, bodyweight squats) before the first working set.' },
      { t: 'Progression', d: 'Increase repetitions first, then load, then the number of sets — never all three at once.' },
      { t: 'Rest days', d: 'Training days are fixed. Rest days are for walking, mobility and sleep, not for "catching up".' },
      { t: 'Session length', d: 'Sessions are built to fit about ' + (Number(profile.sessionMinutes) || 45) + ' minutes. If you finish early, add reps rather than new exercises.' },
      { t: 'Intensity ceiling', d: exp === 'beginner' ? 'Keep 2–3 repetitions in reserve until technique is solid for 4 weeks.' : exp === 'intermediate' ? 'Occasional sets can go to 1 rep in reserve; most sets should keep 1–2 in reserve.' : 'Advanced: train to failure only on the last set of the main lifts.' },
      { t: 'Deload', d: 'Every 4–6 weeks, reduce load or volume by about 40% for one week.' }
    ];

    if (goal === 'loss') {
      rules.push({ t: 'Conditioning', d: 'Cardio blocks are timed (' + presc.cardio + ' min). Keep them at a hard-but-controllable pace and use the time to make technique better, not to create more fatigue.' });
    }
    if (goal === 'muscle') {
      rules.push({ t: 'Volume per muscle', d: 'Aim for 10–20 hard sets per muscle group per week once you are past the first month.' });
      rules.push({ t: 'Record the load', d: 'Write down the weight used for every set. Without a record you cannot beat last week, and you cannot progress.' });
    }
    if (goal === 'endurance') {
      rules.push({ t: 'Intensity distribution', d: 'Roughly 80% of your weekly cardio should feel easy and only 20% should feel hard. That ratio prevents early burnout.' });
    }
    if (goal === 'health') {
      rules.push({ t: 'Simple is sustainable', d: 'The plan is deliberately moderate. If you can do all sessions comfortably for 4 weeks, add one set to the first two exercises.' });
    }
    rules.push({ t: 'When to deload', d: 'Also deload if you feel unusually tired, your resting heart rate rises, or performance drops for two sessions in a row.' });
    return rules;
  }

  /* -------------------------------------------------------------------
     7. SCHEDULE DETAIL
     ------------------------------------------------------------------- */
  function buildSchedule(profile, plan) {
    if (!profile || !plan) return null;
    const t = targets(profile);
    const restIdeas = REST_DAY_IDEAS.slice();
    const days = [];
    let restCounter = 0;

    plan.week.forEach(function (d, i) {
      if (d.type === 'workout') {
        days.push({
          dayIndex: d.dayIndex,
          dayName: d.dayName,
          type: 'workout',
          title: d.session.title,
          focus: d.session.focus,
          minutes: d.session.minutes,
          exercises: d.session.exercises,
          rest: null
        });
      } else {
        /* Each rest day gets a different recovery activity */
        const idea = restIdeas[restCounter % restIdeas.length];
        restCounter++;
        days.push({
          dayIndex: d.dayIndex,
          dayName: d.dayName,
          type: 'rest',
          title: 'Rest & Recovery',
          focus: 'Active recovery, mobility and sleep',
          minutes: 0,
          exercises: [],
          rest: idea
        });
      }
    });

    return {
      days: days,
      targets: t,
      checklist: CHECKLIST_ITEMS.map(function (item) {
        const detail = {
          workout: 'Planned sessions this week: ' + plan.daysPerWeek + '.',
          protein: 'Target ≈ ' + t.protein + ' g per day (' + t.proteinPerKg + ' g/kg).',
          water: 'Target ≈ ' + t.waterGlasses + ' glasses (' + t.waterMl + ' ml) per day.',
          sleep: 'Target ≈ ' + t.sleep + ' hours per night.',
          steps: 'Target ≈ ' + t.steps + ' steps per day.',
          log: 'One entry a day in the Progress tab.'
        };
        return Object.assign({}, item, { detail: detail[item.key] });
      })
    };
  }

  /* -------------------------------------------------------------------
     8. PERSONALISED TIPS
     ------------------------------------------------------------------- */
  function personalTips(profile, analysis) {
    const tips = [];
    if (!profile) return tips;
    const t = analysis ? analysis.targets : targets(profile);

    tips.push({
      cat: 'Diet',
      title: 'Your protein target',
      text: 'Aim for about ' + t.protein + ' g of protein per day (' + t.proteinPerKg + ' g/kg of body weight) — roughly ' + Math.max(2, Math.round(t.protein / 30)) + ' palm-sized portions spread across ' + Math.max(3, Math.min(4, Number(profile.proteinMeals) + 1)) + ' meals.'
    });
    tips.push({
      cat: 'Diet',
      title: 'Your estimated energy target',
      text: 'Estimated maintenance ≈ ' + t.tdee + ' kcal/day; your suggested starting intake ≈ ' + t.calories + ' kcal/day. This is a rough rule-based estimate, not a prescription — adjust using your own weight trend over 2–3 weeks.'
    });
    tips.push({
      cat: 'Water',
      title: 'Your hydration target',
      text: 'Target ≈ ' + t.waterMl + ' ml (' + t.waterGlasses + ' glasses of 250 ml) per day, plus about 500 ml on training days.'
    });
    tips.push({
      cat: 'Sleep',
      title: 'Your sleep target',
      text: 'Aim for ' + t.sleep + ' hours. On your ' + planDays(profile) + '-day schedule, keep at least one full rest day so training quality stays high.'
    });
    tips.push({
      cat: 'Fitness',
      title: 'Your weekly training volume',
      text: planDays(profile) + ' sessions × about ' + (Number(profile.sessionMinutes) || 45) + ' minutes ≈ ' + (planDays(profile) * (Number(profile.sessionMinutes) || 45)) + ' minutes per week of structured training.'
    });
    tips.push({
      cat: 'Fitness',
      title: 'Your step target',
      text: 'Aim for about ' + t.steps + ' steps per day. Walking counts as training — it is recovery volume that keeps your metabolism active between sessions.'
    });

    if (analysis) {
      analysis.problems.slice(0, 4).forEach(function (pr) {
        tips.push({
          cat: 'Fix this',
          title: pr.title,
          text: pr.suggestion,
          severity: pr.severity
        });
      });
    }
    return tips;
  }

  function planDays(profile) { return Number(profile.daysPerWeek) || 3; }

  /* -------------------------------------------------------------------
     9. PROGRESS SUMMARIES (used by charts + dashboard)
     ------------------------------------------------------------------- */
  function weekStartISO(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const dow = (d.getDay() + 6) % 7;           // 0 = Monday
    d.setDate(d.getDate() - dow);
    return d.toISOString().slice(0, 10);
  }

  function summariseLogs(logs, profile) {
    const sorted = logs.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const weights = sorted.filter(l => typeof l.weight === 'number' && !isNaN(l.weight));
    const first = weights[0], last = weights[weights.length - 1];
    const totalWorkouts = sorted.reduce((s, l) => s + (Number(l.workouts) || 0), 0);
    const days = sorted.length;

    const avg = key => {
      const vals = sorted.map(l => Number(l[key])).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
      return vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    };

    /* Weekly buckets (last 8 weeks) */
    const buckets = {};
    sorted.forEach(function (l) {
      const key = weekStartISO(l.date);
      if (!key) return;
      if (!buckets[key]) buckets[key] = { week: key, workouts: 0, water: 0, sleep: 0, steps: 0, mood: 0, count: 0, weightSum: 0, weightCount: 0 };
      const b = buckets[key];
      b.workouts += Number(l.workouts) || 0;
      b.water += Number(l.water) || 0;
      b.sleep += Number(l.sleep) || 0;
      b.steps += Number(l.steps) || 0;
      b.mood += Number(l.mood) || 0;
      b.count++;
      if (typeof l.weight === 'number' && !isNaN(l.weight)) { b.weightSum += l.weight; b.weightCount++; }
    });
    const weeks = Object.keys(buckets).sort().slice(-8).map(function (k) {
      const b = buckets[k];
      return {
        week: k,
        label: shortDate(k),
        workouts: b.workouts,
        waterAvg: b.count ? round1(b.water / b.count) : 0,
        sleepAvg: b.count ? round1(b.sleep / b.count) : 0,
        stepsAvg: b.count ? round0(b.steps / b.count) : 0,
        moodAvg: b.count ? round1(b.mood / b.count) : 0,
        weightAvg: b.weightCount ? round1(b.weightSum / b.weightCount) : null,
        days: b.count
      };
    });

    /* Adherence: completed sessions vs the plan */
    const plannedPerWeek = profile ? (Number(profile.daysPerWeek) || 3) : 3;
    const adherence = weeks.map(w => {
      const pct = Math.round(Math.min(1, w.workouts / plannedPerWeek) * 100);
      return { label: w.label, value: pct, planned: plannedPerWeek, done: w.workouts };
    });

    /* Current streak of consecutive logged days */
    let streak = 0;
    if (sorted.length) {
      const set = new Set(sorted.map(l => l.date));
      const cursor = new Date(sorted[sorted.length - 1].date + 'T00:00:00');
      while (set.has(cursor.toISOString().slice(0, 10))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    const bmiNow = profile && last ? bmiInfo(last.weight, profile.height) : null;

    return {
      entries: days,
      weights: weights,
      currentWeight: last ? last.weight : null,
      startWeight: first ? first.weight : null,
      weightChange: (first && last) ? round1(last.weight - first.weight) : null,
      totalWorkouts: totalWorkouts,
      avgWorkoutsPerWeek: weeks.length ? round1(weeks.reduce((s, w) => s + w.workouts, 0) / weeks.length) : 0,
      avgWater: avg('water'),
      avgSleep: avg('sleep'),
      avgSteps: avg('steps'),
      avgMood: avg('mood'),
      adherence: adherence,
      adherenceAvg: adherence.length ? round0(adherence.reduce((s, a) => s + a.value, 0) / adherence.length) : null,
      weeks: weeks,
      streak: streak,
      bmiNow: bmiNow,
      plannedPerWeek: plannedPerWeek
    };
  }

  function shortDate(iso) {
    const parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return parts[2] + ' ' + months[Number(parts[1]) - 1];
  }

  /* -------------------------------------------------------------------
     10. PUBLIC API
     ------------------------------------------------------------------- */
  return {
    targets: targets,
    bmiInfo: bmiInfo,
    statusOf: statusOf,
    analyse: analyse,
    buildPlan: buildPlan,
    buildSchedule: buildSchedule,
    personalTips: personalTips,
    summariseLogs: summariseLogs,
    weekStartISO: weekStartISO,
    shortDate: shortDate,
    round1: round1
  };
})();
