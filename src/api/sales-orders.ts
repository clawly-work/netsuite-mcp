import type { ListParams, NetSuiteClient } from "../netsuite-client.ts";

const RECORD_TYPE = "salesOrder";

// NetSuite silently drops `inventoryDetail.inventoryAssignment.items` if the
// `inventoryDetail.quantity` field is omitted. The line-level `quantity` is the
// authoritative source, so backfill it whenever the caller supplied a lot
// assignment without explicitly setting the inventoryDetail quantity.
function normalizeInventoryDetail(
	data: Record<string, unknown>,
): Record<string, unknown> {
	const item = data.item as
		| { items?: Array<Record<string, unknown>> }
		| undefined;
	if (!item?.items?.length) return data;

	for (const line of item.items) {
		const detail = line.inventoryDetail as Record<string, unknown> | undefined;
		if (!detail) continue;
		const assignment = detail.inventoryAssignment as
			| { items?: Array<Record<string, unknown>> }
			| undefined;
		if (!assignment?.items?.length) continue;
		if (detail.quantity == null) detail.quantity = line.quantity;
	}
	return data;
}

export function registerSalesOrderAPI(client: NetSuiteClient) {
	return {
		list(params: ListParams = {}) {
			return client.listRecords(RECORD_TYPE, params);
		},

		get(id: string) {
			return client.getRecord(RECORD_TYPE, id);
		},

		create(data: Record<string, unknown>) {
			return client.createRecord(RECORD_TYPE, normalizeInventoryDetail(data));
		},

		update(id: string, data: Record<string, unknown>) {
			return client.updateRecord(
				RECORD_TYPE,
				id,
				normalizeInventoryDetail(data),
			);
		},

		delete(id: string) {
			return client.deleteRecord(RECORD_TYPE, id);
		},

		search(keyword: string, params: Omit<ListParams, "q"> = {}) {
			return client.listRecords(RECORD_TYPE, {
				...params,
				q: `tranId CONTAIN "${keyword}"`,
			});
		},

		searchBySQL(where: string, limit = 100) {
			return client.suiteQL(
				`SELECT id, tranId, tranDate, entity, status, total, memo FROM transaction WHERE type = 'SalesOrd' AND ${where}`,
				{ limit },
			);
		},
	};
}

export type SalesOrderAPI = ReturnType<typeof registerSalesOrderAPI>;
