import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
  readFileSync(new URL("../../public/manifest.json", import.meta.url), "utf8")
);
const background = readFileSync(
  new URL("../scripts/background.ts", import.meta.url),
  "utf8"
);

describe("Chrome Web Store minimum permissions", () => {
  it("keeps activeTab for screenshots but drops redundant tabs permission", () => {
    expect(manifest.permissions).not.toContain("tabs");
    expect(manifest.permissions).toContain("activeTab");
  });

  it("limits host access to http and https", () => {
    expect(manifest.host_permissions).toEqual(["http://*/*", "https://*/*"]);
    for (const script of manifest.content_scripts) {
      expect(script.matches).toEqual(["http://*/*", "https://*/*"]);
    }
  });

  it("limits webRequest listeners to http and https", () => {
    expect(background).not.toContain('{ urls: ["<all_urls>"] }');
    expect(background).toContain('const HTTP_URLS = ["http://*/*", "https://*/*"]');
  });
});
