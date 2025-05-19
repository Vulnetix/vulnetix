Avoid positioning using raw CSS because it is not responsive, use Vuetify correctly instead to position things.
All JavaScript code must be written in TypeScript.
Never weaken the type safety of TypeScript using athe `any` or `unknown` types.
Never use `var` for variable declarations. Always use `let` or `const`.
Never use `function` keyword for function declarations. Always use arrow functions.
Never use `this` keyword in arrow functions. Use `this` keyword only in class methods.
Use template strings (backticks) for string literals instead of single or double quotes.
Indent code using 4 spaces.
All API calls must be made using the `Client` class from `@shared/utils`.
When calling a backend api (in `functions` directory) the path should start after the inherent prefix `/api/:path` (e.g., `/:path`).
The `:path` follows the directory structure of the `functions/api` directory.
The syntax for path variables in file names is Cloudfalre methodology (i.e. `[uuid]`) which makes the value available in the `context.params` object.
When asked always complete frontend apicalls with a call to existing API or create a new API file and implemnetation to satisfy the request.
When creating a new API file, use the following naming convention: `api/[name].ts` where `[name]` is the name of the API endpoint.
Avoid using returned data directly in Vue components, instead, use a Pinia store to manage the state and data flow.
Use `async/await` for asynchronous code instead of `.then()` and `.catch()`.
Vue components must be structured as Single-File Components (.vue files).
SFCs should utilize TypeScript for `<script setup lang="ts">` rather than `defineComponent`, SCSS for `<style lang="scss" scoped>`, and scoped styling.
Vue Composition API functions (e.g., `ref`, `reactive`, `computed`, `watch` and related functions) are treated as keywords and do not require explicit imports from `vue`.
Within the `<template>` section of Vue SFCs, use PascalCase for component names (e.g., `<MyComponent />`) and not `<my-component />` style.
In Vue SFCs and string templates, employ self-closing tags for components that do not contain any content (e.g., `<MyComponent />`) and not `<my-component></my-component>` style.
Utilize the Vuetify framework for UI elements whenever feasible.
Grapical UI should represent a cyversecurity aesthetc with support for both dark and light Vuetify themes.
Use Vuetify's `v-model` for two-way data binding whenever supported, otherwise use Vuetify's `v-bind` for one-way data binding and log data changes if consuption of the changed data is not yet specified.
If Vuetify does not provide a suitable component, create a new custom component as a separate file and import it.
Import types for Database models from `@prisma/client` and use them directly in the code.
Import Cloudflare Workers types from `@cloudflare/workers-types` and use them directly in the code.
Store other reusable TypeScript interfaces in the `src/shared/interfaces.ts` file.
Use the `src/components` directory for reusable Vue components.
Use the `src/views` directory for route-specific Vue components.
Use the `src/assets` directory for static assets like images, fonts, and styles.
Use the `src/router` directory for Vue Router configuration and route definitions.
Use Pinia for state management across routes.
Use the `src/store` directory for Pinia store modules and state management.
Put all API calls in the `functions` directory using Cloudflare Workers.
In Workers functions, use the `context.data.prisma` object to access the Prisma client and perform database operations.
Use the `context.data.session` object to access the session data following `Session` model from `@prisma/client`.
Use the `context.env` object to access environment variables.
For R2 storage, use the `context.env.r2artifacts` object to access the R2 bucket.
For Cloudflare Queues use the `context.env.scanqueue` object to send messages to the queue.
Maintain Cloudflare Queue consumers in the `queue-consumers/<purpose>` directory, ensuring that each consumer is in its own directory for it's purpose.
For example, if the purpose is to scan files, the directory should be `queue-consumers/scan-files`.
For the queue consumer, a `wrangler.toml` file is required in the consumer directory, and it should be configured to use be a queue consumer instead of pages functions or worker.
For Cloudflare Queue consumer, use the `context.env.scanqueue` object to receive messages from the queue.
Maintain Cloudflare Workers AI functions in the `workers-ai/<purpose>` directory, ensuring that each function is in its own directory for its purpose.
For example, if the purpose is to scan files, the directory should be `workers-ai/scan-files`.
For the AI function, a `wrangler.toml` file is required in the function directory, and it should be configured to use be a worker instead of pages functions or queue consumer.
