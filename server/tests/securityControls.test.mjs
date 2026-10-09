import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesSecurityVersion } from "../src/lib/sessionSecurity.ts";
import { escapeCsvCell, parseCsv } from "../../client/src/lib/csvExport.ts";

test("legacy version-zero cookies survive only until security version changes", () => {
  const payload = { userId: "qa-user", exp: Math.floor(Date.now()/1000)+60 };
  assert.equal(matchesSecurityVersion(payload, 0), true);
  assert.equal(matchesSecurityVersion(payload, 1), false);
  assert.equal(matchesSecurityVersion({ ...payload, securityVersion: 1 }, 1), true);
  for (const bad of [-1, 1.5, "0", NaN]) assert.equal(matchesSecurityVersion({ ...payload, securityVersion: bad }, 0), false);
  assert.equal(matchesSecurityVersion({ ...payload, exp: 0 }, 0), false);
});

test("spreadsheet formula text is neutralized without changing numeric cells", () => {
  for (const text of ["=1+1", "+SUM(A1)", "-1+2", "@SUM(A1)", "\t=1+1", "\r\n=1+1", "  =1+1", "\u0000=1+1"]) {
    const cell = parseCsv(escapeCsvCell(text)+"\n")[0][0];
    assert.equal(cell, "'"+text);
  }
  assert.equal(escapeCsvCell(-100), "-100");
  assert.equal(escapeCsvCell(100), "100");
  assert.equal(escapeCsvCell("通常の摘要"), "通常の摘要");
  assert.equal(parseCsv(escapeCsvCell('a,"b"\nc')+"\n")[0][0], 'a,"b"\nc');
});
