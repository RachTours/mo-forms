import assert from "node:assert/strict";
import test from "node:test";
import { testDatabaseEnvironment } from "./test-database-env.mjs";

test("uses a loopback placeholder only when no database configuration is present", () => {
  assert.equal(testDatabaseEnvironment({}).DATABASE_URL, "mysql://test:test@127.0.0.1:3306/reviewroom_test");
  assert.equal(testDatabaseEnvironment({ DATABASE_URL: "mysql://real-db/app" }).DATABASE_URL, "mysql://real-db/app");
  assert.equal(testDatabaseEnvironment({ DB_HOST: "db.example" }).DATABASE_URL, undefined);
});
