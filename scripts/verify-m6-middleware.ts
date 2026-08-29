import { NextRequest } from "next/server";
import { proxy } from "../proxy";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function testMiddleware() {
  console.log("\n--- Testing Root Proxy (proxy.ts) ---");

  // 1. Static assets bypass
  const staticReq = new NextRequest("http://localhost:3788/_next/static/chunks/main.js");
  const staticRes = proxy(staticReq);
  assert(staticRes.status === 200, "Static asset request allowed (status 200)");

  // 2. Loopback Host headers allowed
  const validHosts = [
    "localhost:3788",
    "127.0.0.1:3788",
    "127.0.0.1",
    "localhost",
    "[::1]:3788",
    "[::1]",
  ];
  for (const host of validHosts) {
    const req = new NextRequest("http://localhost:3788/api/jobs", {
      headers: { host },
    });
    const res = proxy(req);
    assert(res.status === 200, `Valid loopback Host allowed: ${host}`);
  }

  // 3. External / LAN Host headers blocked with 403 Forbidden
  const blockedHosts = [
    "evil.com",
    "192.168.1.100:3788",
    "10.0.0.5:3788",
    "172.16.0.2:3788",
    "attacker.local:3788",
  ];
  for (const host of blockedHosts) {
    const req = new NextRequest("http://localhost:3788/api/jobs", {
      headers: { host },
    });
    const res = proxy(req);
    assert(res.status === 403, `External Host blocked with 403: ${host}`);
  }

  // 4. State-changing requests (POST, PUT, DELETE, PATCH) with valid origins
  const validOrigins = [
    "http://localhost:3788",
    "http://127.0.0.1:3788",
    "http://[::1]:3788",
    "chrome-extension://abcdefghijklmnop",
    "moz-extension://12345678-1234-1234-1234-123456789abc",
    "edge-extension://abcdefghijklmnop",
    "safari-web-extension://abcdefghijklmnop",
  ];
  for (const origin of validOrigins) {
    const req = new NextRequest("http://localhost:3788/api/extension/add-job", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3788",
        origin,
      },
    });
    const res = proxy(req);
    assert(res.status === 200, `Valid Origin allowed on POST: ${origin}`);
  }

  // 5. State-changing requests with invalid / malicious origins blocked with 403 Forbidden
  const invalidOrigins = [
    "http://evil.com",
    "https://malicious-site.org",
    "http://192.168.1.5:3788",
    "null",
  ];
  for (const origin of invalidOrigins) {
    const req = new NextRequest("http://localhost:3788/api/extension/add-job", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3788",
        origin,
      },
    });
    const res = proxy(req);
    assert(res.status === 403, `Malicious Origin blocked on POST: ${origin}`);
  }

  console.log("\n🎉 All Middleware Tests Passed!\n");
}

testMiddleware().catch((err) => {
  console.error("Middleware test failed:", err);
  process.exit(1);
});
