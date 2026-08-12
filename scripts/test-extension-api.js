const http = require("http");

async function runTests() {
  console.log("=== Testing atTrack Extension API Endpoints ===");

  const port = process.env.PORT || 3308;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Test 1: GET /api/extension/status
  console.log(`\n1. Testing GET ${baseUrl}/api/extension/status...`);
  const statusRes = await makeRequest(`${baseUrl}/api/extension/status`, "GET");
  console.log("Status Code:", statusRes.statusCode);
  console.log("Response:", statusRes.data);

  if (statusRes.statusCode !== 200 || statusRes.data.status !== "ok") {
    throw new Error("Extension status API test failed!");
  }
  console.log("✅ Status API Test PASSED!");

  // Test 2: POST /api/extension/add-job
  console.log(`\n2. Testing POST ${baseUrl}/api/extension/add-job...`);
  const testJob = {
    title: "Senior Chrome Extension Engineer",
    company: "atTrack Testing Corp",
    location: "San Francisco, CA (Remote)",
    salary_range: "$150,000 - $180,000",
    employment_type: "Full-time",
    work_location: "Remote",
    application_url: "https://attrack.dev/careers/test-job-extension",
    source: "Chrome Extension Test",
    description: "Responsible for building state-of-the-art Manifest V3 extensions and seamless integrations.",
    skills: ["Chrome Extension", "Next.js", "TypeScript", "SQLite", "React"],
  };

  const addJobRes = await makeRequest(`${baseUrl}/api/extension/add-job`, "POST", testJob);
  console.log("Status Code:", addJobRes.statusCode);
  console.log("Response:", addJobRes.data);

  if (addJobRes.statusCode !== 200 || !addJobRes.data.success) {
    throw new Error(`Add Job API test failed! ${addJobRes.data.error || ""}`);
  }
  console.log("✅ Add Job API Test PASSED! Job ID:", addJobRes.data.jobId);

  console.log("\n🎉 ALL EXTENSION INTEGRATION API TESTS PASSED CLEANLY!");
}

function makeRequest(urlStr, method, payload = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = payload ? JSON.stringify(payload) : null;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        "Accept": "application/json",
        ...(postData
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(postData),
            }
          : {}),
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: json });
        } catch {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });

    req.on("error", (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

runTests().catch((err) => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
