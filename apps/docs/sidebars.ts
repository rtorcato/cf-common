import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
	docs: [
		{
			type: 'category',
			label: 'Start here',
			collapsed: false,
			items: ['index', 'guides/getting-started'],
		},
		// Module pages get wired in here as they land — one per Cloudflare
		// service (KV #3, R2 #4, D1 #5, Queues #6, DO #7, Cache #8,
		// Workers AI #9, Vectorize #10, Hyperdrive #11, REST client #12).
	],
}

export default sidebars
