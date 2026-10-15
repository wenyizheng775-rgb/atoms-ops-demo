import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type {
  ArtifactVersion,
  AgentStep,
  AuditEntry,
  ChatMessage,
  Project,
  StepReality,
  StoreData,
} from "./types";
import {
  GATE_DEMO_ID,
  SHOWCASE_ID,
  buildGateDemoProject,
  buildShowcaseProject,
} from "./seed";
import { runGateChecks } from "./gatekeeper";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

async function ensureStoreFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const initial: StoreData = {
      projects: [],
      seededAt: undefined,
    };
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), "utf-8");
  }
}

function migrateProject(raw: Project): Project {
  const releases =
    raw.releases ??
    (raw.publishedVersionId
      ? [
          {
            id: randomUUID(),
            versionId: raw.publishedVersionId,
            label:
              raw.versions?.find((v) => v.id === raw.publishedVersionId)
                ?.label ?? "release",
            createdAt: raw.updatedAt ?? new Date().toISOString(),
            publicPath: `/p/${raw.id}`,
          },
        ]
      : []);
  return {
    ...raw,
    tag: raw.tag ?? "normal",
    lastGate: raw.lastGate ?? null,
    releases,
    steps: (raw.steps ?? []).map((s) => ({
      ...s,
      reality:
        s.reality ??
        (s.kind === "gate" || s.kind === "publish" ? "live" : "staged"),
    })),
  };
}

/** 进程内串行写锁，降低并发 generate/publish 丢更新风险（单实例） */
let writeChain: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readStore(): Promise<StoreData> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, "utf-8");
  const data = JSON.parse(raw) as StoreData;
  data.projects = (data.projects ?? []).map(migrateProject);
  return data;
}

async function writeStore(data: StoreData): Promise<void> {
  await ensureStoreFile();
  const tmp = `${STORE_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, STORE_PATH);
}

/** 确保 Showcase / Gate 演示项目存在（不覆盖用户已改过的同 ID） */
export async function ensureSeedProjects(): Promise<StoreData> {
  const store = await readStore();
  let changed = false;

  const showcase = store.projects.find((p) => p.id === SHOWCASE_ID);
  if (!showcase) {
    store.projects.unshift(buildShowcaseProject());
    changed = true;
  } else {
    const fresh = buildShowcaseProject();
    if (
      showcase.name.includes("Showcase") ||
      showcase.name.includes("【") ||
      !showcase.releases?.length ||
      (showcase.versions[0] &&
        !runGateChecks(showcase.versions[0].html).ok)
    ) {
      Object.assign(showcase, {
        name: fresh.name,
        messages: fresh.messages,
        versions: fresh.versions,
        releases: fresh.releases,
        currentVersionId: fresh.currentVersionId,
        publishedVersionId: fresh.publishedVersionId,
        lastGate: fresh.lastGate,
        status: fresh.status,
      });
      changed = true;
    }
  }

  const gateDemo = store.projects.find((p) => p.id === GATE_DEMO_ID);
  if (!gateDemo) {
    store.projects.push(buildGateDemoProject());
    changed = true;
  } else if (gateDemo.name.includes("演示") || gateDemo.name.includes("【")) {
    const fresh = buildGateDemoProject();
    gateDemo.name = fresh.name;
    gateDemo.prompt = fresh.prompt;
    gateDemo.messages = fresh.messages;
    changed = true;
  }
  if (changed || !store.seededAt) {
    store.seededAt = new Date().toISOString();
    await writeStore(store);
  }
  return store;
}

export async function listProjects(): Promise<Project[]> {
  const store = await ensureSeedProjects();
  return store.projects.sort((a, b) => {
    const rank = (p: Project) =>
      p.tag === "showcase" ? 0 : p.tag === "gate-demo" ? 2 : 1;
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return +new Date(b.updatedAt) - +new Date(a.updatedAt);
  });
}

export async function getProject(id: string): Promise<Project | null> {
  const store = await ensureSeedProjects();
  const project = store.projects.find((p) => p.id === id) ?? null;
  if (!project) return null;
  if (!project.lastGate && project.currentVersionId) {
    const ver = project.versions.find((v) => v.id === project.currentVersionId);
    if (ver) {
      const gate = runGateChecks(ver.html);
      project.lastGate = { ...gate, at: new Date().toISOString() };
    }
  }
  return project;
}

export async function createProject(input: {
  name: string;
  prompt: string;
}): Promise<Project> {
  return withWriteLock(async () => {
    const store = await ensureSeedProjects();
    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      name: input.name,
      prompt: input.prompt,
      status: "draft",
      tag: "normal",
      createdAt: now,
      updatedAt: now,
      messages: [
        {
          id: randomUUID(),
          role: "user",
          content: input.prompt,
          createdAt: now,
        },
      ],
      steps: [],
      versions: [],
      releases: [],
      currentVersionId: null,
      publishedVersionId: null,
      lastGate: null,
      audit: [
        {
          id: randomUUID(),
          action: "create",
          detail: `创建项目「${input.name}」`,
          createdAt: now,
        },
      ],
    };
    store.projects.unshift(project);
    await writeStore(store);
    return project;
  });
}

export async function saveProject(project: Project): Promise<Project> {
  return withWriteLock(async () => {
    const store = await ensureSeedProjects();
    const idx = store.projects.findIndex((p) => p.id === project.id);
    if (idx === -1) throw new Error("Project not found");
    project.updatedAt = new Date().toISOString();
    if (!project.releases) project.releases = [];
    store.projects[idx] = project;
    await writeStore(store);
    return project;
  });
}

export async function deleteProject(id: string): Promise<void> {
  if (id === SHOWCASE_ID || id === GATE_DEMO_ID) {
    throw new Error("预置演示项目不可删除");
  }
  return withWriteLock(async () => {
    const store = await ensureSeedProjects();
    store.projects = store.projects.filter((p) => p.id !== id);
    await writeStore(store);
  });
}

export async function updateProject(
  id: string,
  mutator: (project: Project) => void,
): Promise<Project> {
  const project = await getProject(id);
  if (!project) throw new Error("Project not found");
  mutator(project);
  return saveProject(project);
}

export function makeStep(
  partial: Omit<AgentStep, "id" | "createdAt" | "status" | "reality"> & {
    status?: AgentStep["status"];
    reality?: StepReality;
  },
): AgentStep {
  const reality: StepReality =
    partial.reality ??
    (partial.kind === "gate" ||
    partial.kind === "publish" ||
    partial.title.includes("Builder")
      ? "live"
      : "staged");
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: partial.status ?? "pending",
    reality,
    kind: partial.kind,
    title: partial.title,
    detail: partial.detail,
  };
}

export function makeMessage(
  role: ChatMessage["role"],
  content: string,
): ChatMessage {
  return {
    id: randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function makeVersion(
  partial: Omit<ArtifactVersion, "id" | "createdAt">,
): ArtifactVersion {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export function makeAudit(
  action: AuditEntry["action"],
  detail: string,
  meta?: Record<string, string>,
  highlight?: boolean,
): AuditEntry {
  return {
    id: randomUUID(),
    action,
    detail,
    meta,
    highlight,
    createdAt: new Date().toISOString(),
  };
}
