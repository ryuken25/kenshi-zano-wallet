import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const SHOTS = "screenshots";
mkdirSync(SHOTS, { recursive: true });

// Two deterministic, structurally-valid Zano-style addresses (Z + base58, ~98 chars).
const ADDR_A =
  "ZxMain" + "a1b2c3d4e5f6g7h8j9k1m2n3p4q5r6s7t8u9v1w2x3y4z5A6B7C8D9E1F2G3H4J5K6L7M8N9P1Q2R3S4T5U6V7W8X";
const ADDR_B =
  "ZxSave" + "9z8y7x6w5v4u3t2s1r9q8p7n6m5k4j3h2g1f9e8d7c6b5a4Z3Y2X1W9V8U7T6S5R4Q3P2N1M9K8J7H6G5F4D3C2B";
const SEED_A =
  "tattoo sketch ozone vanish jealous bicycle yellow narrate plug victory humble omen rinse alpha";
const SEED_B =
  "river maple cobra silent tunnel orbit pencil garden violet ledger jungle anchor frost beacon";

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

// Stub the Zano wallet RPC so the UI shows a multi-asset balance with Zano pinned.
async function stubRpc(page: Page) {
  await page.route("**/json_rpc", async (route) => {
    const body = route.request().postDataJSON() as { method: string };
    const method = body?.method;
    let result: unknown = {};
    if (method === "getbalance" || method === "get_balance") {
      result = {
        balances: [
          {
            asset_info: {
              asset_id: "d6329b5b1f7c0805b5c345f4957554002a2f557845f64d7645dae0e051a6498a",
              full_name: "Zano",
              ticker: "ZANO",
              decimal_point: 12,
            },
            total: "125000000000000",
            unlocked: "125000000000000",
          },
          {
            asset_info: {
              asset_id: "aaaa000000000000000000000000000000000000000000000000000000000001",
              full_name: "Confidential Asset",
              ticker: "CA1",
              decimal_point: 6,
            },
            total: "42000000",
            unlocked: "42000000",
          },
        ],
      };
    } else if (method === "getinfo" || method === "get_info") {
      result = { synchronized: true, height: 100 };
    } else if (method === "transfer") {
      result = { tx_hash: "deadbeefcafe0001" };
    }
    await route.fulfill({ json: { jsonrpc: "2.0", id: 0, result } });
  });
}

test("Kenshi wallet walkthrough", async ({ page }) => {
  await stubRpc(page);
  await page.goto("/");

  // 1. First-run unlock (create password) — also proves auto-lock-on-reload starts locked.
  await expect(page.getByTestId("unlock-btn")).toBeVisible();
  await shot(page, "01-unlock");
  await page.getByTestId("password-input").fill("correct horse battery");
  await page.getByTestId("unlock-btn").click();

  // 2. Import account A.
  await page.getByTestId("tab-accounts").click();
  await page.getByTestId("import-address").fill(ADDR_A);
  await page.getByTestId("import-seed").fill(SEED_A);
  await page.getByTestId("import-btn").click();
  await expect(page.getByText("Akun ditambahkan.")).toBeVisible();
  // Import account B for switch + multi-send + merge.
  await page.getByTestId("import-address").fill(ADDR_B);
  await page.getByTestId("import-seed").fill(SEED_B);
  await page.getByTestId("import-btn").click();
  await shot(page, "02-accounts-import");

  // 3. Switch account.
  await page.getByTestId("switch-Akun 1").click();
  await shot(page, "03-switch-account");

  // 4. Multi-asset list with Zano pinned at top.
  await page.getByTestId("tab-assets").click();
  await page.getByTestId("refresh").click();
  await expect(page.getByTestId("asset-list").locator(".asset-row").first()).toContainText("ZANO");
  await shot(page, "04-assets-zano-pinned");

  // 5. Receive — single address + QR.
  await page.getByTestId("tab-receive").click();
  await expect(page.getByTestId("receive-qr")).toBeVisible();
  await expect(page.getByTestId("receive-address")).toContainText("ZxMain");
  await shot(page, "05-receive-single-address-qr");

  // 6. Single send + transparent tip (default checked).
  await page.getByTestId("tab-send").click();
  await expect(page.getByTestId("tip-checkbox")).toBeChecked();
  await page.getByTestId("send-to").fill(ADDR_B);
  await page.getByTestId("send-amount").fill("100");
  await shot(page, "06-single-send-tip");

  // 7. Multi-send with "From wallet" + visible dev-tip line.
  await page.getByTestId("tab-multisend").click();
  await expect(page.getByTestId("from-wallet")).toBeVisible();
  await expect(page.getByTestId("ms-tip-checkbox")).toBeChecked();
  await page.getByTestId("ms-row-0").locator("input.mono").fill(ADDR_B);
  await page.getByTestId("ms-row-0").locator("input").nth(1).fill("5");
  await page.getByTestId("add-row").click();
  await shot(page, "07-multisend-from-wallet-tip");

  // 8. Merge ALL assets (Zano + Confidential Assets) to one account — not a swap.
  await page.getByTestId("tab-merge").click();
  await page.getByTestId("merge-all-checkbox").check(); // consolidate every token
  // Select a source (the non-target account).
  const srcCheckbox = page.locator('[data-testid^="merge-src-"]').first();
  await srcCheckbox.check();
  await page.getByTestId("merge-preview-btn").click();
  await expect(page.getByTestId("merge-preview")).toBeVisible();
  await shot(page, "08-merge-preview-breakdown");

  // 9. Settings / node config + connection status (daemon handling).
  await page.getByTestId("tab-settings").click();
  await expect(page.getByTestId("nodes-input")).toBeVisible();
  await shot(page, "09-settings-nodes-status");

  // 10. Lock, then confirm full reload stays locked (§1.8a).
  await page.getByTestId("lock-btn").click();
  await expect(page.getByTestId("unlock-btn")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("unlock-btn")).toBeVisible();
  await shot(page, "10-locked-after-reload");
});
