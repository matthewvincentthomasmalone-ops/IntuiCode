import tkinter as tk
from tkinter import messagebox


class TodoApp:
    def __init__(self, root):
        self.root = root
        self.root.title("To-do")
        self.tasks = []
        self.entry = tk.Entry(root, width=40)
        self.entry.pack(padx=10, pady=5)
        tk.Button(root, text="Add", command=self.add_task).pack()
        self.listbox = tk.Listbox(root, width=50)
        self.listbox.pack(padx=10, pady=5)
        tk.Button(root, text="Remove selected", command=self.remove_task).pack(pady=(0, 10))

    def add_task(self):
        task = self.entry.get().strip()
        if not task:
            messagebox.showwarning("Empty", "Please type a task first.")
            return
        self.tasks.append(task)
        self.listbox.insert(tk.END, task)
        self.entry.delete(0, tk.END)

    def remove_task(self):
        selection = self.listbox.curselection()
        if selection:
            index = selection[0]
            self.listbox.delete(index)
            del self.tasks[index]


if __name__ == "__main__":
    window = tk.Tk()
    TodoApp(window)
    window.mainloop()
