import Link from '@docusaurus/Link'
import Layout from '@theme/Layout'
import clsx from 'clsx'
import type { ReactElement } from 'react'
import { siblings } from '@rtorcato/shared-docs'
import InstallTabs from '@site/src/components/InstallTabs'
import styles from './index.module.css'

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

type IconKey = 'shield' | 'layers' | 'brackets' | 'cloud'

function Icon({
	icon,
	title,
	size = 20,
}: {
	icon: IconKey
	title: string
	size?: number
}): ReactElement {
	return (
		<svg
			className={styles.pillarIconSvg}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.6}
			strokeLinecap="round"
			strokeLinejoin="round"
			role="img"
		>
			<title>{title}</title>
			{ICONS[icon]}
		</svg>
	)
}

const ICONS: Record<IconKey, ReactElement> = {
	shield: <path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6z" />,
	layers: (
		<>
			<path d="m12 3 9 5-9 5-9-5z" />
			<path d="m3 13 9 5 9-5M3 17l9 5 9-5" />
		</>
	),
	brackets: (
		<>
			<path d="m9 8-5 4 5 4" />
			<path d="m15 8 5 4-5 4" />
		</>
	),
	cloud: <path d="M6 18a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.6-1.5A4 4 0 0 1 18 18z" />,
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const PILLARS: { title: string; desc: string; icon: IconKey }[] = [
	{
		title: 'Typed end-to-end',
		desc: 'Strict types over every binding — no `any` at the edges.',
		icon: 'brackets',
	},
	{
		title: 'Tree-shakeable',
		desc: 'Named subpath exports — ship only the service you import.',
		icon: 'layers',
	},
	{
		title: 'Thin, not a framework',
		desc: 'A convenience layer over Cloudflare, never a wrapper you fight.',
		icon: 'shield',
	},
	{
		title: 'Zero required deps',
		desc: 'Pure helpers over the Workers runtime APIs you already have.',
		icon: 'cloud',
	},
]

type Mod = {
	name: string
	subpath: string
	desc: string
	status: 'Foundations' | 'Storage' | 'Messaging' | 'AI & Data' | 'REST'
}

const MODULES: Mod[] = [
	{
		name: 'Errors & results',
		subpath: 'errors',
		desc: 'Typed CloudflareError model + result helpers.',
		status: 'Foundations',
	},
	{
		name: 'Env & bindings',
		subpath: 'env',
		desc: 'Typed env access and getBinding helpers.',
		status: 'Foundations',
	},
	{
		name: 'KV',
		subpath: 'kv',
		desc: 'Typed get/put/list with JSON + TTL helpers.',
		status: 'Storage',
	},
	{
		name: 'R2',
		subpath: 'r2',
		desc: 'Object get/put/list, presigned URLs, multipart.',
		status: 'Storage',
	},
	{
		name: 'D1',
		subpath: 'd1',
		desc: 'Typed query helper, batch, migration runner.',
		status: 'Storage',
	},
	{
		name: 'Queues',
		subpath: 'queues',
		desc: 'Typed producer/consumer, batch ack helpers.',
		status: 'Messaging',
	},
	{
		name: 'Durable Objects',
		subpath: 'do',
		desc: 'Base class + typed storage accessor.',
		status: 'Messaging',
	},
	{
		name: 'Cache API',
		subpath: 'cache',
		desc: 'match/put wrappers with key + TTL helpers.',
		status: 'Messaging',
	},
	{ name: 'Workers AI', subpath: 'ai', desc: 'Typed run() per model family.', status: 'AI & Data' },
	{
		name: 'Vectorize',
		subpath: 'vectorize',
		desc: 'Upsert/query helpers with typed metadata.',
		status: 'AI & Data',
	},
	{ name: 'Hyperdrive', subpath: 'hyperdrive', desc: 'Connection helper.', status: 'AI & Data' },
	{
		name: 'REST client',
		subpath: 'api',
		desc: 'Account-level client over fetch, typed responses.',
		status: 'REST',
	},
]

const HERO_CODE = `import { getBinding } from '@rtorcato/cf-common/env'
import { kv } from '@rtorcato/cf-common/kv'

export default {
  async fetch(req, env) {
    const store = kv(getBinding(env, 'CACHE'))
    const hit = await store.getJSON<User>('u:42')
    return Response.json(hit ?? { id: 42 })
  },
}`

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Hero(): ReactElement {
	return (
		<header className={styles.hero}>
			<div className={styles.heroGlow} aria-hidden />
			<div className={styles.heroInner}>
				<div className={styles.wordmark}>
					<span className={styles.wmName}>cf</span>
					<span className={styles.wmDash}>-</span>
					<span className={styles.wmCommon}>common</span>
				</div>
				<p className={styles.tagline}>
					Typed TypeScript wrappers and helpers for Cloudflare bindings and APIs — one
					tree-shakeable module per service.
				</p>

				<div className={styles.heroBody}>
					<CodeWindow />
				</div>

				<div className={styles.heroActions}>
					<div className={styles.heroButtons}>
						<Link
							className={clsx('button button--primary button--lg', styles.cta)}
							to="/docs#install"
						>
							Get started →
						</Link>
						<Link className={clsx('button button--lg', styles.ctaSecondary)} to="/docs">
							Read the docs
						</Link>
					</div>
					<InstallTabs pkg="@rtorcato/cf-common" />
				</div>
			</div>
		</header>
	)
}

function CodeWindow(): ReactElement {
	return (
		<div className={styles.codeWindow}>
			<div className={styles.codeBar}>
				<span className={styles.dot} style={{ background: '#ff5f57' }} />
				<span className={styles.dot} style={{ background: '#febc2e' }} />
				<span className={styles.dot} style={{ background: '#28c840' }} />
				<span className={styles.codeFile}>worker.ts</span>
			</div>
			<pre className={styles.codePre}>{HERO_CODE}</pre>
		</div>
	)
}

function Pillars(): ReactElement {
	return (
		<section className={styles.section}>
			<div className={styles.pillarGrid}>
				{PILLARS.map((p) => (
					<div key={p.title} className={styles.pillar}>
						<div className={styles.pillarIcon}>
							<Icon icon={p.icon} title={p.title} />
						</div>
						<div className={styles.pillarTitle}>{p.title}</div>
						<div className={styles.pillarDesc}>{p.desc}</div>
					</div>
				))}
			</div>
		</section>
	)
}

function Modules(): ReactElement {
	return (
		<section className={styles.section}>
			<div className={styles.sectionHead}>
				<div>
					<h2 className={styles.h2}>One module per Cloudflare service</h2>
					<p className={styles.sub}>
						Each lands as a typed, tree-shakeable subpath. See the{' '}
						<Link to="https://github.com/rtorcato/cf-common/milestones">roadmap</Link> for status.
					</p>
				</div>
			</div>
			<div className={styles.catGrid}>
				{MODULES.map((m) => (
					<Link key={m.subpath} to="/docs" className={styles.card}>
						<div className={styles.cardHead}>
							<div className={styles.cardName}>{m.name}</div>
							<div className={styles.cardCount}>{m.status}</div>
						</div>
						<p className={styles.cardDesc}>{m.desc}</p>
						<div className={styles.chips}>
							<span className={styles.chip}>@rtorcato/cf-common/{m.subpath}</span>
						</div>
					</Link>
				))}
			</div>
		</section>
	)
}

// The landing grid shows the siblings — the whole family minus cf-common itself.
const SIBLINGS = siblings('@rtorcato/cf-common')

function Siblings(): ReactElement {
	return (
		<section className={styles.section}>
			<div className={styles.sectionHead}>
				<div>
					<h2 className={styles.h2}>Sibling projects</h2>
					<p className={styles.sub}>
						More from <code>@rtorcato</code> — same conventions, same release pipeline.
					</p>
				</div>
			</div>
			<div className={styles.siblingGrid}>
				{SIBLINGS.map((s) => (
					<Link key={s.name} href={s.href} className={styles.card}>
						<div className={styles.cardHead}>
							<div className={styles.cardName} style={{ color: s.accent }}>
								{s.name}
							</div>
							<div className={styles.cardCount}>{s.dest} ↗</div>
						</div>
						<p className={styles.cardDesc}>{s.tagline}</p>
					</Link>
				))}
			</div>
		</section>
	)
}

export default function Home(): ReactElement {
	return (
		<Layout
			title="cf-common"
			description="Typed TypeScript wrappers and helpers for Cloudflare bindings and APIs."
		>
			<main>
				<Hero />
				<Pillars />
				<Modules />
				<Siblings />
			</main>
		</Layout>
	)
}
