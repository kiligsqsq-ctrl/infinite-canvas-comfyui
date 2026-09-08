#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const versionPath = resolve(rootDir, "VERSION");
const gitPath = resolve(rootDir, ".git");
const packageFiles = ["desktop", "web", "canvas-agent"].map((directory) => ({
  directory,
  packagePath: resolve(rootDir, directory, "package.json"),
  lockPath: resolve(rootDir, directory, "package-lock.json"),
}));
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.([0-5])$/;
const tagPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.([0-5])$/;

function parseVersion(value, label = "version") {
  const match = versionPattern.exec(value);
  if (!match || value === "0.0.0") {
    throw new Error(`${label} must follow 0.0.1 ... 0.0.5, 0.1.0 ... 0.1.5, 0.2.0 ...`);
  }
  return match.slice(1).map(Number);
}

function normalizeExpected(value) {
  if (value.startsWith("v")) {
    if (!tagPattern.test(value)) {
      throw new Error(`tag must exactly match v<major>.<minor>.<patch>, with patch from 0 to 5: ${value}`);
    }
    return value.slice(1);
  }
  parseVersion(value, "expected version");
  return value;
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

function getNextVersion(value) {
  const [major, minor, patch] = parseVersion(value);
  return patch === 5 ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}

function validateTagSequence(tag) {
  if (!existsSync(gitPath)) {
    return;
  }

  let tags;
  try {
    tags = execFileSync("git", ["tag", "--list"], { cwd: rootDir, encoding: "utf8" });
  } catch (error) {
    throw new Error(`unable to read Git tags: ${error instanceof Error ? error.message : error}`);
  }

  const version = tag.slice(1);
  const previousTags = tags
    .split(/\r?\n/)
    .filter((item) => tagPattern.test(item) && item !== tag)
    .map((item) => item.slice(1))
    .sort(compareVersions);
  const previous = previousTags.at(-1);

  if (!previous) {
    if (version !== "0.0.1") {
      throw new Error(`the first release tag must be v0.0.1, not ${tag}`);
    }
    return;
  }

  const expected = getNextVersion(previous);
  if (version !== expected) {
    throw new Error(`the only valid release after v${previous} is v${expected}, not ${tag}`);
  }
}

async function readJson(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} is missing: ${path}`);
  }
  const text = await readFile(path, "utf8");
  return { data: JSON.parse(text), text };
}

async function readRootVersion() {
  const version = (await readFile(versionPath, "utf8")).trim();
  parseVersion(version, "VERSION");
  return version;
}

async function readState() {
  const version = await readRootVersion();
  const packages = [];

  for (const entry of packageFiles) {
    const packageJson = await readJson(entry.packagePath, `${entry.directory}/package.json`);
    if (packageJson.data.version !== version) {
      throw new Error(`${entry.directory}/package.json version ${packageJson.data.version} does not match VERSION ${version}`);
    }

    const packageLock = await readJson(entry.lockPath, `${entry.directory}/package-lock.json`);
    const lockVersion = packageLock.data.version;
    const rootPackageVersion = packageLock.data.packages?.[""]?.version;
    if (lockVersion !== version || rootPackageVersion !== version) {
      throw new Error(
        `${entry.directory}/package-lock.json versions ${lockVersion}/${rootPackageVersion} do not match VERSION ${version}`,
      );
    }

    packages.push({ ...entry, packageJson, packageLock });
  }

  return { version, packages };
}

async function writeJson(path, data, originalText) {
  const newline = originalText.includes("\r\n") ? "\r\n" : "\n";
  const indent = /^([ \t]+)"/m.exec(originalText)?.[1] ?? "  ";
  await writeFile(path, `${JSON.stringify(data, null, indent).replaceAll("\n", newline)}${newline}`, "utf8");
}

async function check(expected) {
  const { version } = await readState();
  if (expected) {
    const normalized = normalizeExpected(expected);
    if (expected.startsWith("v")) {
      validateTagSequence(expected);
    }
    if (normalized !== version) {
      throw new Error(`release ${expected} does not match VERSION ${version}`);
    }
  }
  console.log(`Version ${version} is consistent across VERSION, desktop, web, and canvas-agent.`);
}

async function bump(requested) {
  const state = await readState();
  const next = getNextVersion(state.version);
  if (requested && normalizeExpected(requested) !== next) {
    throw new Error(`the only valid version after ${state.version} is ${next}`);
  }

  for (const entry of state.packages) {
    entry.packageJson.data.version = next;
    entry.packageLock.data.version = next;
    entry.packageLock.data.packages[""].version = next;
  }

  await writeFile(versionPath, `${next}\n`, "utf8");
  for (const entry of state.packages) {
    await writeJson(entry.packagePath, entry.packageJson.data, entry.packageJson.text);
    await writeJson(entry.lockPath, entry.packageLock.data, entry.packageLock.text);
  }
  console.log(`Bumped ${state.version} -> ${next} across VERSION, desktop, web, and canvas-agent.`);
}

const [command = "check", value, ...extra] = process.argv.slice(2);

try {
  if (extra.length > 0) {
    throw new Error("too many arguments");
  }
  if (command === "check") {
    await check(value);
  } else if (command === "next") {
    console.log(getNextVersion(value ? normalizeExpected(value) : await readRootVersion()));
  } else if (command === "bump") {
    await bump(value);
  } else {
    throw new Error("usage: node scripts/version.mjs check [vVERSION] | next [VERSION] | bump [VERSION]");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
