import semanticRelease from '@rtorcato/repo-tooling/semantic-release/github'

// The preset sets `labels: false` on @semantic-release/github, so failure issues are
// created unlabelled. The plugin finds its open failure issue by the `semantic-release`
// label, so it never finds one and opens a new issue on every failed release
// (#125, #126, #142, #143). Restore the label so it comments on the one issue instead.
export default {
	...semanticRelease,
	plugins: semanticRelease.plugins.map((plugin) =>
		Array.isArray(plugin) && plugin[0] === '@semantic-release/github'
			? [plugin[0], { ...plugin[1], labels: ['semantic-release'] }]
			: plugin
	),
}
