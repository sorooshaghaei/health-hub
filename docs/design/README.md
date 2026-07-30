# Health Hub visual direction v1

This visual direction extends the existing restrained evergreen interface into a clinic product identity. It is designed for one Doctor and one Assistant, with clear role boundaries and minimal training overhead.

## Brand concept

The logo is an `H` made from three connected forms. It represents Health Hub while also expressing two separate staff workspaces joined by one shared clinic workflow.

Two reusable SVG marks are available in `frontend/public`:

- `health-hub-logo.svg`: primary evergreen mark
- `health-hub-logo-soft.svg`: mint surface variant

## Core palette

- Clinic evergreen: `#176448`
- Deep evergreen: `#104B36`
- Quiet mint: `#DFF0E7`
- Assistant clay: `#B86F42`
- Canvas: `#F3F6F3`
- Ink: `#17231F`

The Doctor uses evergreen identity accents. The Assistant uses clay only for role identity and Assistant-owned actions. Patient states use dedicated semantic colors and must always include a text label; color is never the only indicator.

## Ten design boards

1. Brand foundation and logo variants
2. Color palette and patient-state semantics
3. Typography, spacing, and radius system
4. Clinic-level access screen
5. Doctor/Assistant role selection
6. Assistant queue dashboard
7. Doctor consultation workspace
8. Patient-flow state model
9. Mobile Doctor, Assistant, and workflow-indication views
10. Reusable component library

## Product UI principles

- Queue-first Assistant workspace
- Consultation-first Doctor workspace
- One decisive **Finished** action for the current consultation
- No separate Call next patient action
- No duplicate Start consultation action
- Scheduled appointment time is informational; actual check-in order controls the live waiting queue
- Patient states use clear text labels and are not communicated by color alone
- Reversal, undo, and confirmation behavior must be approved for each workflow before implementation
- Frequent actions use direct verbs rather than technical terminology

The implementation tokens are stored in `frontend/src/design-tokens.css`. They are intentionally separate from the existing stylesheet until the product owner approves integration screen by screen.
