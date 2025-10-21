# UI Tweaks: Manual Summary Layout and Controls

Scope: UI-only changes; no schema or data type modifications.

Changes
- Align `Total Assets` under the Assets column (visual-only/index.html: around assets section).
- Align `Total Liabilities` under the Liabilities column (visual-only/index.html: liabilities section).
- Center `Total Equity` card at the bottom of the 672 Elm card; remains `mx-auto` with `max-w-xs`.
- Make Save buttons smaller/less conspicuous (text-sm, px-3, py-1.5; neutral slate color).
- Remove number input spinners via CSS only; kept `type=number` for all manual fields.

Rationale
- Improves visual hierarchy and clarity without altering behavior or payloads.
- Matches user request to keep inputs typed-only and minimize button prominence.

Safety
- No JS, schema, or type changes.
- Element ids and handlers unchanged; minimal Tailwind/CSS tweaks only.
