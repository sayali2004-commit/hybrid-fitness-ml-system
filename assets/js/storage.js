/* =====================================================================
   storage.js  —  Tiny localStorage wrapper (no backend, no database)
   ---------------------------------------------------------------------
   All user data lives in the browser under the keys below. If localStorage
   is unavailable (private mode / file:// restrictions) the app falls back
   to an in-memory object so it still works for the demonstration.
   ===================================================================== */

const Store = (function () {
  const KEYS = {
    profile: 'fha.profile',
    logs: 'fha.progressLogs',
    settings: 'fha.settings',
    checklist: 'fha.checklist',
    lastUndo: 'fha.lastUndo'
  };

  let memoryFallback = {};
  let available = (function () {
    try {
      const probe = '__fha_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  })();

  function read(key, fallback) {
    try {
      const raw = available ? window.localStorage.getItem(key) : memoryFallback[key];
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.warn('Store.read failed for', key, err);
      return fallback;
    }
  }

  function write(key, value) {
    const raw = JSON.stringify(value);
    try {
      if (available) window.localStorage.setItem(key, raw);
      else memoryFallback[key] = raw;
      return true;
    } catch (err) {
      console.warn('Store.write failed for', key, err);
      memoryFallback[key] = raw;
      return false;
    }
  }

  function remove(key) {
    try {
      if (available) window.localStorage.removeItem(key);
      else delete memoryFallback[key];
    } catch (err) {
      console.warn('Store.remove failed for', key, err);
    }
  }

  return {
    KEYS,
    isPersistent: function () { return available; },

    /* --- profile --- */
    getProfile: function () { return read(KEYS.profile, null); },
    setProfile: function (profile) { return write(KEYS.profile, profile); },
    clearProfile: function () { remove(KEYS.profile); },

    /* --- progress logs --- */
    getLogs: function () {
      const logs = read(KEYS.logs, []);
      return Array.isArray(logs) ? logs : [];
    },
    setLogs: function (logs) { return write(KEYS.logs, logs); },
    clearLogs: function () { remove(KEYS.logs); },

    /* --- settings (e.g. sample data flag) --- */
    getSettings: function () { return read(KEYS.settings, {}); },
    setSettings: function (settings) { return write(KEYS.settings, settings); },

    /* --- daily habit checklist state, keyed by date --- */
    getChecklist: function () { return read(KEYS.checklist, {}); },
    setChecklist: function (checklist) { return write(KEYS.checklist, checklist); },

    /* --- last deleted entry (for undo) --- */
    setLastUndo: function (entry) { return write(KEYS.lastUndo, entry); },
    getLastUndo: function () { return read(KEYS.lastUndo, null); },
    clearLastUndo: function () { remove(KEYS.lastUndo); },

    /* --- master reset --- */
    clearAll: function () {
      Object.keys(KEYS).forEach(function (k) { remove(KEYS[k]); });
      memoryFallback = {};
    }
  };
})();
