const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const createDashboardRouter = require("../features/agenda-mysql/dashboard-routes");
const express = require("express");

describe("Dashboard Router Tests", () => {
  test("Módulo exporta função createDashboardRouter", () => {
    assert.equal(typeof createDashboardRouter, "function");
  });

  test("Router aceita authenticate e getPool", () => {
    const fakeAuthenticate = () => (req, res, next) => next();
    const fakeGetPool = () => ({});
    const router = createDashboardRouter({ authenticate: fakeAuthenticate, getPool: fakeGetPool });
    assert.ok(router);
  });
});
