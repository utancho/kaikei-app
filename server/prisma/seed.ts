// D1はCloudflare Workersランタイム内でしか直接アクセスできないため、
// このシードスクリプトは `npm run dev` で起動したローカルWorkerのHTTP API経由でデータを投入する。
// 使い方: 別ターミナルで `npm run dev` を起動してから `npm run prisma:seed` を実行してください。

const API_BASE = process.env.SEED_API_BASE ?? "http://localhost:4000";
const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "password123";

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const cookie = res.headers.get("set-cookie");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${options.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  return { data: res.status === 204 ? null : await res.json(), cookie };
}

async function main() {
  console.log(`Seeding via ${API_BASE} ...`);

  let cookie: string | null = null;
  try {
    const signupRes = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD, name: "山田 太郎" }),
    });
    cookie = signupRes.cookie;
    console.log(`Created demo user: ${DEMO_EMAIL}`);
  } catch (e) {
    console.log("Demo user already exists, logging in instead.");
    const loginRes = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    });
    cookie = loginRes.cookie;
  }

  console.log(
    "NOTE: このユーザーはまだサブスクリプションが未設定です。ローカルD1で直接ACTIVEに更新してください:\n" +
      "  npx wrangler d1 execute kaikei-db --local --command \\\n" +
      `    "UPDATE Subscription SET status='ACTIVE' WHERE userId IN (SELECT id FROM User WHERE email='${DEMO_EMAIL}')"`
  );

  console.log(`\nDemo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
