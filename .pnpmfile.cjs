// TypeScript 7 ships only the native `tsc`, with no JS compiler API. tsup's dts
// build and typedoc both import that API, so give each its own TS 6 copy instead
// of the workspace's TS 7 peer. Delete this file once both support TypeScript 7.
module.exports = {
	hooks: {
		readPackage(pkg) {
			if (pkg.name === 'tsup') {
				delete pkg.peerDependencies?.typescript
				pkg.dependencies = { ...pkg.dependencies, typescript: 'npm:@typescript/typescript6@^6.0.2' }
			}
			if (pkg.name === 'typedoc') {
				delete pkg.peerDependencies?.typescript
				pkg.dependencies = { ...pkg.dependencies, typescript: 'npm:@typescript/typescript6@^6.0.2' }
			}
			return pkg
		},
	},
}
