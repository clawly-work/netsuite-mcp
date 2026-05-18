import type { ListResult, NetSuiteClient } from "../netsuite-client.ts";

type Line = Record<string, unknown>;

type Lot = {
	id: string | number;
	inventorynumber: string;
	quantityavailable: number;
};

function getLines(data: Record<string, unknown>): Line[] {
	const item = data.item as { items?: Line[] } | undefined;
	return item?.items ?? [];
}

// NetSuite silently drops inventoryDetail.inventoryAssignment.items when the
// outer inventoryDetail.quantity is missing. Backfill it from line.quantity.
export function fillInventoryDetailQuantity(
	data: Record<string, unknown>,
): Record<string, unknown> {
	for (const line of getLines(data)) {
		const detail = line.inventoryDetail as Record<string, unknown> | undefined;
		if (!detail) continue;
		const assignment = detail.inventoryAssignment as
			| { items?: unknown[] }
			| undefined;
		if (!assignment?.items?.length) continue;
		if (detail.quantity == null) detail.quantity = line.quantity;
	}
	return data;
}

async function fetchLots(
	client: NetSuiteClient,
	itemId: string,
	locationId: string,
): Promise<Lot[]> {
	const res = (await client.suiteQL(
		`SELECT inv.id, inv.inventoryNumber, bal.location, SUM(bal.quantityAvailable) AS quantityAvailable FROM inventoryNumber inv JOIN inventoryBalance bal ON bal.inventoryNumber = inv.id WHERE inv.item = '${itemId}' AND bal.location = '${locationId}' GROUP BY inv.id, inv.inventoryNumber, bal.location HAVING SUM(bal.quantityAvailable) > 0 ORDER BY inv.id ASC`,
		{ limit: 500 },
	)) as ListResult<Lot>;
	return res.items ?? [];
}

// For any line that has an item + location + quantity but no inventoryDetail,
// look up available lots for that item/location. If lots exist (i.e. the item
// is lot-tracked AND has stock), auto-assign quantities FIFO across the
// returned lots. Silent no-op for non-lot-tracked items (no rows returned).
export async function autoAssignLots(
	client: NetSuiteClient,
	data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	for (const line of getLines(data)) {
		if (line.inventoryDetail) continue;
		const item = line.item as { id?: string } | undefined;
		const location = line.location as { id?: string } | undefined;
		const qty = line.quantity as number | undefined;
		if (!item?.id || !location?.id || !qty || qty <= 0) continue;

		const lots = await fetchLots(client, item.id, location.id);
		if (!lots.length) continue;

		const assignments: Array<{
			quantity: number;
			issueInventoryNumber: { id: string };
		}> = [];
		let remaining = qty;
		for (const lot of lots) {
			if (remaining <= 0) break;
			const take = Math.min(remaining, Number(lot.quantityavailable));
			if (take <= 0) continue;
			assignments.push({
				quantity: take,
				issueInventoryNumber: { id: String(lot.id) },
			});
			remaining -= take;
		}
		if (remaining > 0) {
			const have = qty - remaining;
			throw new Error(
				`Cannot auto-assign lots for item ${item.id} at location ${location.id}: need ${qty}, only ${have} available across ${lots.length} lot(s). Call inventory_search_lot_numbers to investigate.`,
			);
		}

		line.inventoryDetail = {
			quantity: qty,
			inventoryAssignment: { items: assignments },
		};
	}
	return data;
}
