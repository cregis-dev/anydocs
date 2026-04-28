import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

if (process.platform !== "darwin") {
  console.log("create-desktop-dmg is macOS-only; skipping.");
  process.exit(0);
}

const packageRoot = process.cwd();
const repoRoot = path.resolve(packageRoot, "../..");
const bundleDir = path.resolve(packageRoot, "src-tauri/target/release/bundle/macos");
const flavor = process.argv[2] ?? "full";
if (flavor !== "full" && flavor !== "lite") {
  throw new Error(`Invalid flavor: ${flavor}. Use "full" or "lite".`);
}

const outDmgDir = path.resolve(repoRoot, "dist/desktop", flavor, "dmg");
const configPath = path.resolve(packageRoot, `src-tauri/tauri.${flavor}.conf.json`);

if (!existsSync(bundleDir)) {
  throw new Error(`No files found in ${bundleDir}. Run tauri build with --bundles app first.`);
}

const appCandidates = readdirSync(bundleDir)
  .filter((entry) => entry.endsWith(".app"))
  .map((entry) => path.resolve(bundleDir, entry));

if (appCandidates.length === 0) {
  throw new Error(`No .app bundle found under ${bundleDir}`);
}

const appPath =
  appCandidates.find((p) => path.basename(p) === "Anydocs.app") ??
  appCandidates.find((p) => /Anydocs(\sDesktop)?\.app$/i.test(path.basename(p))) ??
  appCandidates[0];
const appName = path.basename(appPath);
const appNameNoExt = path.basename(appName, ".app");

const tauriConf = JSON.parse(readFileSync(configPath, "utf-8"));
const version = tauriConf.version ?? "1.0.0";
const nodeArch = process.arch === "arm64" ? "aarch64" : process.arch === "x64" ? "x86_64" : process.arch;
const safeFlavor = flavor === "full" ? "full" : "lite";
const dmgName = `Anydocs-${safeFlavor}_${version}_${nodeArch}.dmg`;
const dmgPath = path.resolve(outDmgDir, dmgName);

const staging = path.join(tmpdir(), "anydocs-desktop-dmg-staging");
if (existsSync(staging)) {
  rmSync(staging, { recursive: true, force: true });
}
mkdirSync(staging, { recursive: true });

const stageAppPath = path.join(staging, appNameNoExt);
cpSync(appPath, stageAppPath, { recursive: true });
execFileSync("ln", ["-sfn", "/Applications", path.join(staging, "Applications")]);

mkdirSync(outDmgDir, { recursive: true });
execFileSync("hdiutil", [
  "create",
  "-volname",
  appNameNoExt,
  "-srcfolder",
  staging,
  "-ov",
  "-format",
  "UDZO",
  dmgPath,
]);

rmSync(staging, { recursive: true, force: true });

console.log(`Created DMG: ${dmgPath}`);
