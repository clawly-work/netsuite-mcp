import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createAPI } from "./api/index.ts";
import { createNetSuiteClient } from "./netsuite-client.ts";
import { registerCustomerTools } from "./tools/customers.ts";
import { registerInventoryTools } from "./tools/inventory.ts";
import { registerInvoiceTools } from "./tools/invoices.ts";
import { registerPurchaseOrderTools } from "./tools/purchase-orders.ts";
import { registerSalesOrderTools } from "./tools/sales-orders.ts";
import { registerSuiteQLTools } from "./tools/suiteql.ts";

export function createServer() {
	const server = new McpServer({
		name: "netsuite-mcp",
		version: "0.1.0",
	});

	const client = createNetSuiteClient();
	const api = createAPI(client);

	registerCustomerTools(server, api.customers);
	registerInventoryTools(server, api.inventory);
	registerSalesOrderTools(server, api.salesOrders, api.proformaInvoices);
	registerInvoiceTools(server, api.invoices);
	registerPurchaseOrderTools(server, api.purchaseOrders);
	registerSuiteQLTools(server, client);

	return server;
}
