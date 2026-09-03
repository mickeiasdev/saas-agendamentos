const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { GoogleAuth } = require("google-auth-library");
const sa = require("./firebase-adminsdk.json");

async function main() {
  console.log("sa.project_id", sa.project_id);
  console.log("sa.client_email", sa.client_email);
  console.log("sa.private_key_id", sa.private_key_id);
  console.log("private_key_len", (sa.private_key || "").length);
  console.log("private_key_starts", (sa.private_key || "").slice(0, 30));
  console.log("private_key_has_begin", (sa.private_key || "").includes("BEGIN PRIVATE KEY"));

  const app = getApps().length ? getApps()[0] : initializeApp({
    credential: cert(sa),
    projectId: sa.project_id,
  });
  console.log("admin.app", app.name, app.options.projectId);

  try {
    const token = await app.options.credential.getAccessToken();
    console.log("admin.token", token ? "ok" : "empty", token && token.access_token ? token.access_token.slice(0, 12) : "");
  } catch (err) {
    console.log("admin.token.error", err && err.message);
  }

  try {
    const auth = new GoogleAuth({
      credentials: sa,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const t = await client.getAccessToken();
    console.log("google.token", t.token ? "ok" : "empty");
  } catch (err) {
    console.log("google.token.error", err && err.message);
  }

  try {
    const db = getFirestore(app);
    const snap = await db.collection("tenants").limit(1).get();
    console.log("firestore.tenants.size", snap.size);
  } catch (err) {
    console.log("firestore.error", err && err.message);
  }

  try {
    const users = await getAuth(app).listUsers(1);
    console.log("auth.users", users.users.length);
  } catch (err) {
    console.log("auth.error", err && err.message);
  }

  const web = await fetch(
    "https://identitytoolkit.googleapis.com/v1/projects?key=AIzaSyDb7uRlZTpEkNFJckic06BLVwlClPiA07Q"
  );
  console.log("web.projects", web.status, (await web.text()).slice(0, 300));

  const cfg = await fetch(
    "https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=AIzaSyDb7uRlZTpEkNFJckic06BLVwlClPiA07Q"
  );
  console.log("web.config", cfg.status, (await cfg.text()).slice(0, 500));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
