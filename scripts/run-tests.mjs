import { spawnSync } from "node:child_process";
import { testDatabaseEnvironment } from "./test-database-env.mjs";

const npmExecPath = process.env.npm_execpath;
if (!npmExecPath) throw new Error("Run the test runner through npm.");

const env = testDatabaseEnvironment(process.env);
const regression = spawnSync(process.execPath, ["--test", "scripts/test-database-env.test.mjs"], { stdio: "inherit", env });
if (regression.error) throw regression.error;
if (regression.status !== 0) process.exit(regression.status ?? 1);

const commands = [
  ["run", "db:generate"],
  ["run", "test", "--workspace", "@reviewroom/contracts"],
  ["run", "test", "--workspace", "@reviewroom/domain"],
  ["run", "test", "--workspace", "@reviewroom/api"],
  ["run", "test", "--workspace", "@reviewroom/web"],
];

for (const args of commands) {
  const result = spawnSync(process.execPath, [npmExecPath, ...args], { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
