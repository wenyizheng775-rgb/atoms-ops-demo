# Rocky Linux 9 部署清单

目标：本 Demo 对外占用 **80 端口**；你现有「带端口」的小网站保持原端口不动。

## 架构示意

```
Internet :80
    → Nginx
        → proxy_pass http://127.0.0.1:3000   # Atoms Ops Demo (PM2)
现有小网站 :原端口（例如 8080）              # 不动
```

## 0. 本机先完成

```bash
# Windows 开发机
cp .env.example .env.local   # 填入 DEEPSEEK_API_KEY
npm install
npm run build                # 确认能过
```

把代码推到 GitHub，或用 `scp`/`rsync` 传到服务器。

## 1. 服务器准备（Rocky 9）

```bash
# 用 root 或有 sudo 的账号
sudo dnf -y update
sudo dnf -y install nginx git

# Node 20（NodeSource 或你习惯的方式）
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf -y install nodejs

node -v   # 应 >= 20
npm -v

sudo npm i -g pm2
```

开放防火墙 80（若启用 firewalld）：

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

云厂商安全组也要放行 **入站 TCP 80**。

## 2. 拉代码并构建

```bash
sudo mkdir -p /opt/atoms-ops-demo
sudo chown "$USER":"$USER" /opt/atoms-ops-demo
cd /opt/atoms-ops-demo

git clone https://github.com/wenyizheng775-rgb/<你的仓库名>.git .
# 或 rsync 上传

cp .env.example .env.local
nano .env.local   # 写入 DEEPSEEK_API_KEY

npm ci
npm run build
mkdir -p data
```

## 3. PM2 常驻

仓库内已提供 `deploy/ecosystem.config.cjs`：

```bash
cd /opt/atoms-ops-demo
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup    # 按提示执行它输出的 sudo 命令，开机自启
pm2 status
curl -sI http://127.0.0.1:3000 | head
```

## 4. Nginx 反代 80

```bash
sudo cp /opt/atoms-ops-demo/deploy/nginx-atoms-ops.conf /etc/nginx/conf.d/atoms-ops.conf
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

浏览器访问：`http://<公网IP>/`

## 5. 验收清单

- [ ] `http://公网IP/` 能打开首页  
- [ ] 创建项目能调 DeepSeek 并出预览（服务器需能访问 `api.deepseek.com`）  
- [ ] 发布后 `/p/<id>` 可打开  
- [ ] 重启：`pm2 restart atoms-ops-demo` 后数据仍在（`data/store.json`）  
- [ ] 现有小网站原端口仍可访问  

## 6. 常用运维命令

```bash
pm2 logs atoms-ops-demo
pm2 restart atoms-ops-demo
# 更新代码后
cd /opt/atoms-ops-demo && git pull && npm ci && npm run build && pm2 restart atoms-ops-demo
```

## 7. 排错

| 现象 | 排查 |
|---|---|
| 外网打不开 80 | 安全组 / firewalld / Nginx 是否 listen 80 |
| 502 | `pm2 status`、看 `pm2 logs`，确认 3000 在听 |
| 生成失败 | `.env.local` 的 Key；服务器出网访问 DeepSeek |
| 发布后刷新丢数据 | 是否写到只读目录；确认 `data/` 可写 |

## 备选

若暂时不想动 80：可先 `PORT=3000` + 安全组放行 3000，HR 用 `http://IP:3000`；定稿后再切 Nginx 80。
