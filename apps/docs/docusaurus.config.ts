import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { themes as prismThemes } from 'prism-react-renderer'

// The @rtorcato open-source family. Surfaced as a navbar "Projects" dropdown
// (Docusaurus renders navbar items in the mobile menu too) and in the footer,
// so every sibling site cross-links to the rest. Keep in sync across repos.
const GITHUB_PROFILE = 'https://github.com/rtorcato'
const PROJECT_FAMILY = [
	{ label: 'js-common', href: 'https://rtorcato.github.io/js-common/' },
	{ label: 'api-common', href: 'https://rtorcato.github.io/api-common/' },
	{ label: 'browser-common', href: 'https://rtorcato.github.io/browser-common/' },
	{ label: 'db-common', href: 'https://rtorcato.github.io/db-common/' },
	{ label: 'cf-common', href: 'https://rtorcato.github.io/cf-common/' },
	{ label: 'react-common', href: 'https://github.com/rtorcato/react-common' },
	{ label: 'swift-common', href: 'https://rtorcato.github.io/swift-common/' },
	{ label: 'js-tooling', href: 'https://rtorcato.github.io/js-tooling/' },
]

// One typedoc plugin instance per subpath module. Each reads `../../src/<mod>`
// directly (no build needed) and writes docs/api/<mod>/index.md, which
// sidebars.ts links to by doc id. Add a module here when it ships — that's the
// only edit needed; the API docs regenerate from source JSDoc on every build.
const MODULES = ['errors', 'env', 'kv', 'r2', 'd1'] as const

const typedocPlugins = MODULES.map((mod) => [
	'docusaurus-plugin-typedoc',
	{
		id: mod,
		entryPoints: [`../../src/${mod}/index.ts`],
		tsconfig: '../../tsconfig.json',
		// The library targets workerd types and typechecks on its own toolchain;
		// the docs workspace pins an older TS. Skip TypeDoc's redundant check.
		skipErrorChecking: true,
		out: `docs/api/${mod}`,
		readme: 'none',
		includeVersion: false,
		excludePrivate: true,
		excludeInternal: true,
		excludeExternals: true,
		sort: ['source-order'],
		outputFileStrategy: 'modules',
	},
])

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

	plugins: [
		...typedocPlugins,
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
	] as Config['plugins'],

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
					type: 'dropdown',
					label: 'Projects',
					position: 'left',
					items: [{ label: 'All on GitHub →', href: GITHUB_PROFILE }, ...PROJECT_FAMILY],
				},
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
							href: 'https://github.com/rtorcato/cf-common/milestones',
						},
					],
				},
				{
					title: 'Projects',
					items: PROJECT_FAMILY,
				},
				{
					title: 'Community',
					items: [
						{ label: 'Issues', href: 'https://github.com/rtorcato/cf-common/issues' },
						{
							label: 'License (MIT)',
							href: 'https://github.com/rtorcato/cf-common/blob/main/LICENSE',
						},
						{ label: '@rtorcato', href: GITHUB_PROFILE },
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
