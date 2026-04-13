/**
 * Trigger production deployment from connected GitHub repo.
 * VERCEL_TOKEN required. Optional VERCEL_TEAM_ID, VERCEL_PROJECT_NAME (default testivor).
 */
const token = process.env.VERCEL_TOKEN?.trim();
const teamId = process.env.VERCEL_TEAM_ID?.trim();
const project = process.env.VERCEL_PROJECT_NAME?.trim() || "testivor";
if (!token) {
  console.error("VERCEL_TOKEN required");
  process.exit(1);
}
const q = (extra) => {
  const p = new URLSearchParams(extra);
  if (teamId) p.set("teamId", teamId);
  const s = p.toString();
  return s ? `?${s}` : "";
};

const pr = await fetch(
  `https://api.vercel.com/v9/projects/${encodeURIComponent(project)}${q({})}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const pj = await pr.json();
if (!pr.ok) {
  console.error(JSON.stringify(pj, null, 2));
  process.exit(1);
}
const repoId = pj.link?.repoId;
const ref = pj.link?.productionBranch || "main";
if (!repoId) {
  console.error("Project has no GitHub link.repoId", JSON.stringify(pj.link, null, 2));
  process.exit(1);
}

const body = {
  name: project,
  project,
  target: "production",
  gitSource: {
    type: "github",
    repoId,
    ref,
  },
};
const res = await fetch(`https://api.vercel.com/v13/deployments${q({})}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});
const j = await res.json();
if (!res.ok) {
  console.error(res.status, JSON.stringify(j, null, 2));
  process.exit(1);
}
console.log("Deployment:", j.url ? `https://${j.url}` : j.id, j.readyState);
