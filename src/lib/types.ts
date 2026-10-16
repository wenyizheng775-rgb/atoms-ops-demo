export type StepKind =
  | "plan"
  | "read"
  | "write"
  | "terminal"
  | "gate"
  | "publish"
  | "message";

export type StepStatus = "pending" | "running" | "done" | "failed";

/** staged = 编排演出；live = 真实副作用（LLM / Gate / 版本写入 / 发布） */
export type StepReality = "staged" | "live";

export interface AgentStep {
  id: string;
  kind: StepKind;
  title: string;
  detail?: string;
  status: StepStatus;
  reality: StepReality;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface ArtifactVersion {
  id: string;
  label: string;
  html: string;
  files: { path: string; note: string }[];
  createdAt: string;
  prompt: string;
}

export interface AuditEntry {
  id: string;
  action: "create" | "generate" | "publish" | "rollback" | "unpublish";
  detail: string;
  createdAt: string;
  meta?: Record<string, string>;
  highlight?: boolean;
}

export interface GateCheck {
  id: string;
  name: string;
  passed: boolean;
  message: string;
}

export interface GateResult {
  ok: boolean;
  checks: GateCheck[];
  at?: string;
  /** 失败时的修复建议 */
  hint?: string;
}

/** 一次成功发布的不可变快照指针（指向 versions 中的 html） */
export interface ReleaseRecord {
  id: string;
  versionId: string;
  label: string;
  createdAt: string;
  publicPath: string;
}

export type ProjectTag = "showcase" | "gate-demo" | "normal";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  /** 所属用户；无 ownerId 的旧数据不在列表中展示，也不能操作 */
  ownerId?: string | null;
  name: string;
  prompt: string;
  status: "draft" | "building" | "ready" | "published" | "failed";
  tag: ProjectTag;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  steps: AgentStep[];
  versions: ArtifactVersion[];
  /** 历史发布快照（按时间追加，不被后续编辑覆盖） */
  releases: ReleaseRecord[];
  currentVersionId: string | null;
  publishedVersionId: string | null;
  lastGate: GateResult | null;
  audit: AuditEntry[];
}

export interface EmailCode {
  email: string;
  code: string;
  purpose: "register";
  expiresAt: string;
  createdAt: string;
}

export interface StoreData {
  projects: Project[];
  users?: User[];
  sessions?: Session[];
  emailCodes?: EmailCode[];
  seededAt?: string;
}
