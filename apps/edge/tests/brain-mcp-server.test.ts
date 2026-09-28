import { afterEach, describe, expect, it, vi } from "vitest";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createBrainMcpServer } from "../src/bridge/brain-mcp-server.js";
import type { BrainRequest, BrainResponse, ReachRequest } from "@nexus-brain/contracts";
import type { BrainApi } from "@nexus-brain/brain/brain-api";

async function connected(api: Parameters<typeof createBrainMcpServer>[0]) {
  const server = createBrainMcpServer(api);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "brain-mcp-contract-test", version: "1.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

describe("Nexus Brain MCP boundary", () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(async () => { await close?.(); close = undefined; });

  it("exposes one bounded Brain tool and one bounded Reach tool, never Hindsight", async () => {
    const handle = vi.fn(async (request: BrainRequest, _context?: Record<string, unknown>): Promise<BrainResponse> => ({ request_id: request.request_id, project_id: request.project_id, task_id: request.task_id, agent_id: request.agent_id, status: "EMPTY", source: "canonical-memory", provenance: {}, coverage: "MISSING", trust_level: "UNVERIFIED", data: { items: [] } }));
    const handleReach = vi.fn(async (request: ReachRequest): Promise<BrainResponse> => ({ request_id: `reach:${request.capability}:${request.task_id}`, project_id: request.project_id, task_id: request.task_id, agent_id: request.agent_id, status: "EMPTY", source: request.capability, provenance: {}, coverage: "MISSING", trust_level: "UNTRUSTED", data: { evidence_ids: [] } }));
    const api: BrainApi = { handle, handleReach };
    const session = await connected(api);
    close = async () => { await session.client.close(); await session.server.close(); };

    const { tools } = await session.client.listTools();
    expect(tools.map(tool => tool.name)).toEqual(["nexus_brain", "nexus_reach"]);
    expect(tools.some(tool => /hindsight/i.test(tool.name))).toBe(false);

    const result = await session.client.callTool({ name: "nexus_brain", arguments: { request_id: "request-1", project_id: "project-a", task_id: "task-a", agent_id: "agent-a", operation: "brain_search", input: { query: "synthetic", data_classification: "SYNTHETIC" } } });
    expect(result.isError).not.toBe(true);
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle.mock.calls[0]?.[1]).toMatchObject({ source: "mcp" });
    expect(JSON.parse(String(result.content[0]?.type === "text" ? result.content[0].text : "{}")).status).toBe("EMPTY");
  });

  it("rejects malformed or oversized tool input before reaching the API", async () => {
    const api: BrainApi = { handle: vi.fn(async () => { throw new Error("unexpected_api_call"); }), handleReach: vi.fn(async () => { throw new Error("unexpected_api_call"); }) };
    const session = await connected(api);
    close = async () => { await session.client.close(); await session.server.close(); };

    const extraField = await session.client.callTool({ name: "nexus_brain", arguments: { request_id: "r", project_id: "p", task_id: "t", agent_id: "a", operation: "brain_search", input: {}, write_file: true } });
    const oversizedQuery = await session.client.callTool({ name: "nexus_brain", arguments: { request_id: "r", project_id: "p", task_id: "t", agent_id: "a", operation: "local_search", input: { query: "x".repeat(4_001) } } });
    const arbitraryReach = await session.client.callTool({ name: "nexus_reach", arguments: { project_id: "p", task_id: "t", agent_id: "a", capability: "admin", input: {}, policy: {} } });

    expect(extraField.isError).toBe(true);
    expect(oversizedQuery.isError).toBe(true);
    expect(arbitraryReach.isError).toBe(true);
    expect(api.handle).not.toHaveBeenCalled();
    expect(api.handleReach).not.toHaveBeenCalled();
  });

  it("keeps research/web responses typed and passes MCP call context to authorization", async () => {
    let seenContext: unknown;
    const handleReach = vi.fn(async (request: ReachRequest, context?: Record<string, unknown>): Promise<BrainResponse> => {
        seenContext = context;
        return { request_id: `reach:${request.capability}:${request.task_id}`, project_id: request.project_id, task_id: request.task_id, agent_id: request.agent_id, status: "PARTIAL", source: request.capability, provenance: { capability: request.capability }, coverage: "PARTIAL", trust_level: "UNTRUSTED", data: { evidence_ids: ["e-1"], warnings: ["partial"] } };
    });
    const api: BrainApi = { handle: vi.fn(async () => { throw new Error("unexpected_api_call"); }), handleReach };
    const session = await connected(api);
    close = async () => { await session.client.close(); await session.server.close(); };
    const result = await session.client.callTool({ name: "nexus_reach", arguments: { project_id: "project-a", task_id: "task-a", agent_id: "agent-a", capability: "research", input: { query: "synthetic" }, policy: {} } });
    expect(result.isError).not.toBe(true);
    expect(handleReach).toHaveBeenCalledTimes(1);
    expect(seenContext).toMatchObject({ source: "mcp" });
    expect(JSON.parse(String(result.content[0]?.type === "text" ? result.content[0].text : "{}")).trust_level).toBe("UNTRUSTED");
  });
});
