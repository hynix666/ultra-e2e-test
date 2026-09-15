import { useEffect, useState, type FormEvent } from "react";
import { errorMessage, LABELS, nextStatuses, parseTasks, type Status, type Task } from "./lib/tasks.ts";

export function App() {
  const [tasks, setTasks] = useState<readonly Task[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    const res = await fetch("/api/tasks");
    if (!res.ok) throw new Error(await errorMessage(res));
    setTasks(parseTasks(await res.json()));
  }

  function run(action: () => Promise<void>): void {
    setError(null);
    action().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(() => run(refresh), []);

  function create(event: FormEvent): void {
    event.preventDefault();
    run(async () => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      setTitle("");
      await refresh();
    });
  }

  function move(task: Task, status: Status): void {
    run(async () => {
      const res = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      await refresh();
    });
  }

  return (
    <main>
      <h1>Tasks</h1>
      <form onSubmit={create}>
        <input
          aria-label="Task title"
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs doing?"
          value={title}
        />
        <button type="submit">Add</button>
      </form>
      {error !== null && <p role="alert">{error}</p>}
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <span>{task.title}</span>
            <em>{LABELS[task.status]}</em>
            {nextStatuses(task.status).map((status) => (
              <button key={status} onClick={() => move(task, status)} type="button">
                {LABELS[status]}
              </button>
            ))}
          </li>
        ))}
      </ul>
    </main>
  );
}
