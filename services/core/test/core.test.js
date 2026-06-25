import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";

describe("core service", () => {
  it("liveness ok", async () => {
    const res = await request(app).get("/healthz/live");
    expect(res.status).toBe(200);
  });

  it("pages exige un token", async () => {
    const res = await request(app).get("/pages");
    expect(res.status).toBe(401);
  });

  it("upload exige un token", async () => {
    const res = await request(app).post("/upload");
    expect(res.status).toBe(401);
  });

  it("file PUT exige un token", async () => {
    const res = await request(app).put("/file/test.md").send({ content: "x" });
    expect(res.status).toBe(401);
  });
});
