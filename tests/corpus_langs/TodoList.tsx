import React, { useState } from 'react';

type Todo = { id: number; text: string; done: boolean };

interface TodoListProps {
  title: string;
  initial?: Todo[];
}

let nextId = 1;

export function TodoItem({ todo, onToggle }: { todo: Todo; onToggle: (id: number) => void }) {
  return (
    <li className={todo.done ? 'done' : ''}>
      <label>
        <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} />
        {todo.text}
      </label>
    </li>
  );
}

export default function TodoList({ title, initial = [] }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>(initial);
  const [draft, setDraft] = useState<string>('');

  const add = () => {
    if (!draft.trim()) return;
    setTodos([...todos, { id: nextId++, text: draft.trim(), done: false }]);
    setDraft('');
  };

  const toggle = (id: number) => {
    setTodos(todos.map(t => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const left = todos.filter(t => !t.done).length;

  return (
    <section>
      <h2>{title}</h2>
      <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Something to do" />
      <button onClick={add}>Add</button>
      <ul>
        {todos.map(t => <TodoItem key={t.id} todo={t} onToggle={toggle} />)}
      </ul>
      <p>{left} left to do</p>
    </section>
  );
}
