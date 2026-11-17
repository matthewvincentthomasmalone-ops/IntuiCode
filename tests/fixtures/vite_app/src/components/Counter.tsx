import { useState } from "react";
import { cn } from "@/lib/utils";

interface CounterProps {
  start: number;
}

export function Counter({ start }: CounterProps) {
  const [count, setCount] = useState(start);
  return (
    <button id="count" className={cn("bg-primary text-white", count > 0 && "font-bold")} onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
