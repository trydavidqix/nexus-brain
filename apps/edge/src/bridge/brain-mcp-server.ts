import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { BrainApi } from "@nexus-brain/brain/brain-api";

const identityField = z.string().min(1).max(256);
const inputRecord = z.record(z.string().max(128), z.unknown());

const brainRequestSchema = z.object({
  request_id: identityField,
  project_id: identityField,
  task_id: identityField,
  agent_id: identityField,
  session_id: identityField.optional(),
  trace_id: identityField.optional(),
  operation: z.enum(["brain_context", "brain_search", "brain_reuse", "brain_remember", "local_search", "brain_status"]),
  input: inputRecord,
}).strict().superRefine((value, context) => {
  if (Buffer.byteLength(JSON.stringify(value.input), "utf8") > 16_384) context.addIssue({ code: "custom", message: "input limit exceeded" });
  if (typeof value.input.query === "string" && value.input.query.length > 4_000) context.addIssue({ code: "custom", message: "query limit exceeded" });
  if (value.input.top_k !== undefined && (!Number.isInteger(value.input.top_k) || Number(value.input.top_k) < 1 || Number(value.input.top_k) > 20)) context.addIssue({ code: "custom", message: "top_k limit exceeded" });
  if (value.operation === "local_search" && value.input.mode === "edit_context") {
    if (!Array.isArray(value.input.paths) || value.input.paths.length < 1 || value.input.paths.length > 20) context.addIssue({ code: "custom", message: "path limit exceeded" });
    if (!Number.isInteger(value.input.max_bytes) || Number(value.input.max_bytes) < 1 || Number(value.input.max_bytes) > 65_536) context.addIssue({ code: "custom", message: "edit context byte limit exceeded" });
  }
});

const reachRequestSchema = z.object({
  project_id: identityField,
  task_id: identityField,
  agent_id: identityField,
  capability: z.enum(["research", "web.search"]),
  input: inputRecord,
  policy: inputRecord,
  constraints: z.array(z.string().min(1).max(256)).max(32).optional(),
}).strict().superRefine((value, context) => {
  if (Buffer.byteLength(JSON.stringify(value.input), "utf8") > 16_384 || Buffer.byteLength(JSON.stringify(value.policy), "utf8") > 8_192) context.addIssue({ code: "custom", message: "reach input limit exceeded" });
  if (typeof value.input.query === "string" && value.input.query.length > 4_000) context.addIssue({ code: "custom", message: "query limit exceeded" });
});

function safeResult(value: unknown): { content: [{ type: "text"; text: string }] } {
  let serialized: string;
  try { serialized = JSON.stringify(value); } catch { throw new Error("brain_response_invalid"); }
  if (Buffer.byteLength(serialized, "utf8") > 65_536) throw new Error("brain_response_limit_exceeded");
  return { content: [{ type: "text", text: serialized }] };
}

async function invoke(operation: () => Promise<unknown>) {
  try { return safeResult(await operation()); }
  catch { return { isError: true, content: [{ type: "text" as const, text: "brain_api_failed" }] }; }
}

export function createBrainMcpServer(api: BrainApi): McpServer {
  if (!api || typeof api.handle !== "function" || typeof api.handleReach !== "function") throw new Error("Nexus Brain MCP requires the canonical Brain API.");
  const server = new McpServer({ name: "nexus-brain", version: "0.1.0" });
  server.registerTool("nexus_brain", {
    description: "Authenticated, task-scoped context, memory, code-search and status operations through Nexus Brain policy. Hindsight is internal and never exposed as an authority.",
    inputSchema: brainRequestSchema,
  }, async (request, extra) => invoke(() => api.handle(request, { source: "mcp", extra })));
  server.registerTool("nexus_reach", {
    description: "Authenticated, bounded research and web capability facade. External evidence remains untrusted until Nexus validates it.",
    inputSchema: reachRequestSchema,
  }, async (request, extra) => invoke(() => api.handleReach(request, { source: "mcp", extra })));
  return server;
}
