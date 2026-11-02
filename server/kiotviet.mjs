// KiotViet Public API client.
// Cách kết nối theo repo ChickenAI/n8n-nodes-kiotviet (shared/KiotVietApi.ts):
//   token: POST https://id.kiotviet.vn/connect/token (client_credentials, scopes=PublicApi.Access)
//   API:   https://public.kiotapi.com, header Authorization: Bearer + Retailer
// Khác repo gốc: token có khóa chống xin trùng, retry cả 429, và chỉ xóa webhook đúng URL của mình.

const TOKEN_URL = process.env.KIOTVIET_TOKEN_URL || 'https://id.kiotviet.vn/connect/token';
const API_URL = process.env.KIOTVIET_API_URL || 'https://public.kiotapi.com';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class KiotVietClient {
	constructor({ clientId, clientSecret, retailer }) {
		if (!clientId || !clientSecret || !retailer) {
			throw new Error('Thiếu KIOTVIET_CLIENT_ID / KIOTVIET_CLIENT_SECRET / KIOTVIET_RETAILER trong server/.env');
		}
		this.clientId = clientId;
		this.clientSecret = clientSecret;
		this.retailer = retailer;
		this.token = null;
		this.tokenExpiry = 0;
		this.pendingToken = null;
	}

	async getToken(force = false) {
		if (!force && this.token && Date.now() < this.tokenExpiry) return this.token;
		if (this.pendingToken) return this.pendingToken;
		this.pendingToken = (async () => {
			const body = new URLSearchParams({
				grant_type: 'client_credentials',
				client_id: this.clientId,
				client_secret: this.clientSecret,
				scopes: 'PublicApi.Access',
			});
			const res = await this.fetchRetry(TOKEN_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body,
			});
			if (!res.ok) throw new Error(`KiotViet token ${res.status}: ${await res.text()}`);
			const data = await res.json();
			this.token = data.access_token;
			// token 24h; trừ 60s cho an toàn như repo gốc
			this.tokenExpiry = Date.now() + (Number(data.expires_in || 86400) - 60) * 1000;
			return this.token;
		})();
		try {
			return await this.pendingToken;
		} finally {
			this.pendingToken = null;
		}
	}

	// Retry khi lỗi mạng, 5xx hoặc 429 (giới hạn lượt gọi), chờ tăng dần 1s, 2s, 4s
	async fetchRetry(url, options, maxRetries = 3) {
		let lastError;
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const res = await fetch(url, options);
				const retryable = res.status === 429 || res.status >= 500;
				if (retryable && attempt < maxRetries) {
					await sleep(1000 * 2 ** attempt);
					continue;
				}
				return res;
			} catch (err) {
				lastError = err;
				if (attempt < maxRetries) await sleep(1000 * 2 ** attempt);
			}
		}
		throw lastError || new Error('KiotViet: hết số lần thử lại');
	}

	async request(method, path, { query, body } = {}, retried = false) {
		const url = new URL(API_URL + path);
		for (const [k, v] of Object.entries(query || {})) {
			if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
		}
		const token = await this.getToken();
		const res = await this.fetchRetry(url, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				Retailer: this.retailer,
				'Content-Type': 'application/json',
			},
			body: body ? JSON.stringify(body) : undefined,
		});
		if (res.status === 401 && !retried) {
			await this.getToken(true);
			return this.request(method, path, { query, body }, true);
		}
		const text = await res.text();
		if (!res.ok) throw new Error(`KiotViet ${method} ${path} ${res.status}: ${text.slice(0, 300)}`);
		return text ? JSON.parse(text) : null;
	}

	// Lấy hết các trang. KiotViet phân trang bằng pageSize (tối đa 100) + currentItem.
	async listAll(path, query = {}) {
		const pageSize = 100;
		const all = [];
		all.removedIds = [];
		for (let currentItem = 0; ; currentItem += pageSize) {
			const page = await this.request('GET', path, { query: { ...query, pageSize, currentItem } });
			const data = page?.data || [];
			all.push(...data);
			if (Array.isArray(page?.removeIds)) all.removedIds.push(...page.removeIds);
			if (data.length < pageSize || all.length >= (page?.total ?? 0)) break;
		}
		return all;
	}

	listCategories() {
		return this.listAll('/categories', { hierachicalData: false });
	}

	listProducts(lastModifiedFrom) {
		return this.listAll('/products', {
			includeInventory: true,
			includeRemoveIds: true,
			orderBy: 'id',
			lastModifiedFrom,
		});
	}

	listBranches() {
		return this.listAll('/branches');
	}

	listWebhooks() {
		return this.request('GET', '/webhooks').then((r) => r?.data || []);
	}

	// Chỉ xóa webhook trùng cả loại lẫn URL của mình, không đụng webhook của hệ thống khác
	async registerWebhook(type, url, secret) {
		const existing = await this.listWebhooks();
		for (const hook of existing) {
			if ((hook.type || hook.Type) === type && (hook.url || hook.Url) === url) {
				await this.request('DELETE', `/webhooks/${hook.id || hook.Id}`);
			}
		}
		return this.request('POST', '/webhooks', {
			body: { Webhook: { Type: type, Url: url, IsActive: true, Description: 'Tom Fruits sync', Secret: secret } },
		});
	}
}
