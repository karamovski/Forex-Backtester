import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

async function buildElectron() {
  console.log("Building Electron main process...");
  
  if (!fs.existsSync("electron-build")) {
    fs.mkdirSync("electron-build", { recursive: true });
  }
  
  await esbuild.build({
    entryPoints: ["electron/main.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    outfile: "electron-build/main.cjs",
    external: ["electron"],
    format: "cjs",
  });
  
  console.log("Building Electron preload...");
  
  await esbuild.build({
    entryPoints: ["electron/preload.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    outfile: "electron-build/preload.cjs",
    external: ["electron"],
    format: "cjs",
  });
  
  console.log("Electron build complete!");
}

buildElectron().catch((err) => {
  console.error("Electron build failed:", err);
  process.exit(1);
});
