const { readFileSync } = require("fs");
const { GoogleAuth } = require("google-auth-library");

const PROJECT = "experimento-saas-agendamento";
const KEY_FILE = "/workspace/firebase-adminsdk.json";

async function main() {
  const auth = new GoogleAuth({
    keyFile: KEY_FILE,
    scopes: [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/firebase",
      "https://www.googleapis.com/auth/datastore",
      "https://www.googleapis.com/auth/identitytoolkit",
    ],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("No access token");
  const headers = {
    Authorization: `Bearer ${token.token}`,
    "Content-Type": "application/json",
  };

  async function req(method, url, body) {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { ok: res.ok, status: res.status, json };
  }

  const db = await req(
    "GET",
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)`
  );
  console.log("firestore.database", db.status, db.json.name || db.json.error || db.json);

  const rules = readFileSync("/workspace/firestore.rules", "utf8");
  const created = await req(
    "POST",
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets`,
    {
      source: {
        files: [{ name: "firestore.rules", content: rules }],
      },
    }
  );
  console.log("rulesets.create", created.status, created.json.name || created.json.error || created.json);
  if (!created.ok) return process.exit(1);

  const rulesetName = created.json.name;
  const release = await req(
    "PATCH",
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/cloud.firestore?updateMask=rulesetName`,
    {
      name: `projects/${PROJECT}/releases/cloud.firestore`,
      rulesetName,
    }
  );
  if (!release.ok && release.status === 404) {
    const createdRelease = await req(
      "POST",
      `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases`,
      {
        name: `projects/${PROJECT}/releases/cloud.firestore`,
        rulesetName,
      }
    );
    console.log(
      "releases.create",
      createdRelease.status,
      createdRelease.json.name || createdRelease.json.error || createdRelease.json
    );
  } else {
    console.log("releases.patch", release.status, release.json.name || release.json.error || release.json);
  }

  const indexesFile = JSON.parse(readFileSync("/workspace/firestore.indexes.json", "utf8"));
  let createdCount = 0;
  let existingCount = 0;
  let failed = 0;
  for (const idx of indexesFile.indexes || []) {
    const collectionId = idx.collectionGroup;
    const body = {
      queryScope: idx.queryScope || "COLLECTION",
      fields: idx.fields,
    };
    const r = await req(
      "POST",
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/collectionGroups/${encodeURIComponent(collectionId)}/indexes`,
      body
    );
    if (r.ok) {
      createdCount += 1;
    } else if (r.status === 409 || (r.json.error && String(r.json.error.message || "").includes("already exists"))) {
      existingCount += 1;
    } else {
      failed += 1;
      console.log("index.fail", collectionId, r.status, r.json.error || r.json);
    }
  }
  console.log("indexes", { createdCount, existingCount, failed, total: (indexesFile.indexes || []).length });

  const signIn = await req(
    "GET",
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config`
  );
  console.log("identity.config", signIn.status, signIn.json.error || Object.keys(signIn.json));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
