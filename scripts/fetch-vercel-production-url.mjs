/**
 * Print canonical production URL (first alias) for a Vercel project.
 * Requires: VERCEL_TOKEN, optional VERCEL_PROJECT_NAME (default testivor).
 */
const token = process.env.VERCEL_TOKEN?.trim();
const name = process.env.VERCEL_PROJECT_NAME?.trim() || "testivor";
if (!token) {
  console.error("VERCEL_TOKEN required");
  process.exit(1);
}
const res = await fetch(
  `https://api.vercel.com/v9/projects/${encodeURIComponent(name)}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const j = await res.json();
if (!res.ok) {
  console.error(JSON.stringify(j, null, 2));
  process.exit(1);
}
const aliases = j.alias || [];
const first = aliases[0];
const host =
  typeof first === "string"
    ? first
    : first?.domain || j.name + ".vercel.app";
if (!host) {
  console.error("No alias", JSON.stringify(j, null, 2).slice(0, 2500));
  process.exit(1);
}
console.log(host.startsWith("http") ? host : `https://${host}`);
