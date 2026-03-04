import express from "express";
import Database from "better-sqlite3";
import * as crypto from "crypto";
import * as path from "path";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  createdAt: string;
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

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed === 1,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    dueDate: row.due_date ?? undefined,
    createdAt: row.created_at,
  };
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
  )
`);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/tasks", (_req, res) => {
  const rows = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all() as TaskRow[];
  res.json(rows.map(rowToTask));
});

app.post("/api/tasks", (req, res) => {
  const { title, startDate, endDate, dueDate } = req.body as Partial<Task>;
  if (!title || typeof title !== "string" || title.trim() === "") {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const task: Task = {
    id: crypto.randomUUID(),
    title: title.trim(),
    completed: false,
    startDate,
    endDate,
    dueDate,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO tasks (id, title, completed, start_date, end_date, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(task.id, task.title, 0, task.startDate ?? null, task.endDate ?? null, task.dueDate ?? null, task.createdAt);
  res.status(201).json(task);
});

app.put("/api/tasks/:id", (req, res) => {
  const { id } = req.params;
  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const { title, completed, startDate, endDate, dueDate } = req.body as Partial<Task>;
  const newTitle = title !== undefined ? title.trim() : existing.title;
  const newCompleted = completed !== undefined ? (completed ? 1 : 0) : existing.completed;
  const newStartDate = startDate !== undefined ? startDate : existing.start_date;
  const newEndDate = endDate !== undefined ? endDate : existing.end_date;
  const newDueDate = dueDate !== undefined ? dueDate : existing.due_date;
  db.prepare(
    "UPDATE tasks SET title = ?, completed = ?, start_date = ?, end_date = ?, due_date = ? WHERE id = ?"
  ).run(newTitle, newCompleted, newStartDate ?? null, newEndDate ?? null, newDueDate ?? null, id);
  const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow;
  res.json(rowToTask(updated));
});

app.delete("/api/tasks/:id", (req, res) => {
  const { id } = req.params;
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
