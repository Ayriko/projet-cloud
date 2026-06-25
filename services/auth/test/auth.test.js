import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/index.js";

describe("auth service", () => {
  it("liveness ok", async () => {
    const res = await request(app).get("/healthz/live");
    expect(res.status).toBe(200);
  });

  it("register exige email+password", async () => {
    const res = await request(app).post("/register").send({});
    expect(res.status).toBe(400);
  });

  it("login exige email+password", async () => {
    const res = await request(app).post("/login").send({ email: "a@b.c" });
    expect(res.status).toBe(400);
  });

  it("verify refuse un token manquant", async () => {
    const res = await request(app).get("/verify");
    expect(res.status).toBe(401);
  });

  it("verify accepte un token valide", async () => {
    const token = jwt.sign({ sub: 1, email: "a@b.c" }, "test-secret", { expiresIn: "1h" });
    const res = await request(app).get("/verify").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("a@b.c");
  });
});
