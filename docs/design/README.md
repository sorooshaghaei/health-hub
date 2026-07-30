# Health Hub visual direction v1

This visual direction extends the existing restrained evergreen interface into a complete clinic product identity. It is designed for one doctor and one assistant, with clear role boundaries and minimal training overhead.

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

The doctor uses evergreen identity accents. The assistant uses clay only for role identity and assistant-owned actions. Patient states use dedicated semantic colors and must always include a text label; color is never the only indicator.

## Ten design boards

1. Brand foundation and logo variants
2. Color palette and patient-state semantics
3. Typography, spacing, and radius system
4. Clinic-level access screen
5. Doctor/Assistant role selection
6. Assistant queue dashboard
7. Doctor consultation workspace
8. Patient-flow state model
9. Mobile doctor, assistant, and notification views
10. Reusable component library

## Product UI principles

- Queue-first assistant workspace
- Consultation-first doctor workspace
- One decisive `Doctor finished` action
- No separate `call next patient` action
- No duplicate `start consultation` action
- Appointment time establishes order; arrival and room state control live flow
- Status changes are explicit, timestamped, and visible to both roles
- Destructive actions require confirmation
- Frequent actions use direct verbs rather than technical terminology

The implementation tokens are stored in `frontend/src/design-tokens.css`. They are intentionally separate from the existing stylesheet until the approved design direction is integrated screen by screen.
