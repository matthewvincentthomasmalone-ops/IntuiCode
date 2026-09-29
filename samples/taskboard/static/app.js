// Front end for TaskBoard: loads tasks from the API and shows them.
const API = "/api/tasks";
const list = document.getElementById("task-list");
const form = document.getElementById("new-task-form");

async function loadTasks() {
  const response = await fetch(API);
  const tasks = await response.json();
  list.innerHTML = "";
  for (const task of tasks) {
    const item = document.createElement("li");
    item.className = task.done ? "task done" : "task";
    item.innerHTML = `<span>${task.title}</span>`;
    item.addEventListener("click", () => completeTask(task.id));
    list.appendChild(item);
  }
  updateProgress(tasks);
}

function updateProgress(tasks) {
  const done = tasks.filter(t => t.done).length;
  document.getElementById("progress").textContent = `${done} of ${tasks.length} done`;
}

async function completeTask(id) {
  await fetch(`/api/tasks/${id}/done`, { method: "POST" });
  loadTasks();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = document.getElementById("task-title").value;
  await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  loadTasks();
});

loadTasks();
