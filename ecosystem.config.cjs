module.exports = {
  apps: [
    {
      name: "my-crm",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: "/www/wwwroot/panel.asmuldev.web.id",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        PORT: 3000,
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
      },
    },
  ],
};
