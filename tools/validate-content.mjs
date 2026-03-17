import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const staticRoot = path.join(repoRoot, "static");
const distRoot = path.join(repoRoot, "dist");
const packsRoot = path.join(repoRoot, "packs");
const staticJsonRoot = path.join(staticRoot, "json");
const systemManifestPath = path.join(staticRoot, "system.json");
const languageRoot = path.join(staticRoot, "lang");

function walkFiles(root, visitor) {
  if (!fs.existsSync(root)) return;
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

function wildcardToRegex(filenamePattern) {
  const escaped = filenamePattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
}

function validateManifestPacks(systemManifest, errors) {
  const seenNames = new Set();
  const packSummaries = [];

  for (const pack of systemManifest.packs ?? []) {
    if (seenNames.has(pack.name)) {
      errors.push(`Duplicate manifest pack name: ${pack.name}`);
      continue;
    }
    seenNames.add(pack.name);

    const sourceDir = path.join(packsRoot, pack.name);
    const builtPath = path.join(distRoot, pack.path);
    if (!fs.existsSync(sourceDir)) errors.push(`Missing source pack directory: ${path.relative(repoRoot, sourceDir)}`);
    if (!fs.existsSync(builtPath)) errors.push(`Missing built pack database: ${path.relative(repoRoot, builtPath)}`);

    packSummaries.push({
      name: pack.name,
      sourceDir: path.relative(repoRoot, sourceDir),
      builtPath: path.relative(repoRoot, builtPath)
    });
  }

  return packSummaries;
}

function validateLanguages(errors) {
  const languageFiles = [];
  for (const filename of fs.readdirSync(languageRoot).filter((entry) => entry.endsWith(".json")).sort()) {
    const absolutePath = path.join(languageRoot, filename);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    } catch (error) {
      errors.push(`Invalid language JSON: ${path.relative(repoRoot, absolutePath)} (${error.message})`);
      continue;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.push(`Language file must contain an object: ${path.relative(repoRoot, absolutePath)}`);
      continue;
    }

    languageFiles.push({
      file: path.relative(repoRoot, absolutePath),
      keys: Object.keys(parsed).length
    });
  }

  if (!languageFiles.find((entry) => entry.file.endsWith("/en.json"))) {
    errors.push("Missing required English localization file: static/lang/en.json");
  }

  return languageFiles;
}

function validateAssetRefs(errors) {
  const refs = new Map();
  for (const root of [packsRoot, staticJsonRoot]) {
    walkFiles(root, (absolutePath) => {
      if (!absolutePath.endsWith(".json")) return;
      const relativeSource = path.relative(repoRoot, absolutePath).split(path.sep).join("/");
      const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
      collectRefs(parsed, refs, relativeSource);
    });
  }

  const wildcardRefs = [];
  const missingRefs = [];
  for (const [ref, sources] of refs) {
    const relativePath = normalizeRef(ref);
    const sourceList = [...sources].slice(0, 5);

    if (relativePath.includes("*")) {
      const absoluteDir = path.join(distRoot, path.dirname(relativePath));
      const basenamePattern = path.basename(relativePath);
      const matcher = wildcardToRegex(basenamePattern);
      const matches = fs.existsSync(absoluteDir)
        ? fs.readdirSync(absoluteDir).filter((entry) => matcher.test(entry))
        : [];

      wildcardRefs.push({ ref, matches: matches.length, sources: sourceList });
      if (!matches.length) {
        errors.push(`Wildcard asset reference has no built matches: ${ref}`);
      }
      continue;
    }

    const absoluteTarget = path.join(distRoot, relativePath);
    if (!fs.existsSync(absoluteTarget)) {
      missingRefs.push({ ref, sources: sourceList });
      errors.push(`Missing built asset for content reference: ${ref}`);
    }
  }

  return {
    refs: refs.size,
    wildcardRefs,
    missingRefs
  };
}

function main() {
  const errors = [];
  const systemManifest = JSON.parse(fs.readFileSync(systemManifestPath, "utf8"));
  const manifestPacks = validateManifestPacks(systemManifest, errors);
  const languages = validateLanguages(errors);
  const assetRefs = validateAssetRefs(errors);

  const summary = {
    manifestVersion: systemManifest.version,
    compatibility: systemManifest.compatibility,
    packs: manifestPacks.length,
    languages: languages.length,
    assetRefs: assetRefs.refs,
    wildcardAssetRefs: assetRefs.wildcardRefs.length,
    missingAssetRefs: assetRefs.missingRefs.length,
    errors: errors.length
  };

  console.log(JSON.stringify({ summary, manifestPacks, languages, assetRefs }, null, 2));

  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  }
}

main();
