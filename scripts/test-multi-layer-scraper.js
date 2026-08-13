const http = require("http");

async function runBenchmarkTests() {
  console.log("=================================================");
  console.log("🚀 BENCHMARK: Multi-Layer Universal Scraper Engine");
  console.log("=================================================");

  const port = process.env.PORT || 3308;
  const baseUrl = `http://127.0.0.1:${port}`;

  // 1. Health & Server Status Check
  console.log(`\n[Test 1] GET ${baseUrl}/api/extension/status...`);
  const statusRes = await makeRequest(`${baseUrl}/api/extension/status`, "GET");
  console.log("Status Code:", statusRes.statusCode);
  console.log("Server Info:", statusRes.data);

  if (statusRes.statusCode !== 200 || statusRes.data.status !== "ok") {
    throw new Error("Extension Status API Failed!");
  }
  console.log("✅ [Layer 1 & Server API]: PASSED!");

  // 2. Layer 2 AI Parse Endpoint Check
  console.log(`\n[Test 2] POST ${baseUrl}/api/extension/parse-job-ai...`);
  const mockPageText = `
    Acme AI Labs is hiring a Senior Full-Stack Engineer in San Francisco, CA.
    Salary: $170,000 - $210,000 / year + equity.
    Employment: Full-time | Work Mode: Hybrid
    Requirements:
    - 5+ years of experience with React, Next.js, TypeScript, and Node.js
    - Experience building Chrome Extensions and SQLite backends
    - Excellent system architecture skills
    Contact Sarah Jenkins (Principal Recruiter) at s.jenkins@acme.ai
  `;

  const layer1Mock = {
    title: "Senior Full-Stack Engineer",
    company: "Acme AI Labs",
    location: "San Francisco, CA",
    extraction_method: "JSON-LD Schema",
  };

  const aiParseRes = await makeRequest(`${baseUrl}/api/extension/parse-job-ai`, "POST", {
    url: "https://acme.ai/careers/senior-fullstack-engineer",
    pageText: mockPageText,
    layer1Data: layer1Mock,
  });

  console.log("AI Parse Status Code:", aiParseRes.statusCode);
  console.log("AI Parse Response:", JSON.stringify(aiParseRes.data, null, 2));

  if (aiParseRes.statusCode !== 200) {
    throw new Error(`Layer 2 AI Parse API failed! ${aiParseRes.data.error || ""}`);
  }
  console.log("✅ [Layer 2 AI Parser]: PASSED!");

  // 3. Layer 3 Hybrid Merged Output Save Check
  console.log(`\n[Test 3] POST ${baseUrl}/api/extension/add-job (Saving Layer 3 Merged Profile)...`);
  const mergedPayload = {
    title: "Senior Full-Stack Engineer (AI Synthesized)",
    company: "Acme AI Labs",
    location: "San Francisco, CA",
    salary_range: "$170,000 - $210,000",
    work_location: "Hybrid",
    employment_type: "Full-time",
    application_url: "https://acme.ai/careers/senior-fullstack-engineer",
    description: mockPageText.trim(),
    skills: ["React", "Next.js", "TypeScript", "Node.js", "Chrome Extensions", "SQLite"],
    source: "Chrome Extension (Layer 3 Hybrid)",
    contact_name: "Sarah Jenkins",
    contact_email: "s.jenkins@acme.ai",
    contact_role: "Principal Recruiter",
  };

  const addJobRes = await makeRequest(`${baseUrl}/api/extension/add-job`, "POST", mergedPayload);
  console.log("Add Job Status Code:", addJobRes.statusCode);
  console.log("Add Job Response:", addJobRes.data);

  if (addJobRes.statusCode !== 200 || !addJobRes.data.success) {
    throw new Error(`Layer 3 Save Job failed! ${addJobRes.data.error || ""}`);
  }
  console.log("✅ [Layer 3 Hybrid Database Save]: PASSED! Job ID:", addJobRes.data.jobId);

  console.log("\n=================================================");
  console.log("🎉 ALL MULTI-LAYER SCRAPER BENCHMARK TESTS PASSED!");
  console.log("=================================================");
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

runBenchmarkTests().catch((err) => {
  console.error("❌ Benchmark test run failed:", err);
  process.exit(1);
});
