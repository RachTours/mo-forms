import assert from "node:assert/strict";
import test from "node:test";
import { buildDatabaseUrl, readMysqlConnection, resolveMysqlSsl } from "../../dist/db/mysql-config.js";

test("reads the separate Hostinger MySQL settings", () => {
  assert.deepEqual(readMysqlConnection({
    DB_HOST: "127.0.0.1",
    DB_PORT: "3306",
    DB_NAME: "reviewroom",
    DB_USER: "reviewroom_app",
    DB_PASSWORD: "safe-password",
  }), {
    host: "127.0.0.1",
    port: 3306,
    database: "reviewroom",
    user: "reviewroom_app",
    password: "safe-password",
  });
});

test("keeps accepting the existing DATABASE_URL setting", () => {
  assert.deepEqual(readMysqlConnection({
    DATABASE_URL: "mysql://legacy%40user:pass%3Aword@db.example:3307/legacy_db",
  }), {
    host: "db.example",
    port: 3307,
    database: "legacy_db",
    user: "legacy@user",
    password: "pass:word",
  });
});

test("requires a complete set of DB_* fields when any are provided", () => {
  assert.throws(() => readMysqlConnection({ DB_HOST: "127.0.0.1", DB_NAME: "reviewroom" }), /DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD/);
});

test("creates a URL-encoded Prisma connection URL from DB_* values", () => {
  assert.equal(buildDatabaseUrl({
    DB_HOST: "127.0.0.1",
    DB_PORT: "3306",
    DB_NAME: "review room",
    DB_USER: "review@room",
    DB_PASSWORD: "p:a/s?s",
  }), "mysql://review%40room:p%3Aa%2Fs%3Fs@127.0.0.1:3306/review%20room");
});

test("does not require TLS for a production database on loopback", () => {
  assert.equal(resolveMysqlSsl(undefined, "production", "127.0.0.1"), false);
});

test("requires verified TLS for a remote production database by default", () => {
  assert.deepEqual(resolveMysqlSsl(undefined, "production", "db.example.com"), { rejectUnauthorized: true });
});

test("allows TLS to be explicitly enabled for a loopback database", () => {
  assert.deepEqual(resolveMysqlSsl(true, "production", "127.0.0.1"), { rejectUnauthorized: true });
});
