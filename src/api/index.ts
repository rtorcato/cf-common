import { CloudflareError } from '../errors/index.js'

/** Cloudflare's v4 REST API. */
const BASE_URL = 'https://api.cloudflare.com/client/v4'

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** Query params; `undefined` values are skipped. See Cloudflare's API reference for each endpoint's keys. */
export type QueryParams = Record<string, string | number | boolean | undefined>

/** The v4 envelope's `result_info` on list endpoints. */
export interface ResultInfo {
	page: number
	per_page: number
	count: number
	total_count: number
	total_pages?: number
}

/** One page of a list endpoint. */
export interface Page<T> {
	result: T[]
	resultInfo: ResultInfo
}

/** One entry of the v4 envelope's `errors`. */
export interface ApiErrorDetail {
	code: number
	message: string
}

/** The common fields of a zone. Call `request<YourType>` for the full payload. */
export interface Zone {
	id: string
	name: string
	status: string
	paused: boolean
	type: string
	name_servers: string[]
	account: { id: string; name: string }
}

/** The fields you send to create or update a DNS record. */
export interface DnsRecordInput {
	type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV' | 'CAA' | (string & {})
	name: string
	content: string
	/** Seconds, or 1 for "automatic". */
	ttl?: number
	proxied?: boolean
	priority?: number
	comment?: string
	tags?: string[]
}

/** The common fields of a DNS record. Call `request<YourType>` for the full payload. */
export interface DnsRecord extends DnsRecordInput {
	id: string
	ttl: number
	proxiable: boolean
	created_on: string
	modified_on: string
}

/** One purge mode per request. Cloudflare's per-request limits on `files`, `tags`, … apply. */
export type PurgeCacheBody =
	| { purge_everything: true }
	| { files: (string | { url: string; headers?: Record<string, string> })[] }
	| { tags: string[] }
	| { hosts: string[] }
	| { prefixes: string[] }

export interface CloudflareApi {
	/**
	 * Call any v4 endpoint and return the envelope's `result`. `path` is used
	 * verbatim (it starts with `/`), so encode any ids you put into it.
	 */
	request<T>(
		method: Method,
		path: string,
		init?: { query?: QueryParams; body?: unknown }
	): Promise<T>
	/** Call a list endpoint and return one page plus its `result_info`. */
	requestPage<T>(path: string, query?: QueryParams): Promise<Page<T>>
	zones: {
		list(query?: QueryParams): Promise<Page<Zone>>
		get(zoneId: string): Promise<Zone>
	}
	dns: {
		list(zoneId: string, query?: QueryParams): Promise<Page<DnsRecord>>
		create(zoneId: string, record: DnsRecordInput): Promise<DnsRecord>
		/** PATCH, so only the fields you pass change. */
		update(zoneId: string, recordId: string, record: Partial<DnsRecordInput>): Promise<DnsRecord>
		delete(zoneId: string, recordId: string): Promise<{ id: string }>
	}
	cache: {
		purge(zoneId: string, body: PurgeCacheBody): Promise<{ id: string }>
	}
}

interface Envelope {
	success?: boolean
	errors?: ApiErrorDetail[]
	result?: unknown
	result_info?: ResultInfo
}

/**
 * A small client for Cloudflare's v4 REST API: zones, DNS records and cache
 * purge, plus raw `request`/`requestPage` for any other endpoint. Authenticates
 * with an API token. Every failure (non-2xx, `success: false`, a non-JSON body,
 * a network error) throws a non-exposed 502 {@link CloudflareError} with code
 * `CF_API_ERROR`; the upstream status and `errors` are on `cause`. The token
 * never appears in the error.
 *
 * @example
 * const cf = createCloudflareApi({ token: requireEnv(env, 'CLOUDFLARE_API_TOKEN') })
 * const { result: zones } = await cf.zones.list({ name: 'example.com' })
 * await cf.cache.purge(zones[0].id, { files: ['https://example.com/app.css'] })
 */
export function createCloudflareApi(options: { token: string }): CloudflareApi {
	const { token } = options

	async function call(
		method: Method,
		path: string,
		query?: QueryParams,
		body?: unknown
	): Promise<Envelope> {
		const params = new URLSearchParams()
		for (const [key, value] of Object.entries(query ?? {})) {
			if (value !== undefined) params.set(key, String(value))
		}
		const qs = params.size ? `?${params}` : ''
		const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
		if (body !== undefined) headers['Content-Type'] = 'application/json'

		const fail = (status: number | string, detail: string | undefined, cause: unknown) =>
			new CloudflareError(
				`Cloudflare API ${method} ${path} failed (${status}): ${detail ?? 'no detail'}`,
				{ status: 502, expose: false, code: 'CF_API_ERROR', cause }
			)

		let res: Response
		try {
			res = await fetch(`${BASE_URL}${path}${qs}`, {
				method,
				headers,
				body: body === undefined ? undefined : JSON.stringify(body),
			})
		} catch (err) {
			throw fail('network', err instanceof Error ? err.message : undefined, err)
		}

		let envelope: Envelope | undefined
		try {
			envelope = await res.json<Envelope>()
		} catch {
			// Not JSON, e.g. an HTML error page from the edge.
		}
		const errors = Array.isArray(envelope?.errors) ? envelope.errors : []
		if (!res.ok || !envelope?.success) {
			throw fail(res.status, errors[0]?.message, { status: res.status, errors })
		}
		return envelope
	}

	const request: CloudflareApi['request'] = async (method, path, init = {}) =>
		(await call(method, path, init.query, init.body)).result as never

	const requestPage: CloudflareApi['requestPage'] = async (path, query) => {
		const envelope = await call('GET', path, query)
		return {
			result: (envelope.result ?? []) as never[],
			resultInfo: envelope.result_info as ResultInfo,
		}
	}

	const enc = encodeURIComponent
	const records = (zoneId: string) => `/zones/${enc(zoneId)}/dns_records`

	return {
		request,
		requestPage,
		zones: {
			list: (query) => requestPage('/zones', query),
			get: (zoneId) => request('GET', `/zones/${enc(zoneId)}`),
		},
		dns: {
			list: (zoneId, query) => requestPage(records(zoneId), query),
			create: (zoneId, record) => request('POST', records(zoneId), { body: record }),
			update: (zoneId, recordId, record) =>
				request('PATCH', `${records(zoneId)}/${enc(recordId)}`, { body: record }),
			delete: (zoneId, recordId) => request('DELETE', `${records(zoneId)}/${enc(recordId)}`),
		},
		cache: {
			purge: (zoneId, body) => request('POST', `/zones/${enc(zoneId)}/purge_cache`, { body }),
		},
	}
}
