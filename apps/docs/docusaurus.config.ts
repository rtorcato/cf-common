import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { themes as prismThemes } from 'prism-react-renderer'

const config: Config = {
	title: 'cf-common',
	tagline: 'Typed TypeScript wrappers and helpers for Cloudflare bindings and APIs.',
	favicon: 'img/favicon.svg',

	url: 'https://rtorcato.github.io',
	baseUrl: '/cf-common/',

	organizationName: 'rtorcato',
	projectName: 'cf-common',

	onBrokenLinks: 'warn',

	markdown: {
		format: 'detect',
		hooks: {
			onBrokenMarkdownLinks: 'warn',
		},
	},

	i18n: {
		defaultLocale: 'en',
		locales: ['en'],
	},

	headTags: [
		{
			tagName: 'link',
			attributes: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
		},
		{
			tagName: 'link',
			attributes: {
				rel: 'preconnect',
				href: 'https://fonts.gstatic.com',
				crossorigin: 'anonymous',
			},
		},
	],

	presets: [
		[
			'classic',
			{
				docs: {
					sidebarPath: './sidebars.ts',
					// Marketing landing (src/pages/index.tsx) owns '/', docs live under '/docs'.
					routeBasePath: '/docs',
					editUrl: 'https://github.com/rtorcato/cf-common/edit/main/apps/docs/',
				},
				blog: false,
				theme: {
					customCss: './src/css/custom.css',
				},
			} satisfies Preset.Options,
		],
	],

	// TypeDoc API reference is intentionally omitted until the library ships
	// typed modules (KV #3, R2 #4, D1 #5, …). Wire docusaurus-plugin-typedoc
	// back in — pointed at ../../src/*/index.ts — once those land.
	plugins: [
		[
			'@easyops-cn/docusaurus-search-local',
			{
				hashed: true,
				indexDocs: true,
				indexBlog: false,
				docsRouteBasePath: '/docs',
				highlightSearchTermsOnTargetPage: true,
				searchBarShortcutHint: false,
			},
		],
	],

	themeConfig: {
		colorMode: {
			defaultMode: 'dark',
			respectPrefersColorScheme: true,
		},
		navbar: {
			title: 'cf-common',
			items: [
				{ to: '/docs', position: 'left', label: 'Docs' },
				{ to: '/docs/guides/getting-started', position: 'left', label: 'Getting started' },
				{
					href: 'https://github.com/rtorcato/cf-common',
					label: 'GitHub',
					position: 'right',
				},
			],
		},
		footer: {
			style: 'dark',
			links: [
				{
					title: 'Documentation',
					items: [
						{ label: 'Overview', to: '/docs' },
						{ label: 'Getting started', to: '/docs/guides/getting-started' },
					],
				},
				{
					title: 'Resources',
					items: [
						{ label: 'GitHub', href: 'https://github.com/rtorcato/cf-common' },
						{ label: 'npm', href: 'https://www.npmjs.com/package/@rtorcato/cf-common' },
						{
							label: 'Roadmap',
							href: 'https://github.com/rtorcato/cf-common/blob/main/ROADMAP.md',
						},
					],
				},
				{
					title: 'Sibling projects',
					items: [
						{ label: 'js-common', href: 'https://rtorcato.github.io/js-common/' },
						{ label: 'browser-common', href: 'https://rtorcato.github.io/browser-common/' },
						{ label: 'js-tooling', href: 'https://rtorcato.github.io/js-tooling/' },
					],
				},
				{
					title: 'Community',
					items: [
						{ label: 'Issues', href: 'https://github.com/rtorcato/cf-common/issues' },
						{
							label: 'License (MIT)',
							href: 'https://github.com/rtorcato/cf-common/blob/main/LICENSE',
						},
					],
				},
			],
			copyright: `Copyright © ${new Date().getFullYear()} Richard Torcato. Built with Docusaurus.`,
		},
		prism: {
			theme: prismThemes.vsDark,
			darkTheme: prismThemes.vsDark,
			additionalLanguages: ['bash', 'json', 'typescript'],
		},
	} satisfies Preset.ThemeConfig,
}

export default config
