const cfg = (typeof window !== "undefined" && window.APP_CONFIG) || {};
export const AUTH_URL = cfg.AUTH_URL || "http://localhost:8080";
export const CORE_URL = cfg.CORE_URL || "http://localhost:8081";

export function getToken() {
  return localStorage.getItem("token");
}
export function setToken(t) {
  localStorage.setItem("token", t);
}
export function clearToken() {
  localStorage.removeItem("token");
}

async function req(base, path, { method = "GET", body, auth = true, raw = false } = {}) {
  const headers = {};
  const isForm = body instanceof FormData;
  if (body && !isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (raw) return res;
  if (res.status === 204) return null;
  return res.json();
}

export const authApi = {
  login: (email, password) =>
    req(AUTH_URL, "/login", { method: "POST", body: { email, password }, auth: false }),
  register: (email, password) =>
    req(AUTH_URL, "/register", { method: "POST", body: { email, password }, auth: false }),
};

export const coreApi = {
  listPages: () => req(CORE_URL, "/pages"),
  getPage: (id) => req(CORE_URL, `/pages/${id}`),
  createPage: (title, content) => req(CORE_URL, "/pages", { method: "POST", body: { title, content } }),
  updatePage: (id, data) => req(CORE_URL, `/pages/${id}`, { method: "PUT", body: data }),
  deletePage: (id) => req(CORE_URL, `/pages/${id}`, { method: "DELETE" }),
  listFiles: () => req(CORE_URL, "/files"),
  getFile: (name) => req(CORE_URL, `/file/${encodeURIComponent(name)}`),
  saveFile: (name, content) =>
    req(CORE_URL, `/file/${encodeURIComponent(name)}`, { method: "PUT", body: { content } }),
  upload: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return req(CORE_URL, "/upload", { method: "POST", body: fd });
  },
  download: async (name) => {
    const res = await req(CORE_URL, `/download/${encodeURIComponent(name)}`, { raw: true });
    return res.blob();
  },
  listDocuments: () => req(CORE_URL, "/documents"),
};
