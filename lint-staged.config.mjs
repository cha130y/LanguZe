/**
 * Pre-commit checks on staged files only. Each app is linted with its own ESLint config
 * (pnpm --filter sets the working directory), then Prettier formats everything it supports.
 * @type {import('lint-staged').Configuration}
 */
const eslintIn = (pkg) => (files) =>
  `pnpm --filter ${pkg} exec eslint --fix --max-warnings=0 ${files.map((f) => JSON.stringify(f)).join(' ')}`;

export default {
  'apps/web/**/*.{js,mjs,ts,tsx}': eslintIn('@languze/web'),
  'apps/api/**/*.{ts,mts}': eslintIn('@languze/api'),
  '*': 'prettier --write --ignore-unknown',
};
