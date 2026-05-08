import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NetSuiteClient } from "../netsuite-client.ts";
import { err, ok } from "./helpers.ts";

export function registerSuiteQLTools(
	server: McpServer,
	client: NetSuiteClient,
) {
	server.tool(
		"suiteql_query",
		"Execute a raw SuiteQL query against NetSuite. SuiteQL is a SQL-like language for querying NetSuite data. Supports SELECT with JOIN, WHERE, ORDER BY. Common tables: transaction, customer, item, inventoryBalance, employee, vendor.",
		{
			query: z
				.string()
				.describe(
					"Full SuiteQL query, e.g. \"SELECT id, tranId FROM transaction WHERE type = 'SalesOrd' ORDER BY tranDate DESC\"",
				),
			limit: z
				.number()
				.optional()
				.describe("Max records to return (default 100)"),
			offset: z.number().optional().describe("Pagination offset"),
		},
		async ({ query, limit, offset }) => {
			try {
				return ok(await client.suiteQL(query, { limit, offset }));
			} catch (e) {
				return err(e);
			}
		},
	);
}
