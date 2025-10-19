/**
 * PASSCODE LOGIC - Teller 10-15A
 * Standalone JavaScript for passcode startup screen functionality
 *
 * USAGE:
 * 1. Set your passcode in the PASSCODE constant below
 * 2. Include this script in your HTML
 * 3. Call `await waitForPasscodeUnlock()` before initializing your app
 *
 * EXAMPLE:
 * (async function bootstrap() {
 *   await waitForPasscodeUnlock();
 *   // Your app initialization code here
 * })();
 */

// CONFIGURATION
const PASSCODE = '2123';  // Change this to your desired passcode
const PASSCODE_DIGIT_LABELS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];

/**
 * Waits for the user to enter the correct passcode before resolving
 * @returns {Promise<void>} Resolves when correct passcode is entered
 */
function waitForPasscodeUnlock() {
  const overlay = document.getElementById('passcode-overlay');
  const form = document.getElementById('passcode-form');
  const errorEl = document.getElementById('passcode-error');
  const inputs = Array.from(document.querySelectorAll('.passcode-input'));
  const page = document.querySelector('.page');

  // Fallback: if overlay elements don't exist, continue without lock
  if (!overlay || !form || inputs.length !== PASSCODE.length) {
    console.warn('Passcode overlay is unavailable; continuing without lock screen.');
    document.body?.classList.remove('passcode-locked');
    page?.removeAttribute('inert');
    return Promise.resolve();
  }

  // Lock the page
  document.body?.classList.add('passcode-locked');
  page?.setAttribute('inert', '');  // Prevents interaction with main content
  overlay.classList.remove('hidden');
  overlay.removeAttribute('aria-hidden');
  overlay.setAttribute('aria-modal', 'true');

  // Helper: Focus first empty input or first input
  const focusFirstEmpty = () => {
    const target = inputs.find((input) => !input.value) || inputs[0];
    target.focus();
    target.select?.();
  };

  requestAnimationFrame(focusFirstEmpty);

  // Helper: Clear all inputs
  const clearInputs = () => {
    inputs.forEach((input) => {
      input.value = '';
    });
  };

  // Helper: Submit form programmatically
  const submitForm = () => {
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  };

  let unlocked = false;

  return new Promise((resolve) => {
    // Unlock function
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      document.body?.classList.remove('passcode-locked');
      page?.removeAttribute('inert');  // Re-enable main content interaction
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.removeAttribute('aria-modal');
      if (errorEl) {
        errorEl.textContent = '';
      }
      clearInputs();
      resolve();
    };

    // Setup input handlers for each digit
    inputs.forEach((input, index) => {
      // PASTE HANDLER: Allow pasting full passcode
      input.addEventListener('paste', (event) => {
        const text = event.clipboardData?.getData('text') ?? '';
        if (!text) return;
        event.preventDefault();
        const digits = text.replace(/\D/g, '').slice(0, PASSCODE.length);
        inputs.forEach((el, idx) => {
          el.value = digits[idx] ?? '';
        });
        if (errorEl) {
          errorEl.textContent = '';
        }
        const nextIndex = Math.min(digits.length, inputs.length - 1);
        inputs[nextIndex].focus();
        if (digits.length === inputs.length) {
          submitForm();
        }
      });

      // INPUT HANDLER: Auto-advance to next field
      input.addEventListener('input', (event) => {
        const value = event.target.value.replace(/\D/g, '');
        event.target.value = value.slice(-1);
        if (event.target.value && index < inputs.length - 1) {
          inputs[index + 1].focus();
          inputs[index + 1].select?.();
        }
        if (errorEl) {
          errorEl.textContent = '';
        }
        // Auto-submit when all fields filled
        if (inputs.every((el) => el.value)) {
          submitForm();
        }
      });

      // KEYDOWN HANDLER: Navigation and backspace
      input.addEventListener('keydown', (event) => {
        // Backspace on empty field goes to previous
        if (event.key === 'Backspace' && !event.target.value && index > 0) {
          inputs[index - 1].focus();
          inputs[index - 1].value = '';
          inputs[index - 1].select?.();
          event.preventDefault();
        }
        // Arrow key navigation
        if (event.key === 'ArrowLeft' && index > 0) {
          inputs[index - 1].focus();
          inputs[index - 1].select?.();
          event.preventDefault();
        }
        if (event.key === 'ArrowRight' && index < inputs.length - 1) {
          inputs[index + 1].focus();
          inputs[index + 1].select?.();
          event.preventDefault();
        }
      });
    });

    // FORM SUBMIT HANDLER: Validate passcode
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (unlocked) return;
      const attempt = inputs.map((input) => input.value || '').join('');
      if (attempt === PASSCODE) {
        unlock();
      } else {
        if (errorEl) {
          errorEl.textContent = 'Incorrect passcode. Please try again.';
        }
        clearInputs();
        focusFirstEmpty();
      }
    });
  });
}

/**
 * ALTERNATIVE: Dynamic Creation Function
 * Use this if you prefer to create the overlay dynamically instead of embedding in HTML
 * This was used in earlier versions but is now deprecated in favor of always-mounted approach
 */
function createPasscodeOverlay() {
  if (!document.body) return {};

  const overlay = document.createElement('div');
  overlay.id = 'passcode-overlay';
  overlay.className = 'passcode-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'passcode-title');

  const dialog = document.createElement('div');
  dialog.className = 'passcode-dialog';

  const title = document.createElement('h2');
  title.id = 'passcode-title';
  title.textContent = 'Enter passcode';

  const hint = document.createElement('p');
  hint.className = 'passcode-hint';
  const digitDescription = PASSCODE.length === 1 ? 'digit' : `${PASSCODE.length}-digit code`;
  hint.textContent = `This personal dashboard is locked. Enter the ${digitDescription} to continue.`;

  const form = document.createElement('form');
  form.id = 'passcode-form';
  form.className = 'passcode-form';
  form.setAttribute('autocomplete', 'off');

  const inputsWrapper = document.createElement('div');
  inputsWrapper.className = 'passcode-inputs';

  for (let index = 0; index < PASSCODE.length; index += 1) {
    const input = document.createElement('input');
    input.className = 'passcode-input';
    input.type = 'password';
    input.inputMode = 'numeric';
    input.maxLength = 1;
    input.pattern = '[0-9]*';
    const label = PASSCODE_DIGIT_LABELS[index] ?? `Digit ${index + 1}`;
    input.setAttribute('aria-label', `${label} digit`);
    inputsWrapper.appendChild(input);
  }

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'btn btn--primary passcode-submit';
  submit.textContent = 'Unlock';

  form.append(inputsWrapper, submit);

  const error = document.createElement('p');
  error.id = 'passcode-error';
  error.className = 'passcode-error';
  error.setAttribute('role', 'status');
  error.setAttribute('aria-live', 'polite');

  dialog.append(title, hint, form, error);
  overlay.appendChild(dialog);
  document.body.prepend(overlay);
  document.body.classList.add('passcode-locked');

  return {
    overlay,
    form,
    errorEl: error,
    inputs: Array.from(inputsWrapper.querySelectorAll('.passcode-input')),
  };
}
