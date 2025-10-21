Passcode Gate Smoke Test

Overview
- Verifies the dynamic passcode overlay renders, rejects incorrect input, and unlocks on the correct passcode.
- Non-invasive: does not modify boot sequence or core UI; runs in a separate page.

Files
- visual-only/passcode-gate.smoke.html — Standalone page to open in a browser.
- visual-only/passcode-gate.smoke.js — Runner script that performs checks and reports results.
- visual-only/passcode-gate.js — The passcode overlay under test.

How to Run
1) Ensure the repository files are served or opened locally. You can double-click the HTML file or use any static file server.
2) Open visual-only/passcode-gate.smoke.html in your browser.
3) Observe the result list. The runner checks:
   - Overlay renders on load
   - Incorrect code shows an error and remains locked
   - Correct code unlocks and removes overlay
4) After unlock, click the “Underlying Button” to confirm the page is interactive again; the Clicks counter should increment.

Notes
- The current passcode is 2123 (defined in visual-only/passcode-gate.js).
- To bypass the gate entirely (not used by the smoke tests), set localStorage.passcodeBypass = '1' or add ?bypass=1 to the URL.

