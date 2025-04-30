All JavaScript code must be written in TypeScript.
Use template strings (backticks) for string literals instead of single or double quotes.
Indent code using 4 spaces.
Vue components must be structured as Single-File Components (.vue files).
SFCs should utilize TypeScript for `<script lang="ts">`, SCSS for `<style lang="scss" scoped>`, and scoped styling.
Vue Composition API functions (e.g., `ref`, `reactive`, `computed`, `watch` and related functions) are treated as keywords and do not require explicit imports.
Within the `<template>` section of Vue SFCs, use PascalCase for component names (e.g., `<MyComponent />`).
In Vue SFCs and string templates, employ self-closing tags for components that do not contain any content (e.g., `<MyComponent />`).
Utilize the Vuetify framework for UI elements whenever feasible.
If Vuetify does not provide a suitable component, create a new custom component as a separate file and import it.
Store reusable TypeScript interfaces in the `src/shared/interfaces.ts` file.
Use Pinia for state management across routes.
Pinia stores should be located in the `src/stores` directory.
