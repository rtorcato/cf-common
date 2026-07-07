import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
	docs: [
		{
			type: 'category',
			label: 'Start here',
			collapsed: false,
			items: ['index', 'guides/getting-started', 'guides/example-worker'],
		},
		{
			// One typedoc instance per module generates docs/api/<mod>/index.md.
			// Add the doc id here when a module ships (see MODULES in
			// docusaurus.config.ts).
			type: 'category',
			label: 'API Reference',
			collapsed: false,
			items: [
				{ type: 'doc', id: 'api/errors/index', label: 'errors' },
				{ type: 'doc', id: 'api/env/index', label: 'env' },
				{ type: 'doc', id: 'api/kv/index', label: 'kv' },
				{ type: 'doc', id: 'api/r2/index', label: 'r2' },
				{ type: 'doc', id: 'api/d1/index', label: 'd1' },
			],
		},
	],
}

export default sidebars
