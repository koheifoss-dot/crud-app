import express from "express";
import Database from "better-sqlite3";
import * as crypto from "crypto";
import * as path from "path";

interface Tag {
  id: string;
  name: string;
  color: string;
  textColor: string;
}

interface TagRow {
  id: string;
  name: string;
  color: string;
  text_color: string;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  createdAt: string;
  tags: Tag[];
}

interface TaskRow {
  id: string;
  title: string;
  completed: number;
  start_date: string | null;
  end_date: string | null;
  due_date: string | null;
  created_at: string;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const c = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function generateTagColor(): { color: string; text_color: string } {
  const h = Math.floor(Math.random() * 360);
  const s = 55 + Math.floor(Math.random() * 20); // 55-74
  const l = 38 + Math.floor(Math.random() * 22); // 38-59
  const [r, g, b] = hslToRgb(h, s, l);
  const lum = relativeLuminance(r, g, b);
  const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  const text_color = lum > 0.179 ? '#000000' : '#ffffff';
  return { color: hex, text_color };
}

function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    textColor: row.text_color,
  };
}

function rowToTask(row: TaskRow, tags: Tag[] = []): Task {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed === 1,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    dueDate: row.due_date ?? undefined,
    createdAt: row.created_at,
    tags,
  };
}

function getTaskTags(database: Database.Database, taskId: string): Tag[] {
  const rows = database.prepare(
    `SELECT t.id, t.name, t.color, t.text_color
     FROM tags t
     JOIN task_tags tt ON tt.tag_id = t.id
     WHERE tt.task_id = ?
     ORDER BY t.name`
  ).all(taskId) as TagRow[];
  return rows.map(rowToTag);
}

function resolveTagNames(database: Database.Database, names: string[]): Tag[] {
  const unique = [...new Set(names.map(n => n.trim().toLowerCase()).filter(n => n.length > 0))];
  const result: Tag[] = [];
  for (const name of unique) {
    let row = database.prepare("SELECT * FROM tags WHERE name = ?").get(name) as TagRow | undefined;
    if (!row) {
      const { color, text_color } = generateTagColor();
      const id = crypto.randomUUID();
      database.prepare("INSERT INTO tags (id, name, color, text_color) VALUES (?, ?, ?, ?)").run(id, name, color, text_color);
      row = database.prepare("SELECT * FROM tags WHERE id = ?").get(id) as TagRow;
    }
    result.push(rowToTag(row));
  }
  return result;
}

function setTaskTags(database: Database.Database, taskId: string, tags: Tag[]): void {
  database.prepare("DELETE FROM task_tags WHERE task_id = ?").run(taskId);
  for (const tag of tags) {
    database.prepare("INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)").run(taskId, tag.id);
  }
}

const db = new Database("tasks.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    due_date TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    text_color TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS task_tags (
    task_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (task_id, tag_id)
  );
`);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/tags", (_req, res) => {
  const rows = db.prepare("SELECT * FROM tags ORDER BY name").all() as TagRow[];
  res.json(rows.map(rowToTag));
});

app.get("/api/tasks", (_req, res) => {
  const rows = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all() as TaskRow[];
  res.json(rows.map(row => rowToTask(row, getTaskTags(db, row.id))));
});

app.post("/api/tasks", (req, res) => {
  const { title, startDate, endDate, dueDate, tags } = req.body as Partial<Task> & { tags?: string[] };
  if (!title || typeof title !== "string" || title.trim() === "") {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO tasks (id, title, completed, start_date, end_date, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, title.trim(), 0, startDate ?? null, endDate ?? null, dueDate ?? null, createdAt);
  const resolvedTags = Array.isArray(tags) ? resolveTagNames(db, tags) : [];
  setTaskTags(db, id, resolvedTags);
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow;
  res.status(201).json(rowToTask(row, resolvedTags));
});

app.put("/api/tasks/:id", (req, res) => {
  const { id } = req.params;
  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const { title, completed, startDate, endDate, dueDate, tags } = req.body as Partial<Task> & { tags?: string[] };
  const newTitle = title !== undefined ? title.trim() : existing.title;
  const newCompleted = completed !== undefined ? (completed ? 1 : 0) : existing.completed;
  const newStartDate = startDate !== undefined ? startDate : existing.start_date;
  const newEndDate = endDate !== undefined ? endDate : existing.end_date;
  const newDueDate = dueDate !== undefined ? dueDate : existing.due_date;
  db.prepare(
    "UPDATE tasks SET title = ?, completed = ?, start_date = ?, end_date = ?, due_date = ? WHERE id = ?"
  ).run(newTitle, newCompleted, newStartDate ?? null, newEndDate ?? null, newDueDate ?? null, id);
  if (tags !== undefined) {
    const resolvedTags = resolveTagNames(db, tags);
    setTaskTags(db, id, resolvedTags);
  }
  const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow;
  res.json(rowToTask(updated, getTaskTags(db, id)));
});

app.delete("/api/tasks/:id", (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM task_tags WHERE task_id = ?").run(id);
  const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
