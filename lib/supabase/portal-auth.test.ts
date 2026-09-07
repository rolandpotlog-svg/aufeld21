import assert from "node:assert/strict";
import test from "node:test";
import { AuthError, createClient, type Session } from "@supabase/supabase-js";
import { initializePortalAuth } from "./portal-auth.ts";

const session = { user: { id: "test-member" } } as Session;
const base = "https://www.aufeld21.at/portal";
const legacy = `${base}?setup=password#access_token=test-access&refresh_token=test-refresh&token_type=bearer&type=recovery`;

function stub() {
  const calls: Array<{ method: string; args?: unknown }> = [];
  const auth = {
    async getSession() { calls.push({ method: "getSession" }); return { data: { session }, error: null }; },
    async setSession(args: unknown) { calls.push({ method: "setSession", args }); return { data: { session, user: session.user }, error: null }; },
    async exchangeCodeForSession(code: string, options?: unknown) { calls.push({ method: "exchangeCodeForSession", args: { code, options } }); return { data: { session, user: session.user, redirectType: "recovery" }, error: null }; },
  } as Parameters<typeof initializePortalAuth>[0];
  return { auth, calls };
}

test("admin recovery token pair is validated and opens password setup", async () => {
  const { auth, calls } = stub();
  let cleaned = "";
  const result = await initializePortalAuth(auth, legacy, (url) => { cleaned = url; });
  assert.deepEqual(result, { session, passwordSetup: true, error: null });
  assert.deepEqual(calls, [{ method: "setSession", args: { access_token: "test-access", refresh_token: "test-refresh" } }]);
  assert.equal(cleaned, "/portal?setup=password");
});

test("browser PKCE recovery exchanges its code exactly once with its flow id", async () => {
  const { auth, calls } = stub();
  let cleaned = "";
  const href = `${base}?setup=password&code=test-code&sb_flow_id=test-flow`;
  const first = initializePortalAuth(auth, href, (url) => { cleaned = url; });
  const second = initializePortalAuth(auth, `${base}?setup=password`, () => assert.fail("duplicate URL mutation"));
  assert.equal(first, second);
  assert.equal((await first).passwordSetup, true);
  assert.deepEqual(calls, [{ method: "exchangeCodeForSession", args: { code: "test-code", options: { flowId: "test-flow" } } }]);
  assert.equal(cleaned, "/portal?setup=password");
  await initializePortalAuth(auth, base, () => {});
  assert.equal(calls.at(-1)?.method, "getSession", "later mounts must read the current session, not cached credentials");
});

test("invites open password setup; normal magic links do not", async () => {
  for (const [type, expected] of [["invite", true], ["magiclink", false]] as const) {
    const { auth } = stub();
    const result = await initializePortalAuth(auth, `${base}#access_token=test-access&refresh_token=test-refresh&token_type=bearer&type=${type}`, () => {});
    assert.equal(result.passwordSetup, expected);
  }
});

test("expired, incomplete or mixed callbacks never grant a session or reuse a signed-in account", async () => {
  for (const suffix of [
    "?setup=password#error=access_denied&error_code=otp_expired&error_description=private-detail",
    "?setup=password#access_token=only-one-token",
    "?setup=password&code=test-code#access_token=test-access&refresh_token=test-refresh",
    "?setup=password#access_token=test-access&refresh_token=test-refresh&token_type=invalid",
    "?setup=password&code=",
  ]) {
    const { auth, calls } = stub();
    let cleaned = "";
    const result = await initializePortalAuth(auth, base + suffix, (url) => { cleaned = url; });
    assert.equal(result.session, null);
    assert.equal(result.passwordSetup, false);
    assert.ok(result.error);
    assert.doesNotMatch(result.error!, /private-detail|test-access|only-one-token/);
    assert.deepEqual(calls, []);
    assert.equal(cleaned, "/portal?setup=password");
  }
});

test("missing PKCE verifier gives actionable feedback, never bypasses PKCE with an existing session", async () => {
  const { auth, calls } = stub();
  auth.exchangeCodeForSession = async () => ({ data: { session: null, user: null }, error: new AuthError("verifier unavailable") });
  const result = await initializePortalAuth(auth, `${base}?setup=password&code=test-code`, () => {});
  assert.equal(result.session, null);
  assert.match(result.error!, /selben Browser/);
  assert.deepEqual(calls, []);
});

test("ordinary login restores the current session and preserves non-auth anchors", async () => {
  const { auth, calls } = stub();
  assert.deepEqual(await initializePortalAuth(auth, `${base}#calendar`, () => assert.fail("ordinary URL changed")), { session, passwordSetup: false, error: null });
  assert.deepEqual(calls, [{ method: "getSession" }]);
});

test("setup query without a session does not display a password field", async () => {
  const { auth } = stub();
  auth.getSession = async () => ({ data: { session: null }, error: null });
  const result = await initializePortalAuth(auth, `${base}?setup=password`, () => {});
  assert.equal(result.passwordSetup, false);
  assert.ok(result.error);
});

test("real PKCE SDK accepts legacy callbacks only after the Auth server validates the token", async () => {
  const token = [
    { alg: "HS256", typ: "JWT" },
    { sub: "test-member", exp: Math.floor(Date.now() / 1000) + 3600 },
  ].map((part) => Buffer.from(JSON.stringify(part)).toString("base64url")).join(".") + ".test-signature";

  for (const authorized of [true, false]) {
    let requests = 0;
    const client = createClient("https://auth.example.test", "test-public-key", {
      auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input) => {
        requests++;
        assert.equal(String(input), "https://auth.example.test/auth/v1/user");
        return new Response(JSON.stringify(authorized
          ? { id: "test-member", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" }
          : { message: "Invalid JWT", code: "bad_jwt" }), { status: authorized ? 200 : 401, headers: { "Content-Type": "application/json" } });
      } },
    });
    const result = await initializePortalAuth(client.auth, `${base}?setup=password#access_token=${token}&refresh_token=test-refresh&token_type=bearer&type=recovery`, () => {});
    assert.equal(requests, 1);
    assert.equal(Boolean(result.session), authorized);
    assert.equal(result.passwordSetup, authorized);
    if (!authorized) assert.ok(result.error);
  }
});
