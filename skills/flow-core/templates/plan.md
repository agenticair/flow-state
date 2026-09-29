# Plan: <nn> <Slice>

Story: <docs/specs/<date>-<slug>/stories/<nn>-<slice>.md>
Spec: <docs/specs/<date>-<slug>.md>
Base: <short sha the plan was written against>

<!-- Tasks are executed in order, one builder dispatch each. Files lists every path the task may touch, marked create or modify; the controls reject anything else. TDD names the test the builder writes first. Verification is shell predicates the program runs; exit code only. -->

## Task 1: <name in the imperative>

**Objective:** <what is true when this task is done>

**Files:**
- create: <path>
- modify: <path>

**TDD:** <exact test name the builder writes first>

**Verification:**
```sh
<command that exits 0 when the task holds>
```

## Task 2: <name>

**Objective:** <...>

**Files:**
- modify: <path>

**TDD:** <test name>

**Verification:**
```sh
<command>
```
