const path = require("path");

/** PM2 — 在仓库根目录执行: pm2 start deploy/ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "atoms-ops-demo",
      cwd: path.join(__dirname, ".."),
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      max_memory_restart: "512M",
      time: true,
    },
  ],
};
