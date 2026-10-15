# Rocky 上线步骤 · 134.175.134.145

目标：`http://134.175.134.145/` 可打开 Demo；现有带端口小网站不动。

```
Internet → 134.175.134.145:80 → Nginx → 127.0.0.1:3000 (PM2)
现有小网站 → 原端口（不动）
```

---

## 步骤 0（Windows 本机）— 把代码放到能拉的地方

### 方案 A：GitHub（推荐）

在 Cursor 里对我说：**「提交并推送到 GitHub」**，仓库建议：

`https://github.com/wenyizheng775-rgb/atoms-ops-demo`

### 方案 B：本机直接打包上传（不经过 GitHub）

在 **PowerShell**（项目目录 `d:\Desktop\Cursor\Atoms`）执行：

```powershell
# 排除 node_modules / .next / .env.local
tar --exclude=node_modules --exclude=.next --exclude=.env.local --exclude=data/store.json -cvf atoms-ops-demo.tar .
scp -P 55314 atoms-ops-demo.tar root@134.175.134.145:/tmp/
```

---

## 步骤 1 — SSH 登录服务器

端口 **55314**（不是默认 22）：

```bash
ssh -p 55314 root@134.175.134.145
```

登录成功后，下面命令都在 **服务器** 上执行。

---

## 步骤 2 — 安装 Node 20 / Nginx / PM2 / Git

```bash
sudo dnf -y update
sudo dnf -y install nginx git tar

# Node 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf -y install nodejs

node -v    # 期望 v20.x
npm -v

sudo npm i -g pm2
```

若 `nodesource` 很慢，也可用你机器上已有的 Node（只要 `node -v` ≥ 18）。

---

## 步骤 3 — 放行 80 端口

```bash
# firewalld（若在跑）
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
sudo firewall-cmd --list-services
```

**同时去云厂商控制台**（腾讯云安全组等）确认入站规则放行 **TCP 80**。  
只开服务器防火墙、不开安全组，外网仍打不开。

---

## 步骤 4 — 放置代码

### 4A：从 GitHub clone

```bash
sudo mkdir -p /opt/atoms-ops-demo
sudo chown "$USER":"$USER" /opt/atoms-ops-demo
cd /opt/atoms-ops-demo
git clone https://github.com/wenyizheng775-rgb/atoms-ops-demo.git .
```

### 4B：从 tar 解压

```bash
sudo mkdir -p /opt/atoms-ops-demo
sudo chown "$USER":"$USER" /opt/atoms-ops-demo
cd /opt/atoms-ops-demo
tar -xvf /tmp/atoms-ops-demo.tar
```

---

## 步骤 5 — 配置环境变量（服务器上）

```bash
cd /opt/atoms-ops-demo
cp .env.example .env.local
nano .env.local
```

至少填写（UTF-8，一行一个）：

```bash
DEEPSEEK_API_KEY=你的真实key
DEEPSEEK_MODEL=deepseek-chat
```

保存退出（nano：`Ctrl+O` 回车，`Ctrl+X`）。

检查服务器能否访问 DeepSeek：

```bash
curl -sI https://api.deepseek.com | head -n 3
```

---

## 步骤 6 — 安装依赖并构建

```bash
cd /opt/atoms-ops-demo
npm ci
npm run build
mkdir -p data
```

`build` 必须成功再往下。

---

## 步骤 7 — 用 PM2 常驻

```bash
cd /opt/atoms-ops-demo
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
# 把上一条输出的那行 sudo 命令原样再执行一次

pm2 status
curl -sI http://127.0.0.1:3000 | head
curl -s http://127.0.0.1:3000/api/health
```

期望 `health` 里：`"deepseekKeyConfigured": true`、`"dataWritable": true`。

---

## 步骤 8 — Nginx 反代 80

先看 80 是否已被占用：

```bash
sudo ss -lntp | grep ':80' || true
```

若已被别的程序占用，先停掉或改掉它（你的小网站若在别的端口则通常没事）。

```bash
sudo cp /opt/atoms-ops-demo/deploy/nginx-atoms-ops.conf /etc/nginx/conf.d/atoms-ops.conf

# 若默认站冲突，可禁用默认配置（按实际路径）
# sudo mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak 2>/dev/null || true

sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

---

## 步骤 9 — 外网验收

本机浏览器打开：

1. http://134.175.134.145/  
2. http://134.175.134.145/api/health  
3. 首页点示例 → 开始构建 → 门禁 → 发布 → 打开公开页  

无痕窗口再走一遍。

---

## 常用运维

```bash
pm2 logs atoms-ops-demo
pm2 restart atoms-ops-demo

# 更新代码后
cd /opt/atoms-ops-demo
git pull          # 或重新 scp
npm ci && npm run build
pm2 restart atoms-ops-demo
```

---

## 排错

| 现象 | 处理 |
|---|---|
| 外网打不开 | 安全组 80、firewalld、Nginx 是否 listen 80 |
| 502 | `pm2 status` / `pm2 logs`，确认 3000 在听 |
| health 里 key=false | 检查 `.env.local` 后 `pm2 restart` |
| 生成失败 | 服务器出网访问 `api.deepseek.com` |
| 和旧站冲突 | 确认旧站仍用原端口，不要改它的进程 |

---

## 完成后填笔试文档

- 在线 Demo：`http://134.175.134.145/`
- GitHub：你的 public 仓库地址
