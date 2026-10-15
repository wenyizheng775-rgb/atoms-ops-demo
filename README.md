# Atoms Ops Demo · 郑文怡

自然语言生成可预览应用，支持 **预检 → 发布（公开 Demo 页）→ 回滚**。

- Demo：http://134.175.134.145/
- 笔试作品说明：[docs/notes.md](./docs/notes.md)

「发布」= 保存不可变版本快照并开放本站 `/p/:id` 预览，**不是**生产集群 / CDN 部署。

## 本地启动

```bash
cp .env.example .env.local   # DEEPSEEK_API_KEY=...（UTF-8）
npm install
npm run dev
```

http://localhost:3000

## 生产构建

```bash
npm run build
npm run start:prod   # 127.0.0.1:3000
```

## 环境变量

| 变量 | 说明 |
|---|---|
| `DEEPSEEK_API_KEY` | 必填，仅服务端 |
| `DEEPSEEK_MODEL` | 可选，默认 `deepseek-chat` |
| `DEEPSEEK_TIMEOUT_MS` | 可选，默认 `90000` |
| `RATE_LIMIT_GENERATE` | 可选，每 IP 每分钟 generate 上限 |
| `GATE_SLO_MIN` | 可选，运维看板 SLO 阈值，默认 `99` |

## 持久化

`data/store.json`（单实例写锁）。多实例会不一致；部署目录需可写 `data/`。

## 部署

见 [docs/deploy-rocky9.md](./docs/deploy-rocky9.md)（Nginx → PM2）。

## License

私有笔试作品；仓库公开仅用于招聘评审。
