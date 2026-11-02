// Kho dữ liệu đồng bộ: lưu ra server/data/kiotviet.json để khởi động lại không mất.
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'kiotviet.json');

const empty = () => ({ products: {}, branches: [], lastSyncAt: null, lastModifiedFrom: null, log: [] });

let state = empty();
try {
	state = { ...empty(), ...JSON.parse(readFileSync(FILE, 'utf8')) };
} catch {
	// chưa có file: bắt đầu rỗng
}

let saveTimer = null;
export function save() {
	clearTimeout(saveTimer);
	saveTimer = setTimeout(() => {
		mkdirSync(dirname(FILE), { recursive: true });
		writeFileSync(FILE + '.tmp', JSON.stringify(state));
		renameSync(FILE + '.tmp', FILE);
	}, 200);
}

export function addLog(type, message, extra = {}) {
	state.log.unshift({ at: new Date().toISOString(), type, message, ...extra });
	state.log = state.log.slice(0, 200);
	save();
}

// Chuẩn hóa sản phẩm KiotViet (camelCase từ REST, PascalCase từ webhook) về một dạng
const pick = (o, ...keys) => {
	for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null) return o[k];
	return undefined;
};

function normalizeInventory(inv) {
	return {
		branchId: pick(inv, 'branchId', 'BranchId'),
		branchName: pick(inv, 'branchName', 'BranchName'),
		onHand: Number(pick(inv, 'onHand', 'OnHand') ?? 0),
		reserved: Number(pick(inv, 'reserved', 'Reserved') ?? 0),
		cost: Number(pick(inv, 'cost', 'Cost') ?? 0),
	};
}

export function upsertProduct(raw) {
	const id = String(pick(raw, 'id', 'Id'));
	const prev = state.products[id] || {};
	const invRaw = pick(raw, 'inventories', 'Inventories');
	const images = pick(raw, 'images', 'Images');
	state.products[id] = {
		id,
		code: pick(raw, 'code', 'Code') ?? prev.code,
		barcode: pick(raw, 'barCode', 'BarCode') ?? prev.barcode,
		name: pick(raw, 'fullName', 'FullName', 'name', 'Name') ?? prev.name,
		categoryId: pick(raw, 'categoryId', 'CategoryId') ?? prev.categoryId,
		categoryName: pick(raw, 'categoryName', 'CategoryName') ?? prev.categoryName,
		basePrice: Number(pick(raw, 'basePrice', 'BasePrice') ?? prev.basePrice ?? 0),
		unit: pick(raw, 'unit', 'Unit') ?? prev.unit,
		description: pick(raw, 'description', 'Description') ?? prev.description,
		images: Array.isArray(images) ? images.map((i) => (typeof i === 'string' ? i : i?.Image || i?.image)).filter(Boolean) : prev.images || [],
		isActive: pick(raw, 'isActive', 'IsActive') ?? prev.isActive ?? true,
		createdDate: pick(raw, 'createdDate', 'CreatedDate') ?? prev.createdDate,
		modifiedDate: pick(raw, 'modifiedDate', 'ModifiedDate') ?? new Date().toISOString(),
		inventories: Array.isArray(invRaw) ? invRaw.map(normalizeInventory) : prev.inventories || [],
	};
	save();
	return state.products[id];
}

// Payload webhook stock.update: mỗi dòng là tồn của 1 sản phẩm tại 1 chi nhánh
export function applyStock(row) {
	const id = String(pick(row, 'ProductId', 'productId'));
	const p = state.products[id];
	if (!p) return false;
	const inv = normalizeInventory(row);
	const idx = p.inventories.findIndex((i) => String(i.branchId) === String(inv.branchId));
	if (idx >= 0) p.inventories[idx] = { ...p.inventories[idx], ...inv, branchName: inv.branchName ?? p.inventories[idx].branchName };
	else p.inventories.push(inv);
	p.modifiedDate = new Date().toISOString();
	save();
	return true;
}

export function removeProducts(ids) {
	for (const id of ids || []) delete state.products[String(id)];
	save();
}

export const getState = () => state;
