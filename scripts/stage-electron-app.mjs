import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stageRoot = resolve(projectRoot, ".electron-app");
const releaseRoot = resolve(projectRoot, "release");
if (
  stageRoot !== join(projectRoot, ".electron-app") ||
  releaseRoot !== join(projectRoot, "release")
) {
  throw new Error("Unexpected Electron staging directory.");
}

const [rootPackage, electronPackage, electronRuntime] = await Promise.all([
  readFile(join(projectRoot, "package.json"), "utf8").then(JSON.parse),
  readFile(join(projectRoot, "electron", "package.json"), "utf8").then(
    JSON.parse,
  ),
  readFile(
    join(projectRoot, "node_modules", "electron", "package.json"),
    "utf8",
  ).then(JSON.parse),
]);
electronPackage.version = rootPackage.version;
electronPackage.author = rootPackage.author ?? "VOX";
electronPackage.build.electronVersion = electronRuntime.version;

await rm(stageRoot, { recursive: true, force: true });
await rm(releaseRoot, { recursive: true, force: true });
await mkdir(stageRoot, { recursive: true });
await mkdir(join(stageRoot, "runtime"), { recursive: true });
await Promise.all([
  cp(join(projectRoot, "out"), join(stageRoot, "out"), { recursive: true }),
  cp(join(projectRoot, "dist-electron"), join(stageRoot, "dist-electron"), {
    recursive: true,
  }),
  cp(
    join(projectRoot, "build", "vox.ico"),
    join(stageRoot, "runtime", "vox.ico"),
  ),
]);
await writeFile(
  join(stageRoot, "package.json"),
  `${JSON.stringify(electronPackage, null, 2)}\n`,
);
