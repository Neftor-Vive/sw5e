import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const staticRoot = path.join(repoRoot, "static");
const iconRoot = path.join(staticRoot, "packs", "Icons");
const contentRoots = [path.join(repoRoot, "packs"), path.join(staticRoot, "json")];
const overrides = JSON.parse(fs.readFileSync(path.join(scriptDir, "content-alias-overrides.json"), "utf8"));
const checkOnly = process.argv.includes("--check");

function walkFiles(root, visitor) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) walkFiles(absolutePath, visitor);
    else if (entry.isFile()) visitor(absolutePath);
  }
}

function collectRefs(value, refs, sourceFile) {
  if (typeof value === "string") {
    if (value.startsWith("systems/sw5e/")) {
      if (!refs.has(value)) refs.set(value, new Set());
      refs.get(value).add(sourceFile);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectRefs(entry, refs, sourceFile);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const entry of Object.values(value)) collectRefs(entry, refs, sourceFile);
}

function normalizeRef(ref) {
  const withoutPrefix = ref.replace(/^systems\/sw5e\//, "");
  const withoutQuery = withoutPrefix.split("?")[0].replace(/\\+$/, "");
  return decodeURIComponent(withoutQuery);
}

function normalizeStem(filename) {
  return path.basename(filename, path.extname(filename)).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildIconIndex() {
  const byDirLower = new Map();
  const byDirStem = new Map();
  const byGlobalStem = new Map();

  walkFiles(iconRoot, (absolutePath) => {
    const dirRelative = path.relative(staticRoot, path.dirname(absolutePath)).split(path.sep).join("/");
    const lowerName = path.basename(absolutePath).toLowerCase();
    const stem = normalizeStem(path.basename(absolutePath));

    if (!byDirLower.has(dirRelative)) byDirLower.set(dirRelative, new Map());
    if (!byDirStem.has(dirRelative)) byDirStem.set(dirRelative, new Map());
    if (!byGlobalStem.has(stem)) byGlobalStem.set(stem, []);

    const lowerBucket = byDirLower.get(dirRelative);
    const stemBucket = byDirStem.get(dirRelative);
    if (!lowerBucket.has(lowerName)) lowerBucket.set(lowerName, []);
    if (!stemBucket.has(stem)) stemBucket.set(stem, []);

    lowerBucket.get(lowerName).push(absolutePath);
    stemBucket.get(stem).push(absolutePath);
    byGlobalStem.get(stem).push(absolutePath);
  });

  return { byDirLower, byDirStem, byGlobalStem };
}

function getScopeDirs(relativePath) {
  const segments = relativePath.split("/");
  const scopes = [];
  if (segments[0] !== "packs" || segments[1] !== "Icons") return scopes;
  if (segments[2] === "monsters" && segments.length > 4) {
    scopes.push(["packs", "Icons", "monsters", segments[3]].join("/"));
  } else if (segments.length > 3) {
    scopes.push(["packs", "Icons", segments[2]].join("/"));
  }
  return scopes;
}

function uniqueMatch(matches) {
  return matches?.length === 1 ? matches[0] : null;
}

function resolveAliasSource(relativePath, iconIndex) {
  const overridePath = overrides[relativePath];
  if (overridePath) {
    const absoluteOverridePath = path.join(staticRoot, overridePath);
    if (!fs.existsSync(absoluteOverridePath)) {
      throw new Error(`Alias override target does not exist: ${overridePath}`);
    }
    return absoluteOverridePath;
  }

  const directoryRelative = path.dirname(relativePath).split(path.sep).join("/");
  const lowerName = path.basename(relativePath).toLowerCase();
  const stem = normalizeStem(path.basename(relativePath));

  const exactSameDir = uniqueMatch(iconIndex.byDirLower.get(directoryRelative)?.get(lowerName));
  if (exactSameDir) return exactSameDir;

  const normalizedSameDir = uniqueMatch(iconIndex.byDirStem.get(directoryRelative)?.get(stem));
  if (normalizedSameDir) return normalizedSameDir;

  for (const scopeDir of getScopeDirs(relativePath)) {
    const exactScoped = uniqueMatch(iconIndex.byDirLower.get(scopeDir)?.get(lowerName));
    if (exactScoped) return exactScoped;

    const normalizedScoped = uniqueMatch(iconIndex.byDirStem.get(scopeDir)?.get(stem));
    if (normalizedScoped) return normalizedScoped;
  }

  return uniqueMatch(iconIndex.byGlobalStem.get(stem));
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function syncContentAliases() {
  const refs = new Map();
  for (const contentRoot of contentRoots) {
    walkFiles(contentRoot, (absolutePath) => {
      if (!absolutePath.endsWith(".json")) return;
      const relativeSource = path.relative(repoRoot, absolutePath).split(path.sep).join("/");
      const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
      collectRefs(parsed, refs, relativeSource);
    });
  }

  const iconIndex = buildIconIndex();
  const created = [];
  const unresolved = [];
  const wildcardRefs = [];
  const existing = [];

  for (const [ref, sources] of refs) {
    const relativePath = normalizeRef(ref);
    if (relativePath.includes("*")) {
      wildcardRefs.push({ ref, sources: [...sources] });
      continue;
    }

    const absoluteTarget = path.join(staticRoot, relativePath);
    if (fs.existsSync(absoluteTarget)) {
      existing.push(relativePath);
      continue;
    }

    const absoluteSource = resolveAliasSource(relativePath, iconIndex);
    if (!absoluteSource) {
      unresolved.push({ ref, relativePath, sources: [...sources].slice(0, 5) });
      continue;
    }

    if (!checkOnly) {
      ensureParentDirectory(absoluteTarget);
      fs.copyFileSync(absoluteSource, absoluteTarget);
    }

    created.push({
      target: relativePath,
      source: path.relative(staticRoot, absoluteSource).split(path.sep).join("/")
    });
  }

  const summary = {
    mode: checkOnly ? "check" : "sync",
    refs: refs.size,
    existing: existing.length,
    created: created.length,
    wildcardRefs: wildcardRefs.length,
    unresolved: unresolved.length
  };

  console.log(JSON.stringify({ summary, created, unresolved, wildcardRefs: wildcardRefs.slice(0, 20) }, null, 2));

  if (unresolved.length) process.exitCode = 1;
}

syncContentAliases();
