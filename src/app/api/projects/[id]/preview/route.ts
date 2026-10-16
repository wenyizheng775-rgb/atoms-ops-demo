import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessProject } from "@/lib/access";
import { getProject } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) {
    return new NextResponse("项目不存在", { status: 404 });
  }

  const url = new URL(req.url);
  const versionId =
    url.searchParams.get("v") ||
    project.currentVersionId ||
    project.publishedVersionId;

  const version = project.versions.find((v) => v.id === versionId);
  if (!version?.html) {
    return new NextResponse("尚无预览产物，请先完成构建", { status: 404 });
  }

  const isPublishedSnapshot = project.publishedVersionId === version.id;
  if (!isPublishedSnapshot) {
    const user = await getCurrentUser(req);
    if (!user || !canAccessProject(project, user.id)) {
      return new NextResponse("请先登录", { status: 401 });
    }
  }

  const html = version.html.includes("<head>")
    ? version.html.replace("<head>", '<head><base target="_blank">')
    : version.html;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}
