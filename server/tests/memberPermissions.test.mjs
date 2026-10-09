import test from "node:test";
import assert from "node:assert/strict";
import { canWriteBusiness } from "../src/lib/memberPermissions.ts";
test("viewers can read and export via GET, but cannot mutate", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) assert.equal(canWriteBusiness("VIEWER", method), true);
  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) assert.equal(canWriteBusiness("VIEWER", method), false);
  assert.equal(canWriteBusiness("UNKNOWN", "POST"), false);
});
test("legacy editors and owners retain their write access", () => {
  assert.equal(canWriteBusiness("MEMBER", "POST"), true);
  assert.equal(canWriteBusiness("OWNER", "DELETE"), true);
});
