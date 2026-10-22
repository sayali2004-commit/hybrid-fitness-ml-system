/* =====================================================================
   ml.js  —  Hybrid Fitness Intelligence (front-end client)
   ---------------------------------------------------------------------
   Talks to the local Python service that hosts the Random Forest habit
   classifier and the KNN workout recommender:

       POST /api/predict   { profile: {...} }  ->  predictions
       GET  /api/health                         ->  service + dataset status

   The panel is rendered with the existing SVG chart helpers in charts.js so
   the design, colours and layout stay exactly as they were. When the service
   is not running (or the training data is not usable) the panel shows an
   honest message instead of inventing a prediction.
   ===================================================================== */

const ML = (function () {
  'use strict';

  const API_BASES = ['/api', 'http://localhost:5000/api'];
  const TIMEOUT_MS = 8000;

  let activeBase = null;
  let lastSignature = null;
  let inFlight = false;

  const $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };

  function esc(text) {
    return String(text === undefined || text === null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pct(value) {
    return Math.round((Number(value) || 0) * 100);
  }

  function signature(profile) {
    return JSON.stringify(profile);
  }

  /* -------------------------------------------------------------------
     Network
     ------------------------------------------------------------------- */
  function fetchWithTimeout(url, options) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? window.setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;
    const opts = Object.assign({}, options || {});
    if (controller) opts.signal = controller.signal;

    return fetch(url, opts).then(function (response) {
      if (timer) window.clearTimeout(timer);
      return response;
    }, function (err) {
      if (timer) window.clearTimeout(timer);
      throw err;
    });
  }

  function request(path, options) {
    const bases = activeBase ? [activeBase] : API_BASES;
    let lastError = null;

    function attempt(index) {
      if (index >= bases.length) return Promise.reject(lastError || new Error('unreachable'));
      const url = bases[index] + path;
      return fetchWithTimeout(url, options).then(function (response) {
        return response.text().then(function (text) {
          let payload = null;
          try { payload = text ? JSON.parse(text) : null; } catch (err) { payload = null; }
          if (!response.ok || !payload) {
            const error = new Error(payload && payload.message ? payload.message : 'HTTP ' + response.status);
            error.response = payload;
            throw error;
          }
          activeBase = bases[index];
          return payload;
        });
      }).catch(function (err) {
        lastError = err;
        return attempt(index + 1);
      });
    }

    return attempt(0);
  }

  /* -------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------- */
  function setStatus(text, tone) {
    const el = $('#mlStatus');
    if (el) {
      el.textContent = text;
      el.className = 'card-hint' + (tone ? ' ml-hint-' + tone : '');
    }
  }

  function notice(title, text, tone) {
    const panel = $('#mlPanel');
    if (!panel) return;
    panel.innerHTML =
      '<div class="ml-notice ml-notice-' + (tone || 'info') + '">' +
      '<h4>' + esc(title) + '</h4>' +
      '<p>' + esc(text) + '</p>' +
      '</div>';
  }

  function renderWaiting(text) {
    const panel = $('#mlPanel');
    if (!panel) return;
    panel.innerHTML = '<div class="ml-loading"><span class="ml-spinner" aria-hidden="true"></span>' +
      '<span>' + esc(text) + '</span></div>';
  }

  function renderPrediction(result) {
    const panel = $('#mlPanel');
    if (!panel) return;

    const habit = result.habit || {};
    const recs = result.recommendations || [];
    const model = result.model || {};

    const habitRows = (habit.probabilities || []).map(function (p) {
      return { label: p.label, value: pct(p.value), tone: p.tone || 'warn' };
    });

    const recRows = recs.map(function (r) {
      return { label: r.label, values: [pct(r.match)] };
    });

    const recList = recs.map(function (r) {
      return '<li class="ml-rec-item">' +
        '<div class="ml-rec-rank">' + r.rank + '</div>' +
        '<div class="ml-rec-body">' +
        '<h4>' + esc(r.label) + '</h4>' +
        '<p class="ml-rec-focus">' + esc(r.focus) + '</p>' +
        '<p class="ml-rec-reason">' + esc(r.reason) + '</p>' +
        '</div>' +
        '<span class="ml-rec-match">' + pct(r.match) + '%</span>' +
        '</li>';
    }).join('');

    const neighbours = (result.neighbours && result.neighbours.labels) || [];

    panel.innerHTML =
      '<div class="ml-grid">' +
      '<div class="ml-block">' +
      '<div class="ml-block-head">' +
      '<span class="tag tag-info">Random Forest classifier</span>' +
      '<h4>Predicted habit category</h4>' +
      '</div>' +
      '<div class="ml-pred">' +
      '<span class="ml-pred-label">' + esc(habit.label || '—') + '</span>' +
      '<span class="ml-pred-conf">' + pct(habit.confidence) + '% confidence</span>' +
      '</div>' +
      '<p class="ml-summary">' + esc(habit.summary || '') + '</p>' +
      '<div id="mlHabitChart" class="chart-host"></div>' +
      '<p class="ml-note">Class probabilities produced by the trained forest — no rule based shortcut.</p>' +
      '</div>' +
      '<div class="ml-block">' +
      '<div class="ml-block-head">' +
      '<span class="tag tag-good">KNN recommender</span>' +
      '<h4>Recommended workout categories</h4>' +
      '</div>' +
      '<div id="mlRecChart" class="chart-host"></div>' +
      '<ul class="ml-rec-list">' + recList + '</ul>' +
      '<p class="ml-note">' +
      (neighbours.length
        ? 'Nearest training profiles suggested: ' + esc(neighbours.slice(0, 5).join(', ').replace(/_/g, ' ')) + '.'
        : '') +
      '</p>' +
      '</div>' +
      '</div>' +
      '<div class="ml-meta">' +
      '<span class="ml-meta-item"><strong>' + esc(model.classifier || 'RandomForestClassifier') + '</strong> habit classifier</span>' +
      '<span class="ml-meta-item"><strong>' + esc(model.recommender || 'KNeighborsClassifier') + '</strong> recommender</span>' +
      '<span class="ml-meta-item">trained on <strong>' + esc(model.datasetRows || '—') + '</strong> labelled rows</span>' +
      '<span class="ml-meta-item">test accuracy <strong>' + pct(model.classifierAccuracy) + '%</strong> (habit)</span>' +
      '<span class="ml-meta-item">test accuracy <strong>' + pct(model.recommenderAccuracy) + '%</strong> (recommendation)</span>' +
      '<button class="btn btn-ghost btn-sm" id="mlRefresh" type="button">Refresh prediction</button>' +
      (result.readOnly ? '' : '<button class="btn btn-ghost btn-sm" id="mlRetrain" type="button">Retrain model</button>') +
      '</div>';

    if (habitRows.length) {
      Charts.horizontalBars($('#mlHabitChart'), habitRows, {
        title: 'Predicted probability per habit category',
        labelWidth: 160
      });
    }
    if (recRows.length) {
      Charts.bars($('#mlRecChart'), recRows, {
        height: 220,
        series: ['Match'],
        colors: ['#0ea5e9']
      });
    }

    const refresh = $('#mlRefresh');
    if (refresh) refresh.addEventListener('click', function () { refreshPrediction(true); });

    const retrain = $('#mlRetrain');
    if (retrain) {
      retrain.addEventListener('click', function () {
        retrain.disabled = true;
        retrain.textContent = 'Retraining …';
        setStatus('Retraining the models from the CSV …', '');
        request('/train', { method: 'POST' }).then(function (health) {
          if (health.status === 'ok') {
            lastSignature = null;
            return refreshPrediction(true);
          }
          panel.dataset.state = 'error';
          renderError(health);
        }).catch(function () {
          setStatus('Model service unavailable', 'bad');
          notice('Machine learning service not reachable', 'The retrain request could not be delivered.', 'bad');
        }).then(function () {
          retrain.disabled = false;
          retrain.textContent = 'Retrain model';
        });
      });
    }

    setStatus('Model prediction · ' + (model.trainedAt ? 'trained ' + String(model.trainedAt).slice(0, 10) : ''), 'ok');
  }

  function renderError(result) {
    const status = result.status || 'error';
    if (status === 'insufficient_data') {
      setStatus('Training data insufficient', 'warn');
      notice(
        'Insufficient training data',
        (result.message || 'The labelled dataset is too small to train the models.') +
        ' Add more labelled rows to ml/data/fitness_habits.csv and run "python -m ml.train".',
        'warn'
      );
      return;
    }
    if (status === 'invalid_request') {
      setStatus('Profile incomplete', 'warn');
      notice('Profile incomplete', result.message || 'The profile could not be read.', 'warn');
      return;
    }
    if (status === 'read_only') {
      setStatus('Model is read-only here', 'warn');
      notice('Retraining disabled', result.message || 'This deployment ships a pre-trained model.', 'warn');
      return;
    }
    setStatus('Model service unavailable', 'bad');
    notice(
      'Machine learning service not reachable',
      'Start it with "python -m ml.serve" (it serves this page on http://localhost:5000) and refresh. ' +
      'The rule based analysis on the other pages keeps working without it.',
      'bad'
    );
  }

  /* -------------------------------------------------------------------
     Public API
     ------------------------------------------------------------------- */
  function refreshPrediction(force) {
    const profile = window.FitnessApp && window.FitnessApp.getState
      ? window.FitnessApp.getState().profile
      : null;

    const panel = $('#mlPanel');
    if (!panel) return Promise.resolve(null);

    if (!profile) {
      lastSignature = null;
      setStatus('Waiting for a profile', 'warn');
      notice(
        'No habit profile yet',
        'Save your profile and the hybrid model will classify your habit category and suggest workout categories.',
        'info'
      );
      return Promise.resolve(null);
    }

    const sig = signature(profile);
    if (!force && sig === lastSignature && (inFlight || panel.dataset.state === 'ready')) {
      return Promise.resolve(null);
    }
    lastSignature = sig;
    inFlight = true;

    renderWaiting('Running the Random Forest classifier and the KNN recommender …');
    setStatus('Predicting …', '');

    return request('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: profile })
    }).then(function (result) {
      inFlight = false;
      if (result.status !== 'ok') {
        panel.dataset.state = 'error';
        renderError(result);
        return result;
      }
      panel.dataset.state = 'ready';
      renderPrediction(result);
      return result;
    }).catch(function (err) {
      inFlight = false;
      panel.dataset.state = 'error';
      setStatus('Model service unavailable', 'bad');
      notice(
        'Machine learning service not reachable',
        'The browser could not reach the local model service (' + (err && err.message ? err.message : 'no response') +
        '). Start it with "python -m ml.serve" and refresh this page.',
        'bad'
      );
      return null;
    });
  }

  function init() {
    const panel = $('#mlPanel');
    if (!panel) return;
    setStatus('Checking the local model service …', '');
    renderWaiting('Connecting to the local model service …');
    request('/health', { method: 'GET' }).then(function (health) {
      if (health.status === 'insufficient_data') {
        lastSignature = null;
        panel.dataset.state = 'error';
        setStatus('Training data insufficient', 'warn');
        notice(
          'Insufficient training data',
          (health.message || 'The labelled dataset is too small to train the models.') +
          ' Rebuild it with "python -m ml.build_dataset" and retrain with "python -m ml.train".',
          'warn'
        );
        return;
      }
      refreshPrediction(true);
    }).catch(function () {
      panel.dataset.state = 'error';
      setStatus('Model service unavailable', 'bad');
      notice(
        'Machine learning service not reachable',
        'Start the local model service with "python -m ml.serve" (http://localhost:5000) and refresh this page. ' +
        'The rule based habit analysis works without it.',
        'bad'
      );
    });
  }

  return {
    init: init,
    refreshPrediction: refreshPrediction,
    isBusy: function () { return inFlight; }
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  window.ML = ML;
  ML.init();
});
