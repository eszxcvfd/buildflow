import base from './base.js';

export default [
  ...base,
  {
    // Next.js-specific rules are wired via `next lint`'s own runtime; this
    // flat config supplies only the base TypeScript/Prettier baseline so the
    // shared package has a stable entry point for future Next.js rules.
  },
];
