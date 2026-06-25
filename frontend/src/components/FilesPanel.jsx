import { useEffect, useState } from "react";
import { coreApi } from "../api.js";

export default function FilesPanel() {
  const [files, setFiles] = useState([]);
  const [name, setName] = useState(null);
  const [content, setContent] = useState("");
  const [msg, setMsg] = useState("");

  async function refresh() {
    try {
      const { files } = await coreApi.listFiles();
      setFiles(files);
    } catch (e) {
      setMsg(e.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function open(n) {
    setName(n);
    setMsg("");
    try {
      const { content } = await coreApi.getFile(n);
      setContent(content);
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function save() {
    try {
      await coreApi.saveFile(name, content);
      setMsg("Sauvegardé ✓");
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function onUpload(e) {
    const f = e.target.files[0];
    if (!f) return;
    try {
      await coreApi.upload(f);
      setMsg(`Uploadé : ${f.name}`);
      refresh();
    } catch (err) {
      setMsg(err.message);
    } finally {
      e.target.value = "";
    }
  }

  async function download(n) {
    try {
      const blob = await coreApi.download(n);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = n;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div className="files">
      <div className="files-list">
        <label className="upload">
          ⬆ Importer un .md
          <input type="file" accept=".md" onChange={onUpload} hidden />
        </label>
        <ul>
          {files.map((f) => (
            <li key={f.name} className={name === f.name ? "active" : ""}>
              <span className="fname" onClick={() => open(f.name)}>
                {f.name}
              </span>
              <button className="dl" onClick={() => download(f.name)} title="Télécharger">
                ⬇
              </button>
            </li>
          ))}
          {files.length === 0 && <li className="muted">Aucun fichier</li>}
        </ul>
      </div>

      <div className="files-editor">
        {name ? (
          <>
            <div className="bar">
              <strong>{name}</strong>
              <div className="spacer" />
              {msg && <span className="muted">{msg}</span>}
              <button onClick={save}>Sauvegarder</button>
            </div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} />
          </>
        ) : (
          <div className="empty">Sélectionne un fichier .md (ou importe-en un).</div>
        )}
      </div>
    </div>
  );
}
