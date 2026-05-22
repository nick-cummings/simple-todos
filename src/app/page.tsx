import { Suspense } from "react";

import TodoApp from "@/components/TodoApp";

// TodoApp reads `useSearchParams()` (for filter state + the `?todo=`
// deep-link). Next requires the consumer of that hook to live under a
// <Suspense> boundary so the rest of the route can prerender while
// the client component handles the dynamic params.
export default function Home() {
  return (
    <Suspense>
      <TodoApp />
    </Suspense>
  );
}
