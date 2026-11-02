// Server đồng bộ sản phẩm & tồn kho KiotViet cho giao diện Sales-Management.
// Chạy: cd server && node index.mjs   (đọc cấu hình từ server/.env, xem .env.example)
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
if (existsSync(join(here, '.env'))) process.loadEnvFile(join(here, '.env'));

const { KiotVietClient } = await import('./kiotviet.mjs');
const store = await import('./store.mjs');

const PORT = Number(process.env.PORT || 8888);
const SYNC_MINUTES = Number(process.env.SYNC_INTERVAL_MINUTES || 10);
const WEBHOOK_SECRET = process.env.KIOTVIET_WEBHOOK_SECRET || '';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const MIN_MANUAL_SYNC_MS = 30_000; // nút Đồng bộ: tối đa 1 lần / 30 giây để người xem demo không spam KiotViet
let lastManualSync = 0;
// CORS_ORIGIN: danh sách origin cách nhau bởi dấu phẩy; luôn cho phép localhost / 127.0.0.1 mọi cổng khi chạy dev
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
const allowOrigin = (origin) => {
	if (!origin) return ALLOWED_ORIGINS[0] || '*';
	if (ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
	return ALLOWED_ORIGINS[0] || '';
};

const kv = new KiotVietClient({
	clientId: process.env.KIOTVIET_CLIENT_ID,
	clientSecret: process.env.KIOTVIET_CLIENT_SECRET,
	retailer: process.env.KIOTVIET_RETAILER,
});

// ---------------------------------------------------------------- đồng bộ
let syncing = null;

export async function syncAll({ full = false } = {}) {
	if (syncing) return syncing;
	syncing = (async () => {
		const state = store.getState();
		const startedAt = new Date();
		const since = full ? undefined : state.lastModifiedFrom || undefined;
		try {
			const [branches, categories] = await Promise.all([kv.listBranches(), kv.listCategories()]);
			state.branches = branches.map((b) => ({ id: b.id, name: b.branchName, address: b.address }));
			state.categories = categories.map((c) => ({ id: c.categoryId, name: c.categoryName, parentId: c.parentId ?? null }));

			const products = await kv.listProducts(since);
			for (const p of products) store.upsertProduct(p);
			if (products.removedIds?.length) store.removeProducts(products.removedIds);

			// lùi 1 phút để không sót bản ghi sửa đúng lúc đang đồng bộ
			state.lastModifiedFrom = new Date(startedAt.getTime() - 60_000).toISOString();
			state.lastSyncAt = new Date().toISOString();
			store.addLog('sync', `${full || !since ? 'Đồng bộ toàn bộ' : 'Đồng bộ thay đổi'}: ${products.length} sản phẩm, xóa ${products.removedIds?.length || 0}`, {
				count: products.length,
			});
			return { ok: true, count: products.length, removed: products.removedIds?.length || 0, lastSyncAt: state.lastSyncAt };
		} catch (err) {
			store.addLog('error', `Đồng bộ lỗi: ${err.message}`);
			throw err;
		} finally {
			syncing = null;
		}
	})();
	return syncing;
}

// ---------------------------------------------------------------- webhook
// KiotViet gửi header X-Hub-Signature. Repo n8n tính HMAC-SHA256 nhưng gắn "sha1=" và tính trên JSON đã parse lại,
// nên ở đây tính trên body GỐC và chấp nhận cả sha1 / sha256 (hex hoặc base64). Cần kiểm tra lại với webhook thật.
function signatureValid(raw, header) {
	if (!WEBHOOK_SECRET) return true;
	if (!header) return false;
	const received = String(header).replace(/^sha(1|256)=/i, '');
	for (const algo of ['sha1', 'sha256']) {
		const mac = createHmac(algo, WEBHOOK_SECRET).update(raw);
		const digest = mac.digest();
		for (const candidate of [digest.toString('hex'), digest.toString('base64')]) {
			const a = Buffer.from(candidate);
			const b = Buffer.from(received);
			if (a.length === b.length && timingSafeEqual(a, b)) return true;
		}
	}
	return false;
}

function handleWebhook(raw, headers) {
	if (!signatureValid(raw, headers['x-hub-signature'])) {
		store.addLog('webhook', 'Sai chữ ký webhook, bỏ qua', { signature: headers['x-hub-signature'] });
		return { status: 401, body: { ok: false, message: 'Invalid signature' } };
	}
	const body = JSON.parse(raw.toString('utf8') || '{}');
	if (Array.isArray(body.RemoveId)) {
		store.removeProducts(body.RemoveId);
		store.addLog('webhook', `Xóa ${body.RemoveId.length} sản phẩm`);
		return { status: 200, body: { ok: true } };
	}
	let updated = 0;
	let missing = 0;
	for (const n of body.Notifications || []) {
		const action = String(n.Action || '').toLowerCase();
		for (const row of n.Data || []) {
			if (action.startsWith('stock')) {
				if (store.applyStock(row)) updated++;
				else missing++;
			} else if (action.startsWith('product')) {
				store.upsertProduct(row);
				updated++;
			}
		}
	}
	store.addLog('webhook', `Webhook: cập nhật ${updated}${missing ? `, ${missing} sản phẩm chưa có (chờ đồng bộ định kỳ)` : ''}`);
	if (missing) syncAll().catch(() => {});
	return { status: 200, body: { ok: true, updated } };
}

// ---------------------------------------------------------------- map sang dạng ProductData của giao diện
function toProductData(p, branchId) {
	const invs = branchId ? p.inventories.filter((i) => String(i.branchId) === String(branchId)) : p.inventories;
	const stock = invs.reduce((s, i) => s + i.onHand, 0);
	const costs = invs.filter((i) => i.cost > 0);
	return {
		_id: p.id,
		productId: p.code,
		barcode: p.barcode || p.code,
		name: p.name,
		costPrice: costs.length ? Math.round(costs.reduce((s, i) => s + i.cost, 0) / costs.length) : 0,
		sellPrice: p.basePrice,
		stock,
		description: p.description,
		categoryId: p.categoryId,
		categoryName: p.categoryName,
		unit: p.unit,
		mainImage: p.images[0],
		listImage: p.images,
		isVariable: false,
		variables: [],
		isSerial: false,
		serials: [],
		createdAt: p.createdDate,
		updatedAt: p.modifiedDate,
		isDelete: false,
		source: 'kiotviet',
		inventories: p.inventories,
	};
}

// ---------------------------------------------------------------- HTTP
const json = (res, status, body) => {
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Access-Control-Allow-Origin': allowOrigin(res.req?.headers.origin),
		Vary: 'Origin',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	});
	res.end(JSON.stringify(body));
};

const readBody = (req) =>
	new Promise((resolve, reject) => {
		const chunks = [];
		req.on('data', (c) => chunks.push(c));
		req.on('end', () => resolve(Buffer.concat(chunks)));
		req.on('error', reject);
	});

const server = createServer(async (req, res) => {
	const url = new URL(req.url, 'http://localhost');
	const path = url.pathname.replace(/\/+$/, '') || '/';
	const q = Object.fromEntries(url.searchParams);
	const state = store.getState();
	try {
		if (req.method === 'OPTIONS') return json(res, 200, {});

		if (path === '/products' && req.method === 'GET') {
			const page = Math.max(1, Number(q.page || 1));
			const limit = Math.max(1, Number(q.limit || 10));
			const keyword = (q.keyword || '').toLowerCase();
			let list = Object.values(state.products).filter((p) => p.isActive !== false);
			if (keyword) {
				list = list.filter((p) => [p.name, p.code, p.barcode].some((v) => (v || '').toLowerCase().includes(keyword)));
			}
			if (q.categoryId) list = list.filter((p) => String(p.categoryId) === String(q.categoryId));
			list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
			const products = list.slice((page - 1) * limit, page * limit).map((p) => toProductData(p, q.branchId));
			return json(res, 200, { statusCode: 200, ok: true, data: { products, total: list.length }, message: 'Success' });
		}

		if (path.startsWith('/products/variables/') && req.method === 'GET') return json(res, 200, { data: [] });

		if (path.startsWith('/products/') && req.method === 'GET') {
			const id = decodeURIComponent(path.split('/')[2]);
			const p = state.products[id] || Object.values(state.products).find((x) => x.code === id || x.barcode === id);
			return json(res, p ? 200 : 404, { ok: !!p, data: p ? toProductData(p, q.branchId) : null, message: p ? 'Success' : 'Not found' });
		}

		if (path === '/categories' && req.method === 'GET') {
			return json(res, 200, { data: (state.categories || []).map((c) => ({ _id: c.id, name: c.name, parentId: c.parentId })) });
		}

		if (path === '/kiotviet/status' && req.method === 'GET') {
			return json(res, 200, {
				ok: true,
				data: {
					lastSyncAt: state.lastSyncAt,
					productCount: Object.keys(state.products).length,
					branches: state.branches,
					syncIntervalMinutes: SYNC_MINUTES,
					log: state.log.slice(0, 20),
				},
			});
		}

		if (path === '/kiotviet/sync' && req.method === 'POST') {
			if (Date.now() - lastManualSync < MIN_MANUAL_SYNC_MS) {
				return json(res, 200, { ok: true, data: { count: 0, removed: 0, lastSyncAt: state.lastSyncAt }, message: 'Vừa đồng bộ, thử lại sau 30 giây' });
			}
			lastManualSync = Date.now();
			const isAdmin = ADMIN_KEY && req.headers['x-admin-key'] === ADMIN_KEY;
			const result = await syncAll({ full: isAdmin && q.full === 'true' });
			return json(res, 200, { ok: true, data: result, message: 'Đã đồng bộ' });
		}

		if (path === '/kiotviet/webhooks/register' && req.method === 'POST') {
			// Public trên mạng: chỉ ai có ADMIN_KEY mới được đăng ký webhook
			if (!ADMIN_KEY || req.headers['x-admin-key'] !== ADMIN_KEY) {
				return json(res, 403, { ok: false, message: 'Cần header X-Admin-Key đúng ADMIN_KEY' });
			}
			const { url: hookUrl } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
			if (!hookUrl || !WEBHOOK_SECRET) {
				return json(res, 400, { ok: false, message: 'Cần body {"url": "https://<domain public>/kiotviet/webhook"} và KIOTVIET_WEBHOOK_SECRET' });
			}
			const created = [];
			for (const type of ['product.update', 'product.delete', 'stock.update']) {
				created.push(await kv.registerWebhook(type, hookUrl, WEBHOOK_SECRET));
			}
			store.addLog('webhook', `Đăng ký webhook ${hookUrl}`);
			return json(res, 200, { ok: true, data: created });
		}

		if (path === '/kiotviet/webhook' && req.method === 'POST') {
			const r = handleWebhook(await readBody(req), req.headers);
			return json(res, r.status, r.body);
		}

		return json(res, 404, { ok: false, message: 'Not found' });
	} catch (err) {
		console.error(err);
		return json(res, 500, { ok: false, message: err.message });
	}
});

server.listen(PORT, () => {
	console.log(`KiotViet sync server: http://localhost:${PORT}`);
	const first = store.getState().lastSyncAt ? syncAll() : syncAll({ full: true });
	first.then((r) => console.log('Đồng bộ:', r)).catch((e) => console.error('Đồng bộ lỗi:', e.message));
	if (SYNC_MINUTES > 0) {
		setInterval(() => syncAll().catch((e) => console.error('Đồng bộ lỗi:', e.message)), SYNC_MINUTES * 60_000);
	}
});
