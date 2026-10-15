import { notFound } from "next/navigation";
import { getProject } from "@/lib/store";
import { getPublishedVersion } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PublicPreviewPage({ params }: Props) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const published = getPublishedVersion(project);
  if (!published) {
    return (
      <div className="flex min-h-full items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-lg font-medium">尚未发布</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            项目「{project.name}」还没有通过 Publisher 发布。
          </p>
          <a
            href={`/projects/${project.id}`}
            className="mt-4 inline-block text-sm text-[var(--accent)]"
          >
            返回工作台
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-xs text-[var(--muted)]">
        <span>
          公开预览 · {project.name} · {published.label}
        </span>
        <a href={`/projects/${project.id}`} className="text-[var(--accent)]">
          打开工作台
        </a>
      </div>
      <iframe
        title="published"
        className="min-h-0 flex-1 w-full bg-white"
        sandbox="allow-scripts allow-forms"
        src={`/api/projects/${id}/preview?v=${published.id}`}
      />
    </div>
  );
}
