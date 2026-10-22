/* =====================================================================
   data.js  —  Static reference data for the Fitness Habit Analysis app
   ---------------------------------------------------------------------
   Everything in this file is DEMONSTRATION / REFERENCE data for a college
   field project. It is not a real medical or nutritional database.
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. GOAL / EXPERIENCE / EQUIPMENT LABELS
   --------------------------------------------------------------------- */
const LABELS = {
  goal: {
    loss: 'Lose body fat',
    muscle: 'Build muscle',
    endurance: 'Improve endurance & stamina',
    health: 'General fitness & health'
  },
  experience: {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced'
  },
  activityLevel: {
    sedentary: 'Sedentary',
    light: 'Lightly active',
    moderate: 'Moderately active',
    active: 'Very active'
  },
  equipment: {
    full_gym: 'Full gym',
    basic_gym: 'Basic gym',
    home: 'Home equipment',
    outdoor: 'Outdoor / bodyweight'
  },
  dimension: {
    consistency: 'Workout Consistency',
    nutrition: 'Diet & Nutrition',
    hydration: 'Hydration',
    sleep: 'Sleep & Recovery',
    activity: 'Daily Activity',
    motivation: 'Motivation & Tracking'
  }
};

/* ---------------------------------------------------------------------
   2. EXERCISE LIBRARY
   type      : compound | isolation | cardio | core | mobility
   equipment : which equipment options allow this movement
   level     : 1 = beginner friendly, 2 = intermediate, 3 = advanced
   cues      : short coaching tips shown in the plan
   --------------------------------------------------------------------- */
const EXERCISES = [
  // --- Lower body ---
  { id: 'squat_goblet',   name: 'Goblet Squat',              muscle: 'Quads / Glutes', type: 'compound',  equipment: ['full_gym', 'basic_gym', 'home'],      level: 1, cues: 'Sit hips back, knees track over toes, chest tall.' },
  { id: 'back_squat',     name: 'Barbell Back Squat',       muscle: 'Quads / Glutes', type: 'compound',  equipment: ['full_gym'],                          level: 3, cues: 'Brace hard, sit between the hips, drive the floor away.' },
  { id: 'leg_press',      name: 'Leg Press',                 muscle: 'Quads / Glutes', type: 'compound',  equipment: ['full_gym', 'basic_gym'],              level: 1, cues: 'Do not lock the knees at the bottom; control the weight.' },
  { id: 'rdl_db',         name: 'Dumbbell Romanian Deadlift', muscle: 'Hamstrings',   type: 'compound',  equipment: ['full_gym', 'basic_gym', 'home'],      level: 2, cues: 'Push hips back, keep back flat, feel the hamstrings stretch.' },
  { id: 'deadlift',       name: 'Conventional Deadlift',     muscle: 'Back / Legs',   type: 'compound',  equipment: ['full_gym'],                          level: 3, cues: 'Neutral spine, bar close to the legs, push the floor away.' },
  { id: 'walking_lunge',  name: 'Walking Lunge',             muscle: 'Quads / Glutes', type: 'compound',  equipment: ['full_gym', 'basic_gym', 'home', 'outdoor'], level: 1, cues: 'Long stride, upright torso, mild knee bend on the front leg.' },
  { id: 'hip_thrust',     name: 'Barbell Hip Thrust',        muscle: 'Glutes',        type: 'isolation', equipment: ['full_gym', 'basic_gym'],              level: 2, cues: 'Tuck the chin, squeeze the glutes at the top for 1 second.' },
  { id: 'leg_curl',       name: 'Lying Leg Curl',            muscle: 'Hamstrings',    type: 'isolation', equipment: ['full_gym', 'basic_gym'],              level: 1, cues: 'Keep the hips pinned down, curl through the range.' },
  { id: 'step_up',        name: 'Bench Step-Up',             muscle: 'Quads / Glutes', type: 'compound',  equipment: ['full_gym', 'basic_gym', 'home'],      level: 1, cues: 'Stand tall at the top, drive through the working heel.' },
  { id: 'calf_raise',     name: 'Standing Calf Raise',       muscle: 'Calves',        type: 'isolation', equipment: ['full_gym', 'basic_gym', 'home'],      level: 1, cues: 'Slow 2-second lowering, pause at the top.' },

  // --- Push ---
  { id: 'bench_barbell',  name: 'Barbell Bench Press',      muscle: 'Chest',         type: 'compound',  equipment: ['full_gym'],                          level: 2, cues: 'Shoulder blades pinned, feet planted, press up and slightly in.' },
  { id: 'db_bench',       name: 'Dumbbell Bench Press',     muscle: 'Chest',         type: 'compound',  equipment: ['full_gym', 'basic_gym', 'home'],      level: 1, cues: 'Lower dumbbells to the chest with control.' },
  { id: 'incline_db',     name: 'Incline Dumbbell Press',    muscle: 'Upper Chest',   type: 'compound',  equipment: ['full_gym', 'basic_gym', 'home'],      level: 2, cues: 'Set the bench at ~30°, press evenly.' },
  { id: 'push_up',        name: 'Push-Up',                   muscle: 'Chest',         type: 'compound',  equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 1, cues: 'One straight line from head to heel, lower the chest.' },
  { id: 'ohp_db',         name: 'Dumbbell Shoulder Press',  muscle: 'Shoulders',     type: 'compound',  equipment: ['full_gym', 'basic_gym', 'home'],      level: 1, cues: 'Ribs down, press up and slightly back.' },
  { id: 'lateral_raise',  name: 'Cable Lateral Raise',      muscle: 'Shoulders',     type: 'isolation', equipment: ['full_gym', 'basic_gym'],              level: 2, cues: 'Raise to shoulder height with soft elbows.' },
  { id: 'triceps_push',   name: 'Triceps Rope Pushdown',    muscle: 'Triceps',       type: 'isolation', equipment: ['full_gym', 'basic_gym'],              level: 1, cues: 'Elbows pinned to the sides, extend fully.' },

  // --- Pull ---
  { id: 'pull_up',        name: 'Pull-Up',                   muscle: 'Back',          type: 'compound',  equipment: ['full_gym', 'outdoor'],               level: 3, cues: 'Pull the elbows down to the ribs, chest up.' },
  { id: 'lat_pulldown',   name: 'Lat Pulldown',              muscle: 'Back',          type: 'compound',  equipment: ['full_gym', 'basic_gym'],              level: 1, cues: 'Pull to the upper chest, lean back slightly.' },
  { id: 'barbell_row',    name: 'Barbell Row',              muscle: 'Back',          type: 'compound',  equipment: ['full_gym'],                          level: 3, cues: 'Flat back, pull toward the lower ribs.' },
  { id: 'db_row',         name: 'One-Arm Dumbbell Row',     muscle: 'Back',          type: 'compound',  equipment: ['full_gym', 'basic_gym', 'home'],      level: 1, cues: 'Row with the elbow, no body swing.' },
  { id: 'cable_row',      name: 'Seated Cable Row',         muscle: 'Back',          type: 'compound',  equipment: ['full_gym', 'basic_gym'],              level: 1, cues: 'Pause and squeeze the shoulder blades.' },
  { id: 'face_pull',      name: 'Face Pull',                 muscle: 'Rear Shoulders',type: 'isolation', equipment: ['full_gym', 'basic_gym'],              level: 1, cues: 'Pull toward the eyebrows, rotate hands apart.' },
  { id: 'biceps_curl',    name: 'Dumbbell Biceps Curl',     muscle: 'Biceps',        type: 'isolation', equipment: ['full_gym', 'basic_gym', 'home'],      level: 1, cues: 'Elbows fixed, no swinging of the torso.' },
  { id: 'farmer_walk',    name: 'Farmer Carry Walk',        muscle: 'Grip / Core',   type: 'compound',  equipment: ['full_gym', 'basic_gym', 'home'],      level: 1, cues: 'Stand tall, walk slowly, do not shrug.', presc: '3 × 30 m carry' },
  { id: 'db_lateral_raise', name: 'Dumbbell Lateral Raise',  muscle: 'Shoulders',     type: 'isolation', equipment: ['full_gym', 'basic_gym', 'home'],      level: 1, cues: 'Raise to shoulder height with a soft elbow.' },
  { id: 'rear_delt_db',   name: 'Dumbbell Bent-Over Reverse Fly', muscle: 'Rear Shoulders', type: 'isolation', equipment: ['full_gym', 'basic_gym', 'home'],  level: 1, cues: 'Slight hinge, arms out, feel the upper back.' },
  { id: 'close_grip_pushup', name: 'Close-Grip Push-Up',    muscle: 'Triceps / Chest', type: 'compound', equipment: ['full_gym', 'basic_gym', 'home', 'outdoor'], level: 2, cues: 'Hands closer together, elbows tucked, chest to floor.' },
  { id: 'glute_bridge',   name: 'Glute Bridge',             muscle: 'Glutes',        type: 'compound',  equipment: ['full_gym', 'basic_gym', 'home', 'outdoor'], level: 1, cues: 'Press the hips up, squeeze at the top, do not arch the back.' },
  { id: 'band_row',       name: 'Resistance Band Row',      muscle: 'Back',          type: 'compound',  equipment: ['home', 'outdoor', 'full_gym', 'basic_gym'],               level: 1, cues: 'Band around a fixed point, pull elbows to the ribs.' },
  { id: 'band_pullapart', name: 'Band Pull-Apart',          muscle: 'Rear Shoulders',type: 'isolation', equipment: ['home', 'outdoor', 'full_gym', 'basic_gym'],               level: 1, cues: 'Arms straight, pull the band apart, control the return.' },

  // --- Core ---
  { id: 'plank',          name: 'Plank',                    muscle: 'Core',          type: 'core',      equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 1, cues: 'Squeeze the glutes, ribs down, breathe steadily.' },
  { id: 'side_plank',     name: 'Side Plank',               muscle: 'Obliques',      type: 'core',      equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 1, cues: 'Stack the hips forward, lift the top arm.' },
  { id: 'russian_twist',  name: 'Russian Twist',            muscle: 'Obliques',      type: 'core',      equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 1, cues: 'Rotate from the ribs, keep the chest lifted.' },
  { id: 'dead_bug',       name: 'Dead Bug',                 muscle: 'Deep Core',     type: 'core',      equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 1, cues: 'Lower back stays flat on the floor the whole time.' },
  { id: 'bird_dog',       name: 'Bird Dog',                 muscle: 'Core / Back',   type: 'core',      equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 1, cues: 'Reach long, hold 3 seconds, no arching.' },
  { id: 'hanging_leg_raise', name: 'Hanging Leg Raise',      muscle: 'Lower Abs',     type: 'core',      equipment: ['full_gym', 'outdoor', 'basic_gym'],               level: 3, cues: 'Control the swing, lift from the hips.' },
  { id: 'leg_raise',      name: 'Lying Leg Raise',          muscle: 'Lower Abs',     type: 'core',      equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 1, cues: 'Press the lower back gently into the floor.' },

  // --- Cardio / conditioning ---
  { id: 'treadmill',      name: 'Treadmill Run / Intervals', muscle: 'Full Body',    type: 'cardio',    equipment: ['full_gym', 'basic_gym'],                          level: 1, cues: 'Short 30–60s hard efforts with 90s easy recovery.' },
  { id: 'bike',           name: 'Stationary Bike',          muscle: 'Legs',          type: 'cardio',    equipment: ['full_gym', 'basic_gym'],              level: 1, cues: 'Set a resistance you could hold for 10 minutes.' },
  { id: 'row_erg',        name: 'Rowing Ergometer',         muscle: 'Full Body',    type: 'cardio',    equipment: ['full_gym'],                          level: 2, cues: 'Legs, then back, then arms — reverse on the return.' },
  { id: 'stair_climber',  name: 'Stair Climber',            muscle: 'Legs',          type: 'cardio',    equipment: ['full_gym', 'basic_gym'],              level: 1, cues: 'Drive through the whole foot, steady tempo.' },
  { id: 'jump_rope',      name: 'Jump Rope',                muscle: 'Full Body',    type: 'cardio',    equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 1, cues: 'Small jumps, wrists turning, stay tall.' },
  { id: 'brisk_walk',     name: 'Brisk Walk / Easy Jog',    muscle: 'Full Body',    type: 'cardio',    equipment: ['outdoor'],                           level: 1, cues: 'Conversational pace, aim for 30–45 minutes.' },
  { id: 'burpee',         name: 'Burpee',                   muscle: 'Full Body',    type: 'cardio',    equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 2, cues: 'Chest to floor, land soft, keep the core tight.' },
  { id: 'mountain_climber', name: 'Mountain Climber',       muscle: 'Core / Cardio', type: 'cardio',    equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 1, cues: 'Hips level, switch the feet quickly.' },
  { id: 'kettlebell_swing', name: 'Kettlebell Swing',       muscle: 'Posterior Chain', type: 'cardio',  equipment: ['full_gym', 'basic_gym', 'home'],      level: 2, cues: 'Hinge the hips and snap them — arms stay relaxed.' },
  { id: 'battle_rope',    name: 'Battle Rope Waves',        muscle: 'Full Body',    type: 'cardio',    equipment: ['full_gym', 'basic_gym'],                          level: 1, cues: 'Stance wide, wave from the shoulders.' },
  { id: 'sled_push',      name: 'Sled Push',                muscle: 'Full Body',    type: 'cardio',    equipment: ['full_gym', 'basic_gym'],                          level: 2, cues: 'Constant low lean, short powerful steps.' },
  { id: 'jumping_jack',   name: 'Jumping Jack',             muscle: 'Full Body',    type: 'cardio',    equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 1, cues: 'Light on the feet, full arm overhead reach.' },
  { id: 'squat_jump',     name: 'Squat Jump',               muscle: 'Legs',          type: 'cardio',    equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 2, cues: 'Land softly and quietly to absorb the impact.' },
  { id: 'high_knees',     name: 'High Knees',               muscle: 'Full Body',    type: 'cardio',    equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 1, cues: 'Tall posture, quick ground contact.' },
  { id: 'box_jump',       name: 'Box Jump',                 muscle: 'Legs',          type: 'cardio',    equipment: ['full_gym', 'basic_gym'],              level: 3, cues: 'Step up if needed — quality over height.' },

  // --- Mobility / warm-up ---
  { id: 'cat_cow',        name: 'Cat–Cow',                  muscle: 'Spine',         type: 'mobility',  equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 1, cues: 'Move slowly with the breath.' },
  { id: 'thoracic_rot',   name: 'Thoracic Rotation',        muscle: 'Upper Back',    type: 'mobility',  equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 1, cues: 'Rotate from the mid-back, keep hips square.' },
  { id: 'hamstring_stretch', name: 'Standing Hamstring Stretch', muscle: 'Hamstrings', type: 'mobility', equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'],                  level: 1, cues: 'Hinge softly, do not bounce.' },
  { id: 'hip_flexor_stretch', name: 'Kneeling Hip Flexor Stretch', muscle: 'Hip Flexors', type: 'mobility', equipment: ['outdoor', 'home', 'full_gym', 'basic_gym'], level: 1, cues: 'Tuck the pelvis before leaning forward.' },
  { id: 'foam_roll',      name: 'Foam Rolling / Self Myofascial', muscle: 'Muscles', type: 'mobility', equipment: ['full_gym', 'basic_gym', 'home'],      level: 1, cues: 'Roll slowly over tender areas, 30–60 seconds.' }
];

/* ---------------------------------------------------------------------
   3. SESSION TEMPLATES
   Each template = one training slot. "picks" lists exercise ids in order.
   "equip" restricts a slot to equipment that supports the whole slot
   (used to pick a fallback slot when the user has no gym equipment).
   --------------------------------------------------------------------- */
const SESSION_TEMPLATES = {
  loss: {
    A: { title: 'Full Body + Metabolic', focus: 'Whole body', cardioMode: 'interval', picks: ['squat_goblet', 'db_bench', 'rdl_db', 'db_row', 'mountain_climber', 'plank'] },
    B: { title: 'Full Body + Cardio Finish', focus: 'Whole body', cardioMode: 'interval', picks: ['db_bench', 'walking_lunge', 'leg_press', 'cable_row', 'burpee', 'dead_bug'] },
    C: { title: 'Conditioning Circuit', focus: 'Cardio + core', cardioMode: 'interval', picks: ['kettlebell_swing', 'push_up', 'squat_jump', 'battle_rope', 'high_knees'] },
    D: { title: 'Upper Body + Zone 2 Cardio', focus: 'Upper body', cardioMode: 'block', picks: ['lat_pulldown', 'incline_db', 'ohp_db', 'biceps_curl', 'triceps_push', 'row_erg'] },
    E: { title: 'Lower Body + Intervals', focus: 'Lower body', cardioMode: 'interval', picks: ['leg_press', 'rdl_db', 'step_up', 'hip_thrust', 'jump_rope'] },
    F: { title: 'Full Body Power', focus: 'Whole body', cardioMode: 'interval', picks: ['squat_goblet', 'push_up', 'db_row', 'walking_lunge', 'battle_rope', 'side_plank'] }
  },
  muscle: {
    A: { title: 'Push Day', focus: 'Chest · Shoulders · Triceps', cardioMode: 'none', picks: ['bench_barbell', 'ohp_db', 'incline_db', 'lateral_raise', 'triceps_push', 'farmer_walk'] },
    B: { title: 'Pull Day', focus: 'Back · Biceps · Rear Delts', cardioMode: 'none', picks: ['pull_up', 'barbell_row', 'cable_row', 'face_pull', 'biceps_curl', 'farmer_walk'] },
    C: { title: 'Legs Day', focus: 'Quads · Hamstrings · Glutes', cardioMode: 'none', picks: ['back_squat', 'rdl_db', 'leg_press', 'leg_curl', 'hip_thrust', 'calf_raise'] },
    D: { title: 'Upper Body', focus: 'Upper body push + pull', cardioMode: 'none', picks: ['bench_barbell', 'pull_up', 'ohp_db', 'cable_row', 'lateral_raise', 'biceps_curl'] },
    E: { title: 'Lower Body', focus: 'Lower body strength', cardioMode: 'none', picks: ['back_squat', 'hip_thrust', 'leg_press', 'rdl_db', 'leg_curl', 'calf_raise'] },
    F: { title: 'Arms & Conditioning', focus: 'Arms · core · cardio', cardioMode: 'interval', picks: ['biceps_curl', 'triceps_push', 'incline_db', 'plank', 'jump_rope'] }
  },
  endurance: {
    A: { title: 'Interval Session', focus: 'High-intensity intervals', cardioMode: 'interval', picks: ['treadmill', 'squat_jump', 'mountain_climber', 'row_erg', 'plank'] },
    B: { title: 'Long Endurance Session', focus: 'Steady-state cardio', cardioMode: 'block', picks: ['treadmill', 'bike', 'brisk_walk', 'leg_raise'] },
    C: { title: 'Strength Support', focus: 'Full body strength', cardioMode: 'none', picks: ['squat_goblet', 'db_row', 'hip_thrust', 'leg_press', 'side_plank'] },
    D: { title: 'Core & Stability', focus: 'Core · mobility', cardioMode: 'none', picks: ['plank', 'side_plank', 'russian_twist', 'dead_bug', 'bird_dog', 'cat_cow'] },
    E: { title: 'Mixed Cardio Circuit', focus: 'Cardio variety', cardioMode: 'interval', picks: ['row_erg', 'bike', 'battle_rope', 'burpee', 'stair_climber'] },
    F: { title: 'Recovery & Mobility', focus: 'Mobility · blood flow', cardioMode: 'interval', picks: ['cat_cow', 'thoracic_rot', 'hip_flexor_stretch', 'hamstring_stretch', 'foam_roll', 'brisk_walk'] }
  },
  health: {
    A: { title: 'Full Body A', focus: 'Whole body', cardioMode: 'none', picks: ['squat_goblet', 'db_bench', 'lat_pulldown', 'rdl_db', 'plank'] },
    B: { title: 'Full Body B', focus: 'Whole body', cardioMode: 'none', picks: ['db_row', 'ohp_db', 'leg_press', 'hip_thrust', 'side_plank'] },
    C: { title: 'Cardio & Mobility', focus: 'Cardio + mobility', cardioMode: 'block', picks: ['brisk_walk', 'jump_rope', 'cat_cow', 'thoracic_rot', 'hip_flexor_stretch'] },
    D: { title: 'Core & Stability', focus: 'Core · stability', cardioMode: 'interval', picks: ['plank', 'dead_bug', 'bird_dog', 'russian_twist', 'mountain_climber'] },
    E: { title: 'Full Body Conditioning', focus: 'Conditioning', cardioMode: 'interval', picks: ['squat_jump', 'push_up', 'walking_lunge', 'jump_rope'] },
    F: { title: 'Recovery Flow', focus: 'Mobility · recovery', cardioMode: 'block', picks: ['foam_roll', 'cat_cow', 'hamstring_stretch', 'hip_flexor_stretch', 'brisk_walk'] }
  }
};


/* ---------------------------------------------------------------------
   4. WEEKLY SLOT SEQUENCES
   Which training slots are used, in which order, for each goal.
   The engine rotates these to match the user's available training days.
   --------------------------------------------------------------------- */
const SLOT_SEQUENCES = {
  loss: ['A', 'B', 'A', 'C', 'B', 'F'],
  muscle: ['A', 'B', 'C', 'A', 'B', 'C'],
  endurance: ['A', 'B', 'C', 'D', 'A', 'E'],
  health: ['A', 'B', 'C', 'D', 'A', 'F']
};

/* Day indexes used for training, for each number of training days.
   0 = Monday ... 6 = Sunday                                              */
const TRAINING_DAY_MAP = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5]
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/* ---------------------------------------------------------------------
   5. SETS / REPS / REST PRESCRIPTION (rule based)
   --------------------------------------------------------------------- */
const PRESCRIPTION = {
  loss: {
    beginner: { sets: 3, reps: '12–15', rest: 45, cardio: 12, note: 'Moderate weight, short rest, finish each set with 2 good reps in reserve.' },
    intermediate: { sets: 4, reps: '10–14', rest: 60, cardio: 16, note: 'Add a fourth set on the first two exercises and keep rest tight to raise heart rate.' },
    advanced: { sets: 4, reps: '8–12', rest: 60, cardio: 20, note: 'Use drop sets or supersets on the last two exercises to keep the session short.' }
  },
  muscle: {
    beginner: { sets: 3, reps: '10–12', rest: 75, cardio: 8, note: 'Learn the lift first — stop 2 reps before failure for the first 4 weeks.' },
    intermediate: { sets: 4, reps: '8–12', rest: 90, cardio: 10, note: 'Add weight whenever you hit the top of the rep range on every set.' },
    advanced: { sets: 5, reps: '6–10', rest: 120, cardio: 12, note: 'Use double progressive overload: add reps first, then load.' }
  },
  endurance: {
    beginner: { sets: 3, reps: '20–30', rest: 45, cardio: 20, note: 'Work at a comfortable pace, talk in short sentences during the main sets.' },
    intermediate: { sets: 4, reps: '15–25', rest: 45, cardio: 28, note: 'Use intervals: 1 min hard / 2 min easy, repeated for the whole cardio block.' },
    advanced: { sets: 4, reps: '12–20', rest: 40, cardio: 35, note: 'Add a second interval block and track pace or heart rate each session.' }
  },
  health: {
    beginner: { sets: 2, reps: '12–15', rest: 60, cardio: 12, note: 'Focus on technique and showing up consistently rather than load.' },
    intermediate: { sets: 3, reps: '10–14', rest: 60, cardio: 16, note: 'Keep the movement smooth and controlled through the full range.' },
    advanced: { sets: 3, reps: '10–15', rest: 60, cardio: 20, note: 'You can add a second round of the circuit if recovery is good.' }
  }
};

/* ---------------------------------------------------------------------
   6. LIFESTYLE TIPS (general, non-medical)
   --------------------------------------------------------------------- */
const TIPS = {
  diet: [
    { title: 'Build meals around protein', text: 'Include a clear protein source (eggs, dal, curd, chicken, fish, paneer, tofu, beans) in every main meal. Spreading protein across the day supports muscle repair and reduces mid-day snacking.' },
    { title: 'Fill half the plate with vegetables', text: 'Vegetables add fibre and volume, which makes you feel full for fewer calories. Practical rule: half the plate vegetables, one quarter protein, one quarter carbohydrate.' },
    { title: 'Don\'t skip breakfast — but keep it simple', text: 'A protein-and-fibre breakfast (eggs + fruit, or curd + oats + banana) reduces mid-morning crash snacking and protects training quality.' },
    { title: 'Use the "eat the food you like, not the food you like to eat" idea', text: 'Restaurants and packaged food are fine occasionally. Keep them to a planned part of the week instead of daily background noise.' },
    { title: 'Sugar drinks are the easiest win', text: 'One sugary drink can carry 150–250 kcal. Replacing it with water or unsweetened tea is usually the first visible change for a calorie deficit.' },
    { title: 'Carbs are fuel, not the enemy', text: 'Keep carbohydrates around training days, especially before longer sessions. Cutting them completely usually hurts session quality and adherence.' },
    { title: 'Cook in bulk', text: 'Preparing two or three meals on a free day reduces takeaway ordering on busy days — one of the strongest predictors of long-term body-composition change.' },
    { title: 'Watch the liquid calories', text: 'Soups, juices, milkshakes and curd-based drinks add up even when they feel healthy. Note them for a few days to see the real number.' },
    { title: 'Aim for a moderate deficit, not a crash', text: 'A slow, sustainable deficit (roughly 300–500 kcal per day) protects training performance, muscle mass and your mental energy. Fast loss usually means fast regain.' },
    { title: 'Track protein, not every calorie', text: 'Protein, three meals a day and water are four numbers you can actually hold on to. Count only what you can measure consistently.' },
    { title: 'Learn one or two "emergency" meals', text: 'A ready meal you genuinely like is better than a "good" meal you skip. Consistency beats perfection.' },
    { title: 'Eat slowly', text: 'Taking 15–20 minutes per meal lets fullness signals reach the brain and usually reduces the amount eaten at the next meal.' }
  ],
  water: [
    { title: 'A simple daily target', text: 'A practical baseline is 30–35 ml per kg of body weight, spread across the day — for a 70 kg person that is roughly 8–9 glasses of 250 ml.' },
    { title: 'Front-load the day', text: 'Drinking 500–700 ml within an hour of waking makes it far easier to hit the rest of the day\'s target.' },
    { title: 'Add an extra glass for every workout', text: 'Training adds fluid loss. Around 500 ml extra on training days covers most sessions, and more in hot weather.' },
    { title: 'Urine colour is a free test', text: 'Pale straw-yellow means well hydrated; dark amber means you are behind. It is the simplest self-check available.' },
    { title: 'Set reminders', text: 'Schedule water breaks at fixed points — on arriving at work, after every meeting, before lunch. Habit triggers beat willpower.' },
    { title: 'Don\'t wait for thirst', text: 'Thirst is a late signal. By the time you feel thirsty you are usually already mildly dehydrated.' },
    { title: 'Flavour it if you must', text: 'Lemon, cucumber, mint or a splash of juice make plain water easier to drink consistently.' },
    { title: 'Reduce the hidden sources', text: 'Soup, porridge, fruit and yoghurt all contain water — count them towards your total.' }
  ],
  sleep: [
    { title: '7–9 hours is the working target', text: 'Most adults need 7–9 hours. Under 6 hours repeatedly reduces training quality, appetite control and mood.' },
    { title: 'Keep a fixed wake time', text: 'A consistent wake time — including on rest days — regulates your body clock more effectively than a fixed bedtime.' },
    { title: 'Cut screens in the last hour', text: 'Bright light delays the sleep signal. Put the phone away and read, stretch or breathe instead.' },
    { title: 'Morning daylight', text: '10–20 minutes of outdoor light soon after waking anchors your circadian rhythm and makes falling asleep easier at night.' },
    { title: 'No heavy food right before bed', text: 'Large meals close to sleep can disturb comfort and digestion. A small protein snack is fine if you are genuinely hungry.' },
    { name: 'Caffeine has a long tail', text: 'Caffeine stays in the body for many hours. If you are sensitive, keep the last one at least 8 hours before bed.' },
    { title: 'Cool, dark, quiet', text: 'A slightly cool room and blocked light help most people fall asleep faster and stay asleep longer.' },
    { title: 'Train earlier if you can', text: 'Hard training in the last 2 hours of the day can raise alertness and delay sleep onset for some people.' },
    { title: 'Recovery is part of training', text: 'Muscle is rebuilt during rest, not during the session. Skip a workout rather than train when you are exhausted and sick.' }
  ],
  training: [
    { title: 'Warm up, do not skip', text: '5–10 minutes of easy cardio plus dynamic mobility prepares the joints and reduces injury risk on working sets.' },
    { title: 'Master the first two exercises', text: 'The best exercises are the ones you can perform well. Spend your effort on technique before adding new movements.' },
    { title: 'Progressive overload', text: 'Add a small amount of load, one extra rep, or one extra set every 1–2 weeks. Without gradual progress, the body has no reason to adapt.' },
    { title: 'Leave 1–2 reps in reserve', text: 'Training to absolute failure is not needed and raises technique and injury risk. Stopping with 1–2 good reps left is more productive.' },
    { title: 'Rest days are training days', text: 'Growth happens during recovery. On rest days, keep moving gently — a walk and mobility work are ideal.' },
    { title: 'Full range of motion', text: 'Use a comfortable, complete range on every rep. Partial reps reduce the muscle stimulus and hide imbalances.' },
    { title: 'Breathe through the effort', text: 'Exhale on the hardest part of the lift. Holding your breath for long raises blood pressure unnecessarily.' },
    { title: 'Log the session', text: 'Even a note of "squat 40 kg x 8" tells you far more than memory does — and it makes the next session better.' },
    { title: 'Sleep and food are training', text: 'A session is only one part of the stimulus. Without enough protein, sleep and calories, the training does not convert into progress.' },
    { title: 'Consistency beats intensity', text: 'Three moderate sessions a week for a year beats three brutal sessions a month. Choose the version you will still be doing next month.' },
    { title: 'Deload every 4–6 weeks', text: 'Reduce load or volume for a week. You will come back stronger and avoid the plateaus that come from grinding.' },
    { title: 'Increase time before intensity', text: 'If you cannot finish a session, the session is too long. Trim the volume rather than rushing the sets.' }
  ]
};

/* ---------------------------------------------------------------------
   7. REST DAY ACTIVITY SUGGESTIONS
   --------------------------------------------------------------------- */
const REST_DAY_IDEAS = [
  { title: 'Easy walk', text: '20–30 minutes at a comfortable pace. Keeps circulation moving without adding fatigue.' },
  { title: 'Mobility flow', text: '10 minutes of cat–cow, thoracic rotations, hip flexor and hamstring stretches.' },
  { title: 'Foam rolling', text: 'Roll quads, hamstrings, calves and upper back for 30–60 seconds per area.' },
  { title: 'Light active recovery', text: 'An easy cycle or swim at conversational pace — blood flow without strain.' },
  { title: 'Meal prep', text: 'Use the free time to prepare food for the week. Adherence is mostly a planning problem.' },
  { title: 'Sleep bank', text: 'Aim for an extra 30–45 minutes of sleep. Recovery is where adaptation happens.' }
];

/* ---------------------------------------------------------------------
   8. SAMPLE PROFILE  —  DEMONSTRATION DATA ONLY
   Used by the "Load sample data" button so the app can be explored
   without entering personal details. Clearly flagged in the interface.
   --------------------------------------------------------------------- */
const SAMPLE_PROFILE = {
  name: 'Sample User',
  age: 27,
  sex: 'male',
  height: 176,
  weight: 76.8,
  targetWeight: 72,
  goal: 'loss',
  experience: 'beginner',
  daysPerWeek: 4,
  sessionMinutes: 45,
  equipment: 'basic_gym',
  activityLevel: 'sedentary',
  workoutsPerWeek: 2,
  skippedPerWeek: 2,
  dietQuality: 4,
  proteinMeals: 2,
  junkFoodPerWeek: 6,
  waterGlasses: 5,
  sleepHours: 6.5,
  steps: 6200,
  motivation: 5,
  screenBeforeBed: true,
  tracksProgress: false,
  savedAt: new Date().toISOString()
};

/* ---------------------------------------------------------------------
   9. DAILY CHECKLIST ITEMS
   --------------------------------------------------------------------- */
const CHECKLIST_ITEMS = [
  { key: 'workout', text: 'Complete the scheduled session (or your planned active recovery)', detail: 'Planned sessions this week.' },
  { key: 'protein', text: 'Hit your protein target across your main meals', detail: 'Daily protein target in grams.' },
  { key: 'water', text: 'Drink your water target, spread across the day', detail: 'Daily water target in glasses.' },
  { key: 'sleep', text: 'Protect a 7–9 hour sleep window tonight', detail: 'Daily sleep target in hours.' },
  { key: 'steps', text: 'Reach your daily step target', detail: 'Daily step target.' },
  { key: 'log', text: 'Log the day in the Progress tracker', detail: 'One entry a day in the Progress tab.' }
];
