import assert from "node:assert/strict";
import test from "node:test";
import { createShutdownHandler } from "../dist/shutdown.js";

test("shutdown drains HTTP before disconnecting Prisma and exits once", async () => {
  const events = [];
  const shutdown = createShutdownHandler({
    closeHttp: async () => { events.push("http"); },
    disconnectDatabase: async () => { events.push("database"); },
    exit: (code) => { events.push(`exit:${code}`); },
    timeoutMs: 100,
  });

  await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);

  assert.deepEqual(events, ["http", "database", "exit:0"]);
});

test("database disconnect failure exits with failure after HTTP closes", async () => {
  const events = [];
  const shutdown = createShutdownHandler({
    closeHttp: async () => { events.push("http"); },
    disconnectDatabase: async () => { events.push("database"); throw new Error("private driver details"); },
    exit: (code) => { events.push(`exit:${code}`); },
    onFailure: (phase) => { events.push(`failure:${phase}`); },
    timeoutMs: 100,
  });

  await shutdown("SIGTERM");

  assert.deepEqual(events, ["http", "database", "failure:database", "exit:1"]);
  assert.ok(!events.includes("private driver details"));
});

test("HTTP close failure still disconnects Prisma and exits with failure", async () => {
  const events = [];
  const shutdown = createShutdownHandler({
    closeHttp: async () => { events.push("http"); throw new Error("private socket details"); },
    disconnectDatabase: async () => { events.push("database"); },
    exit: (code) => { events.push(`exit:${code}`); },
    onFailure: (phase) => { events.push(`failure:${phase}`); },
    timeoutMs: 100,
  });

  await shutdown("SIGTERM");

  assert.deepEqual(events, ["http", "failure:http", "database", "exit:1"]);
});

test("shutdown timeout exits once even if the close callback later completes", async () => {
  const events = [];
  let finishHttp;
  const shutdown = createShutdownHandler({
    closeHttp: () => new Promise((resolve) => { finishHttp = resolve; }),
    disconnectDatabase: async () => { events.push("database"); },
    exit: (code) => { events.push(`exit:${code}`); },
    onFailure: (phase) => { events.push(`failure:${phase}`); },
    timeoutMs: 10,
  });

  const completion = shutdown("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(events, ["failure:timeout", "exit:1"]);
  finishHttp();
  await completion;
  assert.deepEqual(events, ["failure:timeout", "exit:1", "database"]);
});
