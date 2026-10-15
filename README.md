# Atoms Ops Demo · 郑文怡

自然语言生成可预览应用，支持**预检 → 发布（公开 Demo 页）→ 回滚**。

## 核心闭环

输入需求 → DeepSeek 生成单页 HTML → Gatekeeper 确定性检查 → iframe 预览 → 自然语言迭代 → 发布快照 `/p/:id` → 回滚到历史版本。

「发布」= 保存不可变版本快照并开放本站公开预览，**不是**生产集群/CDN 部署。

## 本地启动

```bash
cp .env.example .env.local   # 填写 DEEPSEEK_API_KEY（UTF-8）
npm install
npm run dev
```

http://localhost:3000

## 生产构建

```bash
npm run build
npm run start:prod   # 127.0.0.1:3000
```

## 环境变量（无真实密钥）

| 变量 | 说明 |
|---|---|
| `DEEPSEEK_API_KEY` | 必填，仅服务端 |
| `DEEPSEEK_MODEL` | 可选，默认 `deepseek-chat` |
| `DEEPSEEK_TIMEOUT_MS` | 可选，默认 90000 |
| `RATE_LIMIT_GENERATE` | 可选，每 IP 每分钟调用上限 |
| `GATE_SLO_MIN` | 可选，运维看板 SLO 阈值，默认 99 |

## 持久化

- 方案：服务端 `data/store.json`（进程内写锁 + 原子 rename）
- 含：项目、对话、版本 HTML 快照、发布记录、审计、门禁结果
- 限制：适合 **单实例**（PM2 `instances:1`）；多实例会丢数据；仓库忽略该文件，部署机需可写 `data/`

## 部署（Rocky 9）

见 `docs/deploy-rocky9.md`：Nginx:80 → PM2:3000。需你手动：装 Node/Nginx/PM2、放行 80、配置 `.env.local`、`git pull && npm ci && npm run build && pm2 start`。

## 笔试说明

`docs/笔试说明-郑文怡.md`（提交前填公网链接与 GitHub）。

## 作者

郑文怡 · GitHub: wenyizheng775-rgb
