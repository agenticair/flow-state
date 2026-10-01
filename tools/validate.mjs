#!/usr/bin/env node
// Validates the repository's user-facing contract:
//   - every skills/<dir>/SKILL.md: only the six Agent Skills fields, name == dir, name shape, description length, body length
//   - every role file parses and names its tools and model
//   - version is identical across plugin.json, .claude-plugin/plugin.json, marketplace.json, package.json
// Exit 1 with one line per problem.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, SKILL_FIELDS, SKILL_NAME_RE, parseFrontmatter, listSkillDirs, listRoleFiles, readRole, readJSON } from "./lib.mjs";

export function validateSkillDir(dir) {
  const problems = [];
  const rel = path.relative(ROOT, dir).split(path.sep).join("/");
  const file = path.join(dir, "SKILL.md");
  if (!fs.existsSync(file)) return [`${rel}: missing SKILL.md`];
  let parsed;
  try {
    parsed = parseFrontmatter(fs.readFileSync(file, "utf8"), `${rel}/SKILL.md`);
  } catch (e) {
    return [e.message];
  }
  const { data, body } = parsed;
  for (const key of Object.keys(data)) {
    if (!SKILL_FIELDS.includes(key)) problems.push(`${rel}/SKILL.md: frontmatter key "${key}" is not one of the six Agent Skills fields`);
  }
  const name = data.name;
  if (typeof name !== "string" || !SKILL_NAME_RE.test(name) || name.length > 64) problems.push(`${rel}/SKILL.md: name must be 1-64 chars of a-z, 0-9 and single hyphens`);
  if (name !== path.basename(dir)) problems.push(`${rel}/SKILL.md: name "${name}" must equal the directory name`);
  const desc = data.description;
  if (typeof desc !== "string" || desc.length < 1 || desc.length > 1024) problems.push(`${rel}/SKILL.md: description must be 1-1024 characters`);
  const lines = body.split("\n").length;
  if (lines > 500) problems.push(`${rel}/SKILL.md: body is ${lines} lines; keep under 500 and move detail to references/`);
  return problems;
}

export function validateVersions(root = ROOT) {
  const v = readJSON(path.join(root, "plugin.json")).version;
  const problems = [];
  if (!/^\d+\.\d+\.\d+$/.test(v)) problems.push(`plugin.json: version "${v}" is not SemVer`);
  const claude = readJSON(path.join(root, ".claude-plugin/plugin.json")).version;
  if (claude !== v) problems.push(`.claude-plugin/plugin.json: version ${claude} != plugin.json ${v}`);
  const market = readJSON(path.join(root, ".claude-plugin/marketplace.json"));
  for (const p of market.plugins || []) if (p.version !== v) problems.push(`.claude-plugin/marketplace.json: plugin ${p.name} version ${p.version} != ${v}`);
  const pkg = readJSON(path.join(root, "package.json")).version;
  if (pkg !== v) problems.push(`package.json: version ${pkg} != plugin.json ${v}`);
  return problems;
}

export function validateRoles(root = ROOT) {
  const problems = [];
  for (const f of listRoleFiles(root)) {
    try {
      const r = readRole(f);
      if (!SKILL_NAME_RE.test(r.name)) problems.push(`${r.source}: name "${r.name}" must be kebab-case`);
      if (r.name !== path.basename(f, ".md")) problems.push(`${r.source}: name must equal the file name`);
      if (r.readonly && r.tools.some((t) => ["Bash", "Write", "Edit"].includes(t) && t !== "Write"))
        problems.push(`${r.source}: readonly role must not list Bash or Edit`);
    } catch (e) {
      problems.push(e.message);
    }
  }
  return problems;
}

export function validateGroundRules(root = ROOT) {
  const problems = [];
  const gr = path.join(root, "skills", "flow-core", "ground-rules.md");
  if (!fs.existsSync(gr)) return ["skills/flow-core/ground-rules.md: missing"];
  const words = fs.readFileSync(gr, "utf8").split(/\s+/).filter(Boolean).length;
  if (words > 260) problems.push(`ground-rules.md: ${words} words; keep it under 260, it is paid on every run`);
  for (const d of listSkillDirs(root)) {
    const name = path.basename(d);
    if (name === "flow-core") continue;
    const text = fs.readFileSync(path.join(d, "SKILL.md"), "utf8");
    if (!text.includes("Ground rules: read `../flow-core/ground-rules.md` first")) problems.push(`skills/${name}/SKILL.md: missing the ground-rules loader line`);
  }
  const m = path.join(root, "skills", "flow-core", "MANIFEST.json");
  if (fs.existsSync(m)) {
    const mv = readJSON(m).version;
    const pv = readJSON(path.join(root, "plugin.json")).version;
    if (mv !== pv) problems.push(`skills/flow-core/MANIFEST.json: version ${mv} != plugin.json ${pv} (run npm run build)`);
  } else problems.push("skills/flow-core/MANIFEST.json: missing (run npm run build)");
  return problems;
}

export function validateAll(root = ROOT) {
  const problems = [];
  const dirs = listSkillDirs(root);
  if (!dirs.length) problems.push("skills/: no skills found");
  for (const d of dirs) problems.push(...validateSkillDir(d));
  problems.push(...validateGroundRules(root));
  problems.push(...validateRoles(root));
  problems.push(...validateVersions(root));
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = validateAll();
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(`valid: ${listSkillDirs().length} skills, ${listRoleFiles().length} roles, version ${readJSON(path.join(ROOT, "plugin.json")).version}`);
}
