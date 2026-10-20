const assert = require("node:assert/strict");

process.env.APP_STORAGE_DRIVER = "supabase";
process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";

let schemaProbes = 0;
global.fetch = async (input) => {
  const url = new URL(input);
  assert.equal(url.host, "supabase.test", "the test must never contact a real project");
  if (url.pathname === "/rest/v1/meo_app_meta" && url.searchParams.get("select") === "key") {
    schemaProbes += 1;
    if (schemaProbes === 1) return new Response("temporary failure", { status: 503 });
  }
  return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
};

const { readDb } = require("./index");

(async () => {
  await assert.rejects(readDb(), /Run supabase\/migrations/);
  await Promise.all([readDb(), readDb()]);
  await readDb();
  assert.equal(schemaProbes, 2, "a successful schema probe is shared and a failed probe can retry");
  console.log("storage-cache: warm Supabase schema check is reused; failures retry");
})().catch((error) => { console.error(error); process.exitCode = 1; });
