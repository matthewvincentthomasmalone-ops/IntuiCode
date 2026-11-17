import { Counter } from "@/components/Counter";

const App = () => (
  <main className="card">
    <h1 id="title">{import.meta.env.VITE_TITLE ?? "Counter"}</h1>
    <Counter start={0} />
  </main>
);

export default App;
