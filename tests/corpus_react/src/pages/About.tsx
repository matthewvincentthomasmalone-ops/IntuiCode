import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function About() {
  const [seconds, setSeconds] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="container max-w-2xl space-y-4 py-12">
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold">
        About Notes
      </h1>
      <p className="text-muted-foreground">
        A small place to keep your notes. You've been reading this for {seconds} seconds.
      </p>
      {showMore ? (
        <p>Notes are saved to your account, so they follow you to every device.</p>
      ) : (
        <Button variant="link" className="px-0" onClick={() => setShowMore(true)}>
          Tell me more
        </Button>
      )}
      <Link to="/" className="underline">
        Back to my notes
      </Link>
    </div>
  );
}
