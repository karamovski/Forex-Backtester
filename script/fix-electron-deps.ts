import * as fs from "fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));

const electronVersion = "^39.2.7";
const electronBuilderVersion = "^26.0.12";

if (packageJson.dependencies?.electron) {
  delete packageJson.dependencies.electron;
}
if (packageJson.dependencies?.["electron-builder"]) {
  delete packageJson.dependencies["electron-builder"];
}

if (!packageJson.devDependencies) {
  packageJson.devDependencies = {};
}

packageJson.devDependencies.electron = electronVersion;
packageJson.devDependencies["electron-builder"] = electronBuilderVersion;

fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2) + "\n");

console.log("Fixed package.json - electron/electron-builder moved to devDependencies");
