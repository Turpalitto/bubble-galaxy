import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.MIMO_LAUNCHER_PORT || 3847);
const mode = process.argv[2] === "desktop" ? "desktop" : "browser";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isServerUp(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(port, attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    if (await isServerUp(port)) return true;
    await wait(500);
  }
  return false;
}

function run(command, args, options = {}) {
  const useShell = options.shell ?? false;
  return spawn(command, args, {
    cwd: ROOT,
    stdio: options.stdio ?? "inherit",
    shell: useShell,
    detached: options.detached ?? false,
    windowsHide: options.windowsHide ?? false,
  });
}

async function ensureBuild() {
  const distIndex = path.join(ROOT, "dist", "index.html");
  if (!fs.existsSync(distIndex)) {
    console.log("Сборка интерфейса...");
    await new Promise((resolve, reject) => {
      const build = run("npm", ["run", "build"], { stdio: "inherit" });
      build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build failed"))));
    });
  }
}

async function ensureBrowserServer() {
  if (await isServerUp(PORT)) {
    console.log(`Сервер уже работает: http://127.0.0.1:${PORT}`);
    return PORT;
  }

  console.log("Запуск локального сервера...");
  const child = run("node", ["server/index.mjs"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: false,
  });
  child.unref();

  const ready = await waitForServer(PORT);
  if (!ready) {
    throw new Error(`Сервер не ответил на порту ${PORT}`);
  }

  console.log(`Сервер запущен: http://127.0.0.1:${PORT}`);
  return PORT;
}

async function openBrowser(port) {
  const url = `http://127.0.0.1:${port}`;
  if (process.platform === "win32") {
    run("cmd", ["/c", "start", "", url], {
      stdio: "ignore",
      detached: true,
      shell: false,
    }).unref();
    return;
  }
  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  run(opener, [url], { stdio: "ignore", detached: true }).unref();
}

async function main() {
  await ensureBuild();

  if (mode === "desktop") {
    console.log("Запуск окна приложения...");
    const electron = run("npx", ["electron", "."], { stdio: "inherit" });
    electron.on("exit", (code) => process.exit(code ?? 0));
    return;
  }

  const port = await ensureBrowserServer();
  await openBrowser(port);
  console.log("Панель открыта в браузере.");
  console.log("Сервер работает в фоне. Чтобы остановить — закройте процесс node на порту 3847.");
}

main().catch((err) => {
  console.error("Ошибка:", err.message);
  process.exit(1);
});
