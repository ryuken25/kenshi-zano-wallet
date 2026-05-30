/**
 * JSON-RPC client for Zano daemon (zanod) and wallet (simplewallet) (§1.1, §2.4, §4).
 *
 * Hardening:
 *  - METHOD ALLOWLIST: only the methods we actually use can be sent. Anything else
 *    throws before a request is made (defends against injected/templated calls).
 *  - TIMEOUT per attempt via AbortController.
 *  - RETRY with exponential backoff across a FALLBACK node list; the first node to
 *    answer wins. On total failure we surface a typed error, never crash (§4).
 *  - No secrets are ever placed in URLs or logs.
 */

/** Methods the wallet is permitted to call. Extend deliberately. */
export const ALLOWED_METHODS = new Set<string>([
  // daemon (zanod)
  "getinfo",
  "get_info",
  "getheight",
  // wallet (simplewallet)
  "getbalance",
  "get_balance",
  "getaddress",
  "get_recent_txs_and_info",
  "get_recent_txs_and_info2",
  "transfer",
  "get_wallet_info",
  "get_assets_list",
]);

export class RpcError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

export interface RpcOptions {
  /** Ordered endpoints; tried in sequence on timeout/failure (§2.4 fallback). */
  endpoints: string[];
  /** Per-attempt timeout in ms. */
  timeoutMs?: number;
  /** Total attempts per endpoint. */
  retries?: number;
  /** Optional bearer/JWT for authenticated nodes (kept in memory only). */
  authToken?: string;
  /** Injectable fetch for testing. */
  fetchImpl?: typeof fetch;
}

interface JsonRpcResponse<T> {
  jsonrpc?: string;
  id?: string | number;
  result?: T;
  error?: { code: number; message: string };
}

function backoff(attempt: number): number {
  return Math.min(16000, 2000 * 2 ** attempt); // 2s, 4s, 8s, 16s ...
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Call a JSON-RPC method. Validates against the allowlist, then walks the endpoint
 * list, retrying each with backoff until one answers or all are exhausted.
 */
export async function rpcCall<T = unknown>(
  method: string,
  params: unknown,
  opts: RpcOptions,
): Promise<T> {
  if (!ALLOWED_METHODS.has(method)) {
    throw new RpcError(`Method "${method}" is not on the RPC allowlist.`);
  }
  if (!opts.endpoints || opts.endpoints.length === 0) {
    throw new RpcError("No RPC endpoints configured.");
  }
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? 12000;
  const retries = opts.retries ?? 3;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.authToken) headers["Authorization"] = `Bearer ${opts.authToken}`;
  const body = JSON.stringify({ jsonrpc: "2.0", id: 0, method, params: params ?? {} });

  let lastErr: unknown = new RpcError("All RPC endpoints failed.");

  for (const endpoint of opts.endpoints) {
    for (let attempt = 0; attempt < retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl(endpoint, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          lastErr = new RpcError(`HTTP ${res.status} from ${endpoint}`);
          continue;
        }
        const json = (await res.json()) as JsonRpcResponse<T>;
        if (json.error) {
          // A protocol-level error is authoritative — don't retry other nodes.
          throw new RpcError(json.error.message, json.error.code);
        }
        return json.result as T;
      } catch (e) {
        clearTimeout(timer);
        if (e instanceof RpcError && e.code !== undefined) throw e; // protocol error
        lastErr = e;
        if (attempt < retries - 1) await sleep(backoff(attempt));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new RpcError(String(lastErr));
}
