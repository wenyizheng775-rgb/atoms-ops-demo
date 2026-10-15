import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasKey = Boolean(process.env.DEEPSEEK_API_KEY);
  let dataWritable = false;
  try {
    const dir = path.join(process.cwd(), "data");
    await fs.mkdir(dir, { recursive: true });
    const probe = path.join(dir, ".write-probe");
    await fs.writeFile(probe, String(Date.now()), "utf-8");
    await fs.unlink(probe);
    dataWritable = true;
  } catch {
    dataWritable = false;
  }

  return NextResponse.json({
    ok: true,
    service: "atoms-ops-demo",
    deepseekKeyConfigured: hasKey,
    dataWritable,
    time: new Date().toISOString(),
  });
}
