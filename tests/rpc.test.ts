import { describe, it, expect, vi } from "vitest";
import { rpcCall, RpcError, ALLOWED_METHODS } from "../src/core/rpc";
import { normalizeAssets } from "../src/core/wallet";
import { ZANO_ASSET_ID } from "../src/core/constants";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("rpc allowlist + fallback (§4, §2.4)", () => {
  it("rejects methods not on the allowlist before any request", async () => {
    const fetchImpl = vi.fn();
    await expect(
      rpcCall("evil_method", {}, { endpoints: ["http://x"], fetchImpl }),
    ).rejects.toThrow(RpcError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns result on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ result: { height: 42 } }));
    const r = await rpcCall<{ height: number }>("getheight", {}, {
      endpoints: ["http://node1"],
      fetchImpl,
    });
    expect(r.height).toBe(42);
  });

  it("falls back to the next endpoint when the first fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(jsonResponse({ result: { synchronized: true } }));
    const r = await rpcCall<{ synchronized: boolean }>("getinfo", {}, {
      endpoints: ["http://dead", "http://alive"],
      retries: 1,
      fetchImpl,
    });
    expect(r.synchronized).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("surfaces protocol errors without crashing", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { code: -1, message: "bad params" } }));
    await expect(
      rpcCall("getbalance", {}, { endpoints: ["http://n"], fetchImpl }),
    ).rejects.toThrow("bad params");
  });

  it("transfer is on the allowlist", () => {
    expect(ALLOWED_METHODS.has("transfer")).toBe(true);
  });
});

describe("asset normalization pins Zano at top (§2.1)", () => {
  it("pins native even when wallet holds zero", () => {
    const assets = normalizeAssets({ balances: [] });
    expect(assets[0].assetId).toBe(ZANO_ASSET_ID);
    expect(assets[0].ticker).toBe("ZANO");
    expect(assets[0].balance).toBe(0n);
  });

  it("honors each asset's own decimal_point and keeps Zano first", () => {
    const assets = normalizeAssets({
      balances: [
        {
          asset_info: { asset_id: "ca6", full_name: "Foo", ticker: "FOO", decimal_point: 6 },
          total: "1500000",
          unlocked: "1500000",
        },
        {
          asset_info: { asset_id: ZANO_ASSET_ID, full_name: "Zano", ticker: "ZANO", decimal_point: 12 },
          total: "5000000000000",
          unlocked: "5000000000000",
        },
      ],
    });
    expect(assets[0].assetId).toBe(ZANO_ASSET_ID);
    const foo = assets.find((a) => a.assetId === "ca6")!;
    expect(foo.decimalPoint).toBe(6);
    expect(foo.balance).toBe(1_500_000n);
  });
});
