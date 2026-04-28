import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const flavor = process.argv[2] ?? "full";
if (flavor !== "full" && flavor !== "lite") {
  throw new Error(`Invalid flavor: ${flavor}. Use "full" or "lite".`);
}

const bundleSource = join(process.cwd(), "src-tauri/target/release/bundle");
const desktopDist = join(process.cwd(), "../../dist/desktop", flavor);

if (!existsSync(bundleSource)) {
  throw new Error(`Bundle source not found: ${bundleSource}`);
}

if (existsSync(desktopDist)) {
  rmSync(desktopDist, { recursive: true, force: true });
}
mkdirSync(desktopDist, { recursive: true });

for (const entry of readdirSync(bundleSource, { withFileTypes: true })) {
  const source = join(bundleSource, entry.name);
  const destination = join(desktopDist, entry.name);

  if (existsSync(destination)) {
    rmSync(destination, { recursive: true, force: true });
  }
  cpSync(source, destination, { recursive: true });
}
