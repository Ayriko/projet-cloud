import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export default function Editor({ page, onSave, onDelete }) {
  const [title, setTitle] = useState(page.title);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const editor = useEditor({
    extensions: [StarterKit],
    content: page.content && page.content.type ? page.content : "",
  });

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      await onSave({ title, content: editor.getJSON() });
      setMsg("Sauvegardé ✓");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!editor) return null;

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <input
          className="title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de la page"
        />
        <div className="spacer" />
        {msg && <span className="muted">{msg}</span>}
        <button onClick={save} disabled={saving}>
          {saving ? "..." : "Sauvegarder"}
        </button>
        <button className="danger" onClick={onDelete}>
          Supprimer
        </button>
      </div>

      <div className="format-bar">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive("bold") ? "on" : ""}>
          B
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive("italic") ? "on" : ""}>
          <em>I</em>
        </button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive("heading", { level: 1 }) ? "on" : ""}>
          H1
        </button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive("heading", { level: 2 }) ? "on" : ""}>
          H2
        </button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive("bulletList") ? "on" : ""}>
          • Liste
        </button>
        <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive("codeBlock") ? "on" : ""}>
          {"</>"}
        </button>
      </div>

      <EditorContent editor={editor} className="prose" />
    </div>
  );
}
