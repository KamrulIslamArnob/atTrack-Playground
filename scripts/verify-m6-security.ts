import { validatePublicUrl, assertPublicHttpUrl } from "../lib/security/ssrf";
import { ensureVirtualTables, getDb, closeDb } from "../lib/db/sqlite";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function testSsrf() {
  console.log("\n--- Testing SSRF Validation (lib/security/ssrf.ts) ---");

  // 1. Valid public URLs
  const validUrls = [
    "https://example.com",
    "http://example.com/careers/software-engineer",
    "https://github.com/kamrulislamarnob",
    "https://api.firecrawl.dev/v1/scrape",
    "https://8.8.8.8/dns-query",
    "https://1.1.1.1",
  ];
  for (const url of validUrls) {
    const res = validatePublicUrl(url);
    assert(res.valid === true, `Public URL allowed: ${url}`);
  }

  // 2. Non-HTTP/HTTPS protocols
  const badProtocols = [
    "file:///etc/passwd",
    "file:///C:/Windows/win.ini",
    "gopher://127.0.0.1:70/",
    "javascript:alert(1)",
    "data:text/html,<h1>Test</h1>",
    "ftp://ftp.example.com/file",
    "ws://localhost:3000",
  ];
  for (const url of badProtocols) {
    const res = validatePublicUrl(url);
    assert(res.valid === false, `Bad protocol rejected: ${url}`);
  }

  // 3. Decimal, hex, octal IP notations
  const encodedIps = [
    "http://2130706433/", // 127.0.0.1 in dword
    "http://167772161/", // 10.0.0.1 in dword
    "http://0x7f000001/", // 127.0.0.1 in hex
    "http://0x7f.0.0.1/", // 127.0.0.1 in dotted hex
    "http://0x0a.0.0.1/", // 10.0.0.1 in dotted hex
    "http://0177.0.0.1/", // 127.0.0.1 in dotted octal
    "http://012.0.0.1/", // 10.0.0.1 in dotted octal
    "http://0300.0250.0.1/", // 192.168.0.1 in dotted octal
    "http://127.1/", // 127.0.0.1 in 2-part notation
  ];
  for (const url of encodedIps) {
    const res = validatePublicUrl(url);
    assert(res.valid === false, `Encoded/non-standard IP notation rejected: ${url}`);
  }

  // 4. IPv6 loopback, link-local, unique local, mapped IPv4
  const ipv6Targets = [
    "http://[::1]/",
    "http://[::1]:8080/test",
    "http://[fe80::1]/",
    "http://[fc00::1]/",
    "http://[fd00::1234]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:10.0.0.1]/",
    "http://[::ffff:192.168.1.1]/",
    "http://[::ffff:169.254.169.254]/",
    "http://[::127.0.0.1]/",
  ];
  for (const url of ipv6Targets) {
    const res = validatePublicUrl(url);
    assert(res.valid === false, `IPv6 private/loopback/mapped rejected: ${url}`);
  }

  // 5. RFC1918 private IPv4 ranges & link-local
  const privateIps = [
    "http://127.0.0.1/",
    "http://127.0.0.2:8000/",
    "http://10.0.0.1/",
    "http://10.254.254.254/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.0.1/",
    "http://192.168.1.100/",
    "http://169.254.169.254/",
    "http://169.254.1.1/",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
  ];
  for (const url of privateIps) {
    const res = validatePublicUrl(url);
    assert(res.valid === false, `Private/Loopback IPv4 rejected: ${url}`);
  }

  // 6. Cloud metadata endpoints
  const metadataTargets = [
    "http://169.254.169.254/latest/meta-data/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://metadata.goog/",
    "http://instance-data/latest/meta-data/",
    "http://100.100.100.200/latest/meta-data/",
  ];
  for (const url of metadataTargets) {
    const res = validatePublicUrl(url);
    assert(res.valid === false, `Cloud metadata endpoint rejected: ${url}`);
  }

  // 7. Known DNS rebinding wildcards
  const dnsRebinding = [
    "http://127.0.0.1.nip.io/",
    "http://192.168.1.1.sslip.io/",
    "http://test.traefik.me/",
    "http://app.localtest.me/",
    "http://test.lvh.me/",
    "http://test.vcap.me/",
    "http://myservice.local/",
    "http://internal-service.internal/",
  ];
  for (const url of dnsRebinding) {
    const res = validatePublicUrl(url);
    assert(res.valid === false, `DNS rebinding wildcard rejected: ${url}`);
  }

  // 8. assertPublicHttpUrl throw verification
  let threw = false;
  try {
    assertPublicHttpUrl("http://127.0.0.1:3788/api/hack");
  } catch {
    threw = true;
  }
  assert(threw === true, "assertPublicHttpUrl throws on private address");
}

async function testVirtualTableCaching() {
  console.log("\n--- Testing Virtual Table Caching (lib/db/sqlite.ts) ---");

  const db = getDb();
  assert(Boolean(db), "Database handle opened");

  const firstCall = ensureVirtualTables(db);
  assert(firstCall === true, "First ensureVirtualTables call succeeded");
  assert(globalThis.__virtualTablesEnsured === true, "__virtualTablesEnsured flag set");

  const secondCall = ensureVirtualTables(db);
  assert(secondCall === true, "Second ensureVirtualTables returned from cache");

  closeDb();
  assert(globalThis.__virtualTablesEnsured === undefined, "closeDb cleanly resets __virtualTablesEnsured flag");
}

async function run() {
  try {
    await testSsrf();
    await testVirtualTableCaching();
    console.log("\n🎉 All M6 Security and Virtual Table Tests Passed!\n");
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  }
}

run();
