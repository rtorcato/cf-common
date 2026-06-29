import { defineConfig } from 'tsup'

// ponytail: inlined instead of extending @rtorcato/js-tooling/tsup. js-tooling now
// ships compiled .mjs (the old type-stripping blocker is gone), but its base sets
// bundle:false + format ['cjs','esm'] + splitting, which diverge from this package's
// ESM-only, multi-entry subpath build. Re-extend only after diffing dist output.
export default defineConfig({
	// One entry per module → one subpath export. The runtime is workerd, so ESM only.
	entry: ['src/index.ts', 'src/*/index.ts'],
	format: ['esm'],
	dts: true,
	clean: true,
	splitting: false,
	sourcemap: true,
	minify: process.env.NODE_ENV === 'production',
})
