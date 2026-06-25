import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { coreApi, clearToken } from "../api.js";
import Editor from "../components/Editor.jsx";
import FilesPanel from "../components/FilesPanel.jsx";

export default function Wiki() {
  const nav = useNavigate();
  const [pages, setPages] = useState([]);
  const [current, setCurrent] = useState(null);
  const [tab, setTab] = useState("wiki");
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const { pages } = await coreApi.listPages();
      setPages(pages);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function open(id) {
    try {
      setCurrent(await coreApi.getPage(id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function newPage() {
    try {
      const p = await coreApi.createPage("Nouvelle page", {});
      await refresh();
      open(p.id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function save(data) {
    await coreApi.updatePage(current.id, data);
    await refresh();
    setCurrent({ ...current, ...data });
  }

  async function del() {
    if (!confirm("Supprimer cette page ?")) return;
    await coreApi.deletePage(current.id);
    setCurrent(null);
    refresh();
  }

  function logout() {
    clearToken();
    nav("/login");
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">projet-cloud</div>
        <div className="tabs">
          <button className={tab === "wiki" ? "active" : ""} onClick={() => setTab("wiki")}>
            Wiki
          </button>
          <button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}>
            Fichiers .md
          </button>
        </div>

        {tab === "wiki" && (
          <>
            <button className="newbtn" onClick={newPage}>
              + Nouvelle page
            </button>
            <ul className="pagelist">
              {pages.map((p) => (
                <li
                  key={p.id}
                  className={current && current.id === p.id ? "active" : ""}
                  onClick={() => open(p.id)}
                >
                  {p.title}
                </li>
              ))}
              {pages.length === 0 && <li className="muted">Aucune page</li>}
            </ul>
          </>
        )}

        <button className="logout" onClick={logout}>
          Déconnexion
        </button>
      </aside>

      <main className="content">
        {error && <div className="error">{error}</div>}
        {tab === "wiki" ? (
          current ? (
            <Editor key={current.id} page={current} onSave={save} onDelete={del} />
          ) : (
            <div className="empty">Sélectionne une page à gauche, ou crée-en une.</div>
          )
        ) : (
          <FilesPanel />
        )}
      </main>
    </div>
  );
}
