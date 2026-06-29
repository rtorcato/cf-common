import { defineConfig } from 'tsup'

// ponytail: inlined instead of extending @rtorcato/js-tooling/tsup — that subpath
// ships raw .ts, which Node 24 refuses to type-strip under node_modules
// (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING). Re-extend once js-tooling ships compiled JS.
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
