import { Suspense } from "react";
import { ProjectWorkspace } from "./workspace";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center text-sm text-[var(--muted)]">
          加载工作台…
        </div>
      }
    >
      <ProjectWorkspace id={id} />
    </Suspense>
  );
}
