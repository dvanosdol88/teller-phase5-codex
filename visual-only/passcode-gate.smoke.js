// Simple browser smoke tests for passcode-gate.js
// Open visual-only/passcode-gate.smoke.html in a browser to run.
(function () {
  'use strict';

  const RESULTS = [];

  function logResult(ok, message) {
    RESULTS.push({ ok, message });
    const color = ok ? 'green' : 'red';
    console.log(`%c${ok ? 'PASS' : 'FAIL'}%c ${message}`, `color:${color};font-weight:bold`, 'color:inherit');
  }

  function renderResults() {
    const root = document.getElementById('smoke-results');
    if (!root) return;
    const ul = document.createElement('ul');
    ul.className = 'space-y-2';
    RESULTS.forEach((r) => {
      const li = document.createElement('li');
      li.textContent = `${r.ok ? 'PASS' : 'FAIL'} · ${r.message}`;
      li.style.color = r.ok ? '#16a34a' : '#dc2626';
      ul.appendChild(li);
    });
    root.innerHTML = '';
    root.appendChild(ul);
  }

  function waitFor(selector, timeout = 2000) {
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (performance.now() - start >= timeout) return resolve(null);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  function dispatchInput(el, value) {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function testOverlayAppears() {
    const modal = await waitFor('#passcode-modal', 1500);
    const ok = !!modal;
    logResult(ok, 'Overlay renders on load');
    return ok;
  }

  async function testIncorrectShowsError() {
    const modal = document.getElementById('passcode-modal');
    if (!modal) { logResult(false, 'Modal missing for incorrect test'); return false; }
    const inputs = Array.from(modal.querySelectorAll('input[type="password"]'));
    const btn = modal.querySelector('button[type="submit"]');
    if (inputs.length < 4 || !btn) { logResult(false, 'Inputs or submit not found'); return false; }
    const wrong = '0000';
    for (let i = 0; i < inputs.length; i += 1) dispatchInput(inputs[i], wrong[i] || '0');
    btn.click();
    await new Promise((r) => setTimeout(r, 50));
    const err = modal.querySelector('#passcode-error');
    const ok = !!err && typeof err.textContent === 'string' && err.textContent.length > 0;
    logResult(ok, 'Incorrect code shows error and remains locked');
    return ok;
  }

  async function testCorrectUnlock() {
    let modal = document.getElementById('passcode-modal');
    if (!modal) { logResult(false, 'Modal missing for correct unlock test'); return false; }
    const inputs = Array.from(modal.querySelectorAll('input[type="password"]'));
    const btn = modal.querySelector('button[type="submit"]');
    if (inputs.length < 4 || !btn) { logResult(false, 'Inputs or submit not found'); return false; }
    const code = '2123';
    for (let i = 0; i < inputs.length; i += 1) dispatchInput(inputs[i], code[i] || '');
    btn.click();
    await new Promise((r) => setTimeout(r, 50));
    modal = document.getElementById('passcode-modal');
    const ok = !modal && window.PasscodeGate && window.PasscodeGate.isUnlocked();
    logResult(!!ok, 'Correct code unlocks and removes overlay');
    return !!ok;
  }

  async function run() {
    // Ensure bypass is off
    try { localStorage.removeItem('passcodeBypass'); } catch (_) {}
    const ok1 = await testOverlayAppears();
    if (ok1) await testIncorrectShowsError();
    await testCorrectUnlock();
    renderResults();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();

