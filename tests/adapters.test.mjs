import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAll, diffAgainstDisk, render } from "../tools/build-adapters.mjs";

const role = {
  name: "flow-judge",
  description: "Judges a diff.",
  tools: ["Read", "Grep", "Glob", "Write"],
  model: "opus",
  readonly: true,
  body: 'Body with a "quote" and a backslash \\ here.\n',
  source: "skills/flow-core/roles/flow-judge.md",
};

test("committed adapters match the sources", () => {
  assert.deepEqual(diffAgainstDisk(generateAll()), []);
});

test("every role produces one file per tool", () => {
  const files = render(role);
  assert.deepEqual(Object.keys(files).sort(), [
    "adapters/codex/agents/flow-judge.toml",
    "adapters/copilot/agents/flow-judge.agent.md",
    "adapters/cursor/agents/flow-judge.md",
    "adapters/gemini/agents/flow-judge.md",
    "agents/flow-judge.md",
  ]);
});

test("Claude agent keeps the tool list and model verbatim", () => {
  const md = render(role)["agents/flow-judge.md"];
  assert.match(md, /^tools: Read, Grep, Glob, Write$/m);
  assert.match(md, /^model: opus$/m);
});

test("read-only roles become a read-only Codex sandbox and a Cursor readonly agent", () => {
  const files = render(role);
  assert.match(files["adapters/codex/agents/flow-judge.toml"], /^sandbox_mode = "read-only"$/m);
  assert.match(files["adapters/cursor/agents/flow-judge.md"], /^readonly: true$/m);
  const builder = render({ ...role, name: "flow-builder", readonly: false, tools: ["Read", "Write", "Edit", "Bash"] });
  assert.doesNotMatch(builder["adapters/codex/agents/flow-builder.toml"], /sandbox_mode/);
  assert.match(builder["adapters/cursor/agents/flow-builder.md"], /^readonly: false$/m);
});

test("Codex TOML escapes backslashes and keeps the body inside developer_instructions", () => {
  const toml = render(role)["adapters/codex/agents/flow-judge.toml"];
  assert.match(toml, /developer_instructions = """\nBody with a "quote" and a backslash \\\\ here\.\n"""/);
});

test("tool vocabularies are translated per tool", () => {
  const files = render(role);
  assert.match(files["adapters/gemini/agents/flow-judge.md"], /^tools: \[read_file, grep_search, glob, write_file\]$/m);
  assert.match(files["adapters/copilot/agents/flow-judge.agent.md"], /^tools: \["read", "search", "edit"\]$/m);
});
