const assert = require("node:assert/strict");
const test = require("node:test");

const { assertLocalTarget, isPrivateIp } = require("../local-network.cjs");

test("accepts loopback and RFC1918 addresses", () => {
    for (const ip of ["127.0.0.1", "10.2.3.4", "172.16.0.1", "172.31.255.254", "192.168.1.20", "::1", "fd12::1"]) {
        assert.equal(isPrivateIp(ip), true, ip);
    }
});

test("rejects public and out-of-range addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.1.1", "172.32.1.1", "2001:4860:4860::8888"]) {
        assert.equal(isPrivateIp(ip), false, ip);
    }
});

test("resolves hostnames only when every result is local", async () => {
    const local = await assertLocalTarget("http://comfy-box:8188/system_stats", async () => [{ address: "192.168.1.9" }]);
    assert.equal(local.port, "8188");
    await assert.rejects(
        () => assertLocalTarget("https://example.test", async () => [{ address: "192.168.1.9" }, { address: "8.8.8.8" }]),
        /本机或局域网/,
    );
});

test("rejects credentials and unsupported protocols", async () => {
    await assert.rejects(() => assertLocalTarget("http://user:pass@127.0.0.1:8188"), /账号密码/);
    await assert.rejects(() => assertLocalTarget("file:///C:/Windows/win.ini"), /HTTP\/HTTPS/);
});
