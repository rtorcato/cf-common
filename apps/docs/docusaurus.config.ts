import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { themes as prismThemes } from 'prism-react-renderer'
import { copyright, GITHUB_PROFILE, projectFamilyItems } from '@rtorcato/shared-docs'
import { MODULES } from './modules'

// The @rtorcato open-source family. Surfaced as a navbar "Projects" dropdown
// (Docusaurus renders navbar items in the mobile menu too) and in the footer,
// so every sibling site cross-links to the rest. Sourced from the shared
// @rtorcato/shared-docs package — the single place to edit the family.
const PROJECT_FAMILY = projectFamilyItems()

// One typedoc plugin instance per module in modules.ts. Each reads
// `../../src/<mod>` directly (no build needed) and writes docs/api/<mod>/index.md,
// which sidebars.ts links to by doc id.
const typedocPlugins = Object.entries(MODULES).map(([mod, description]) => [
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
		// Default is just typedoc-plugin-markdown; add frontmatter + the local Example-first reorder.
		plugin: [
			'typedoc-plugin-markdown',
			'typedoc-plugin-frontmatter',
			`${__dirname}/typedoc-plugin-reorder-example.mjs`,
		],
		frontmatterGlobals: { description },
		outputFileStrategy: 'modules',
	},
])

const config: Config = {
	title: 'cf-common',
	tagline: 'Typed TypeScript wrappers and helpers for Cloudflare bindings and APIs.',
	favicon: 'img/favicon.svg',

	url: 'https://docs.torcato.dev',
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
		{
			// iOS home-screen icon — Docusaurus only emits the `favicon` link.
			// headTags hrefs are raw, so the baseUrl prefix is hardcoded.
			tagName: 'link',
			attributes: {
				rel: 'apple-touch-icon',
				sizes: '512x512',
				href: '/cf-common/img/favicon-512.png',
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
		// og:image / twitter:card for every page. Relative to static/; Docusaurus
		// makes it absolute against `url` + `baseUrl`, which scrapers need.
		image: 'img/social-card.png',
		colorMode: {
			defaultMode: 'dark',
			respectPrefersColorScheme: true,
		},
		navbar: {
			title: 'cf-common',
			logo: {
				alt: 'cf-common',
				src: 'img/logo.svg',
				srcDark: 'img/logo-dark.svg',
				width: 26,
				height: 26,
			},
			items: [
				{ to: '/docs', position: 'left', label: 'Docs' },
				{ to: '/docs/guides/getting-started', position: 'left', label: 'Guides' },
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
				{
					href: 'https://www.npmjs.com/package/@rtorcato/cf-common',
					label: 'npm',
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
						{ label: 'Changelog', to: '/docs/changelog' },
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
			copyright: copyright(),
		},
		// `theme` is the LIGHT-mode Prism theme, `darkTheme` the dark one (#113).
		prism: {
			theme: prismThemes.vsLight,
			darkTheme: prismThemes.vsDark,
			additionalLanguages: ['bash', 'json', 'typescript'],
		},
	} satisfies Preset.ThemeConfig,
}

export default config
