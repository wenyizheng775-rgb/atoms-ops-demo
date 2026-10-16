import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import { getProject } from "./store";
import type { Project, PublicUser } from "./types";

export function canAccessProject(project: Project, userId: string): boolean {
  return project.ownerId === userId;
}

export async function requireOwnedProject(
  req: Request,
  id: string,
): Promise<
  | { user: PublicUser; project: Project; error?: undefined }
  | { error: NextResponse; user?: undefined; project?: undefined }
> {
  const user = await getCurrentUser(req);
  if (!user) {
    return {
      error: NextResponse.json({ error: "请先登录" }, { status: 401 }),
    };
  }
  const project = await getProject(id);
  if (!project || !canAccessProject(project, user.id)) {
    return {
      error: NextResponse.json({ error: "未找到项目" }, { status: 404 }),
    };
  }
  return { user, project };
}
