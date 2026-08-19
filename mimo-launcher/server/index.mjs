import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "..", "dist");
const PORT = Number(process.env.MIMO_LAUNCHER_PORT || 3847);
const DEFAULT_PROJECT = process.env.MIMO_PROJECT || "C:\\BUBBLEGAME";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function resolveMimoBinary() {
  const home = os.homedir();
  const candidates = [
    path.join(home, ".mimocode", "bin", "mimo.exe"),
    path.join(home, ".mimocode", "bin", "mimo"),
    "mimo",
  ];
  for (const candidate of candidates) {
    if (candidate === "mimo") return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }
  return "mimo";
}

const MIMO_BIN = resolveMimoBinary();

async function runMimo(args, options = {}) {
  const { cwd, timeout = 120_000 } = options;
  try {
    const { stdout, stderr } = await execFileAsync(MIMO_BIN, args, {
      cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      windowsHide: true,
    });
    return { ok: true, stdout: stdout ?? "", stderr: stderr ?? "" };
  } catch (error) {
    const stdout = error.stdout?.toString?.() ?? "";
    const stderr = error.stderr?.toString?.() ?? error.message ?? "";
    return { ok: false, stdout, stderr, code: error.code };
  }
}

function stripAnsi(text) {
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").replace(/\r/g, "");
}

function parseModels(output) {
  const clean = stripAnsi(output);
  const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
  const models = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("/")) continue;
    if (line.startsWith("{") || line.startsWith("[")) continue;

    const id = line.split(/\s+/)[0];
    if (!id.includes("/")) continue;

    let meta = null;
    if (lines[i + 1]?.startsWith("{")) {
      try {
        meta = JSON.parse(lines[i + 1]);
        i++;
      } catch {
        meta = null;
      }
    }

    models.push({
      id,
      name: meta?.name ?? id.split("/")[1],
      provider: meta?.providerID ?? id.split("/")[0],
      status: meta?.status ?? "unknown",
      reasoning: meta?.capabilities?.reasoning ?? false,
    });
  }

  return models.length ? models : lines.filter((l) => l.includes("/")).map((id) => ({
    id,
    name: id.split("/")[1],
    provider: id.split("/")[0],
    status: "unknown",
    reasoning: id.includes("pro"),
  }));
}

function parseAgents(output) {
  const clean = stripAnsi(output);
  const agents = [];
  const re = /^([a-z][\w-]*)\s+\((primary|subagent)\)/gm;
  let match;
  while ((match = re.exec(clean)) !== null) {
    agents.push({ id: match[1], role: match[2] });
  }
  return agents;
}

function parseSessions(output) {
  const clean = stripAnsi(output);
  if (!clean.trim()) return [];
  const sessions = [];
  const blocks = clean.split(/\n(?=[a-z0-9-]{8,})/i);
  for (const block of blocks) {
    const idMatch = block.match(/^([a-zA-Z0-9_-]{6,})/);
    if (!idMatch) continue;
    const titleMatch = block.match(/title[:\s]+(.+)/i);
    const dateMatch = block.match(/(\d{4}-\d{2}-\d{2})/);
    sessions.push({
      id: idMatch[1],
      title: titleMatch?.[1]?.trim() ?? "Без названия",
      date: dateMatch?.[1] ?? null,
      raw: block.trim().slice(0, 200),
    });
  }
  if (!sessions.length && clean.trim()) {
    return [{ id: "last", title: clean.trim().slice(0, 80), date: null, raw: clean.trim() }];
  }
  return sessions;
}

function buildLaunchCommand(config) {
  const args = [];
  if (config.model) args.push("-m", config.model);
  if (config.agent) args.push("--agent", config.agent);
  if (config.session) args.push("-s", config.session);
  if (config.continue) args.push("-c");
  if (config.fork) args.push("--fork");
  if (config.trust) args.push("--trust");
  if (config.neverAsk) args.push("--never-ask");
  if (config.prompt) args.push("--prompt", config.prompt);
  if (config.port) args.push("--port", String(config.port));
  return args;
}

function quotePs(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function launchInTerminal(projectPath, args, mode = "tui") {
  const mimoArgs = mode === "serve" ? ["serve", ...args] : args;

  if (process.platform === "win32") {
    const argList = mimoArgs.map(quotePs).join(",");
    const psCommand = [
      "Start-Process",
      "-FilePath", quotePs(MIMO_BIN),
      "-WorkingDirectory", quotePs(projectPath),
      "-ArgumentList", argList,
    ].join(" ");

    spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCommand],
      { detached: true, stdio: "ignore", windowsHide: true },
    ).unref();

    return {
      launched: true,
      command: `"${MIMO_BIN}" ${mimoArgs.join(" ")}`,
    };
  }

  const quotedArgs = mimoArgs
    .map((a) => (a.includes(" ") || a.includes("'") ? `'${a.replace(/'/g, "'\\''")}'` : a))
    .join(" ");
  const shell = process.env.SHELL || "/bin/bash";
  spawn(shell, ["-lc", `cd "${projectPath}" && "${MIMO_BIN}" ${quotedArgs}`], {
    detached: true,
    stdio: "ignore",
  }).unref();

  return { launched: true, command: `"${MIMO_BIN}" ${mimoArgs.join(" ")}` };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mimoBin: MIMO_BIN, platform: process.platform });
});

app.get("/api/info", async (_req, res) => {
  const version = await runMimo(["--version"]);
  res.json({
    version: stripAnsi(version.stdout).trim() || "неизвестно",
    mimoBin: MIMO_BIN,
    defaultProject: DEFAULT_PROJECT,
    exists: fs.existsSync(DEFAULT_PROJECT),
  });
});

app.get("/api/models", async (_req, res) => {
  const result = await runMimo(["models", "--verbose"]);
  const output = result.stdout || result.stderr;
  res.json({ models: parseModels(output) });
});

app.get("/api/agents", async (_req, res) => {
  const result = await runMimo(["agent", "list"]);
  const output = result.stdout || result.stderr;
  res.json({ agents: parseAgents(output) });
});

app.get("/api/sessions", async (req, res) => {
  const project = req.query.project || DEFAULT_PROJECT;
  const result = await runMimo(["session", "list"], { cwd: project });
  const output = result.stdout || result.stderr;
  res.json({ sessions: parseSessions(output) });
});

app.get("/api/providers", async (_req, res) => {
  const result = await runMimo(["providers", "list"]);
  const output = stripAnsi(result.stdout || result.stderr);
  const loggedIn = !output.includes("0 credentials");
  res.json({
    loggedIn,
    raw: output.trim(),
    credentialsPath: path.join(os.homedir(), ".local", "share", "mimocode", "auth.json"),
  });
});

app.post("/api/launch", (req, res) => {
  const {
    project = DEFAULT_PROJECT,
    mode = "tui",
    model,
    agent,
    session,
    continue: cont,
    fork,
    trust = true,
    neverAsk,
    prompt,
    port,
  } = req.body ?? {};

  if (!fs.existsSync(project)) {
    return res.status(400).json({ error: `Папка не найдена: ${project}` });
  }

  const args = buildLaunchCommand({ model, agent, session, continue: cont, fork, trust, neverAsk, prompt, port });
  if (mode === "run" && req.body?.message) {
    args.push("run", ...String(req.body.message).split(" "));
  }

  const result = launchInTerminal(project, args, mode === "serve" ? "serve" : "tui");
  res.json({ ...result, args, project });
});

app.post("/api/run", async (req, res) => {
  const {
    project = DEFAULT_PROJECT,
    message,
    model,
    agent,
    session,
    continue: cont,
    format = "default",
  } = req.body ?? {};

  if (!message?.trim()) {
    return res.status(400).json({ error: "Сообщение не может быть пустым" });
  }

  const args = ["run", message.trim()];
  if (model) args.push("-m", model);
  if (agent) args.push("--agent", agent);
  if (session) args.push("-s", session);
  if (cont) args.push("-c");
  if (format) args.push("--format", format);
  if (req.body?.trust) args.push("--trust");

  const result = await runMimo(args, { cwd: project, timeout: 600_000 });
  res.json({
    ok: result.ok,
    output: stripAnsi(result.stdout || result.stderr),
    code: result.code,
  });
});

app.post("/api/providers/login", async (req, res) => {
  const url = req.body?.url;
  const args = url ? ["providers", "login", url] : ["providers", "login"];
  launchInTerminal(os.homedir(), args);
  res.json({ launched: true });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

export function startServer(preferredPort = PORT) {
  return new Promise((resolve, reject) => {
    const server = app.listen(preferredPort, "127.0.0.1");

    server.on("listening", () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : preferredPort;
      resolve({ server, port: actualPort, alreadyRunning: false });
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve({ server: null, port: preferredPort, alreadyRunning: true });
        return;
      }
      reject(err);
    });
  });
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectRun()) {
  startServer(PORT).then(({ port }) => {
    console.log(`MiMo Launcher: http://127.0.0.1:${port}`);
    if (!fs.existsSync(DIST_DIR)) {
      console.log("Подсказка: выполните npm run build для сборки интерфейса");
    }
  });
}
