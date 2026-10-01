---
name: flow-design
description: Stage design of Flow State (type "flow design"). Turns a UI story into a screen inventory before any code: route, reference in the project's own design system, components, the four states (empty, loading, error, success) with their copy, and a deviation log. Use for stories of type ui after the go gate, or when the user asks to design a screen or spec a UI change. Project-aware; never invents a visual language when the project has one.
license: MIT
metadata:
  version: "0.7.0"
  flow-stage: design
---

# flow-design

Ground rules: read `../flow-core/ground-rules.md` first; nothing below overrides them.

You write down what a screen must look like and do before a builder touches it. The project's design system is the law; you translate, you do not invent. `<core>` is `../flow-core`.

## 0. Preconditions

A story with `Type: ui` and `Status: ready`. Find the project's design authority in this order: `flow.config.json` `design.doc`; a file named like `DESIGN_SYSTEM.md`, `docs/*DESIGN*.md`, `docs/*CANON*.md`, `docs/*CLARITY*.md`; a tokens file (`globals.css`, `tokens.*`, `tailwind.config.*`) only when it defines something (a non-empty `theme` or `theme.extend`, or `:root` custom properties). If none exists, say so and ask the human for one reference (a page they like in the product, or a system to adopt) before writing anything; on the answer, propose `node <core>/scripts/config.mjs set --scope project design.doc=<path>` and write it on a yes. Read the repository rules (`node <core>/scripts/rules.mjs --list`). Then `node <core>/scripts/state.mjs set stage=design`.

## 1. Inventory

One file per screen or component the story touches: `<spec-without-.md>/screens/<route-or-component>.md` from `<core>/templates/screen.md`.

- **Reference**: which existing screen or system section this translates, with the file and line (or the design doc section). "Translation over invention": a new pattern needs a reason the design doc does not already answer, and goes to the deviation log.
- **Components**: existing components by path first; a new component only when no existing one fits, with the reason.
- **Four states** for anything that loads data or acts: empty, loading, error, success, each with the exact copy and the next action. Never a blank area, never a raw error string, never stale data shown as current. Server-rendered pages apply the rule at page level: a failed source drops its section, not the page.
- **Copy**: only words the human or the design doc supplied; a missing string is `[⚠️ Pending: define with <who>]`, not an invented sentence.
- **Responsive and theme**: say how the screen behaves at phone width and in dark mode if the project has it, by reference to the tokens, not by new rules.
- **Deviation log**: every point where the screen departs from the reference, with the reason and who decided.

## 2. Handoff, optional

If the project uses a canvas or a design tool (Stitch, paper.design, Figma), produce the brief it needs from the inventory: tokens, components, states, copy. Do not produce images unless asked.

## 3. Close

Set the story's `Gate` to `visual` if it is not already, add the screen files to the story's Notes for the builder, `node <core>/scripts/state.mjs set stage=build`, and route to `flow-build`. The builder's plan must list the screen file under Context and the four states under Accepts.

## Never

- Never add a media query, a colour, a font or a spacing value the design doc does not define.
- Never write copy the human did not supply.
- Never skip a state because "it will not happen".
