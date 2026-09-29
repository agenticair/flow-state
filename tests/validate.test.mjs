import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateAll, validateSkillDir } from "../tools/validate.mjs";
import { parseFrontmatter } from "../tools/lib.mjs";

test("the repository validates", () => {
  assert.deepEqual(validateAll(), []);
});

test("a skill with a non-spec frontmatter key is rejected", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-skill-"));
  const skill = path.join(dir, "bad-skill");
  fs.mkdirSync(skill);
  fs.writeFileSync(path.join(skill, "SKILL.md"), "---\nname: bad-skill\ndescription: x\ndisable-model-invocation: true\n---\nbody\n");
  const problems = validateSkillDir(skill);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /disable-model-invocation/);
});

test("a skill whose name differs from its directory is rejected", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-skill-"));
  const skill = path.join(dir, "one-name");
  fs.mkdirSync(skill);
  fs.writeFileSync(path.join(skill, "SKILL.md"), "---\nname: other-name\ndescription: x\n---\nbody\n");
  assert.ok(validateSkillDir(skill).some((p) => /must equal the directory name/.test(p)));
});

test("frontmatter parser handles nested metadata and quoted values", () => {
  const { data, body } = parseFrontmatter('---\nname: a\ndescription: "b: c"\nmetadata:\n  version: "1.2.3"\n  stage: hub\n---\nhello\n');
  assert.equal(data.name, "a");
  assert.equal(data.description, "b: c");
  assert.deepEqual(data.metadata, { version: "1.2.3", stage: "hub" });
  assert.equal(body, "hello\n");
});
