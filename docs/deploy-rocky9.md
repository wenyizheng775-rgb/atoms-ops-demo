# Rocky Linux 9 部署

Nginx `:80` → PM2 应用 `127.0.0.1:3000`。

## 环境

```bash
sudo dnf -y install nginx git
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf -y install nodejs
sudo npm i -g pm2

# 防火墙与云安全组放行 TCP 80
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

## 部署

```bash
sudo mkdir -p /opt/atoms-ops-demo
sudo chown "$USER":"$USER" /opt/atoms-ops-demo
cd /opt/atoms-ops-demo
git clone https://github.com/wenyizheng775-rgb/atoms-ops-demo.git .

cp .env.example .env.local   # 填写 DEEPSEEK_API_KEY
npm ci && npm run build && mkdir -p data

pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup      # 按提示执行输出的命令

sudo cp deploy/nginx-atoms-ops.conf /etc/nginx/conf.d/atoms-ops.conf
sudo nginx -t && sudo systemctl enable --now nginx && sudo systemctl reload nginx
```

验收：`curl -s http://127.0.0.1:3000/api/health`，浏览器打开公网 IP。

## 更新

```bash
cd /opt/atoms-ops-demo && git pull && npm ci && npm run build && pm2 restart atoms-ops-demo
```

## 排错

| 现象 | 排查 |
|---|---|
| 外网打不开 | 安全组 / firewalld / Nginx listen 80 |
| 502 | `pm2 status` / `pm2 logs` |
| 生成失败 | `.env.local`；出网访问 DeepSeek |
| 刷新丢数据 | `data/` 是否可写 |
