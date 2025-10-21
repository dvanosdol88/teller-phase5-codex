// Lightweight passcode gate modal integrated with existing UI
// Goals: Do not break boot, nice semi-transparent entry, minimal scope
(function () {
  'use strict';

  const PASSCODE = '2123'; // Change as desired

  function shouldBypass() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('bypass') === '1') return true;
      if (localStorage.getItem('passcodeBypass') === '1') return true;
    } catch (_) { /* no-op */ }
    return false;
  }

  function createPasscodeModal() {
    const container = document.createElement('div');
    container.id = 'passcode-modal';
    container.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';

    // Overlay (semi-transparent, blurred)
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50';
    overlay.setAttribute('aria-hidden', 'true');

    // Dialog content
    const content = document.createElement('div');
    content.className = 'bg-white w-full max-w-md rounded-2xl shadow-2xl relative p-6';
    content.style.backgroundColor = 'var(--bg-secondary)';
    content.setAttribute('role', 'dialog');
    content.setAttribute('aria-modal', 'true');
    content.setAttribute('aria-labelledby', 'passcode-title');

    const title = document.createElement('h2');
    title.id = 'passcode-title';
    title.className = 'text-2xl font-bold mb-2';
    title.style.color = 'var(--text-primary)';
    title.textContent = 'Enter passcode';

    const hint = document.createElement('p');
    hint.className = 'text-sm mb-4';
    hint.style.color = 'var(--text-secondary)';
    hint.textContent = `This personal dashboard is locked. Enter the ${PASSCODE.length}-digit code to continue.`;

    const form = document.createElement('form');
    form.id = 'passcode-form';
    form.autocomplete = 'off';
    form.className = 'flex flex-col gap-4 items-center';

    const inputsRow = document.createElement('div');
    inputsRow.className = 'flex gap-3';

    const inputs = [];
    for (let i = 0; i < PASSCODE.length; i += 1) {
      const input = document.createElement('input');
      input.type = 'password';
      input.inputMode = 'numeric';
      input.pattern = '[0-9]*';
      input.maxLength = 1;
      input.className = 'w-14 h-16 border rounded-xl text-center text-2xl font-semibold bg-white shadow-inner';
      input.style.borderColor = 'var(--border-color)';
      input.setAttribute('aria-label', `Digit ${i + 1}`);
      inputs.push(input);
      inputsRow.appendChild(input);
    }

    const button = document.createElement('button');
    button.type = 'submit';
    button.className = 'bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors min-w-[140px]';
    button.textContent = 'Unlock';

    const error = document.createElement('p');
    error.id = 'passcode-error';
    error.className = 'min-h-[1.25rem] m-0 text-red-600 font-medium';
    error.setAttribute('role', 'status');
    error.setAttribute('aria-live', 'polite');

    form.appendChild(inputsRow);
    form.appendChild(button);

    content.appendChild(title);
    content.appendChild(hint);
    content.appendChild(form);
    content.appendChild(error);

    container.appendChild(overlay);
    container.appendChild(content);
    document.body.appendChild(container);

    return { container, overlay, content, form, inputs, errorEl: error };
  }

  function init() {
    if (typeof document === 'undefined' || !document.body) return;
    if (shouldBypass()) return;

    const { container, overlay, form, inputs, errorEl } = createPasscodeModal();

    const focusFirstEmpty = () => {
      const target = inputs.find((el) => !el.value) || inputs[0];
      target && target.focus();
      if (target && typeof target.select === 'function') target.select();
    };

    const clearInputs = () => inputs.forEach((el) => { el.value = ''; });

    const submitForm = () => {
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    };

    // Handlers
    inputs.forEach((input, index) => {
      input.addEventListener('paste', (event) => {
        const text = event.clipboardData?.getData('text') ?? '';
        if (!text) return;
        event.preventDefault();
        const digits = String(text).replace(/\D/g, '').slice(0, PASSCODE.length);
        inputs.forEach((el, i) => { el.value = digits[i] ?? ''; });
        if (errorEl) errorEl.textContent = '';
        const nextIndex = Math.min(digits.length, inputs.length - 1);
        inputs[nextIndex].focus();
        if (digits.length === inputs.length) submitForm();
      });

      input.addEventListener('input', (event) => {
        const v = String(event.target.value || '').replace(/\D/g, '');
        event.target.value = v.slice(-1);
        if (event.target.value && index < inputs.length - 1) {
          inputs[index + 1].focus();
          typeof inputs[index + 1].select === 'function' && inputs[index + 1].select();
        }
        if (errorEl) errorEl.textContent = '';
        if (inputs.every((el) => el.value)) submitForm();
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Backspace' && !event.target.value && index > 0) {
          inputs[index - 1].focus();
          inputs[index - 1].value = '';
          typeof inputs[index - 1].select === 'function' && inputs[index - 1].select();
          event.preventDefault();
        }
        if (event.key === 'ArrowLeft' && index > 0) {
          inputs[index - 1].focus();
          typeof inputs[index - 1].select === 'function' && inputs[index - 1].select();
          event.preventDefault();
        }
        if (event.key === 'ArrowRight' && index < inputs.length - 1) {
          inputs[index + 1].focus();
          typeof inputs[index + 1].select === 'function' && inputs[index + 1].select();
          event.preventDefault();
        }
      });
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const attempt = inputs.map((el) => el.value || '').join('');
      if (attempt === PASSCODE) {
        window.__passcodeUnlocked = true;
        container.remove();
      } else {
        if (errorEl) errorEl.textContent = 'Incorrect passcode. Please try again.';
        clearInputs();
        focusFirstEmpty();
      }
    });

    // Clicks on overlay do nothing
    overlay.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); });

    // Show and focus
    requestAnimationFrame(focusFirstEmpty);
  }

  function safeInit() {
    try { init(); }
    catch (e) {
      console.warn('[PasscodeGate] init failed; bypassing gate', e);
      const modal = document.getElementById('passcode-modal');
      if (modal) modal.remove();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit, { once: true });
  } else {
    safeInit();
  }

  // Minimal API for runtime checks or manual unlock
  window.PasscodeGate = {
    isUnlocked: () => !!window.__passcodeUnlocked,
    unlock: () => {
      window.__passcodeUnlocked = true;
      const modal = document.getElementById('passcode-modal');
      if (modal) modal.remove();
    },
    init: safeInit,
  };
})();

