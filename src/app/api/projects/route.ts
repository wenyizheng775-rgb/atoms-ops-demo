import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/store";

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string; prompt?: string };
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt 必填" }, { status: 400 });
  }
  const name =
    body.name?.trim() ||
    prompt.slice(0, 24).replace(/\s+/g, " ") + (prompt.length > 24 ? "…" : "");

  const project = await createProject({ name, prompt });
  return NextResponse.json({ project }, { status: 201 });
}
