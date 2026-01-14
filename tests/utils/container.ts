import { execSync, spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const ORG_AGENDA_API_PATH = path.join(
  os.homedir(),
  'dotfiles/dotfiles/emacs.d/straight/repos/org-agenda-api'
);

interface ContainerConfig {
  port?: number;
  gitSyncInterval?: number;
}

export interface RunningContainer {
  id: string;
  name: string;
  port: number;
  baseUrl: string;
  orgDir: string;
  stop: () => void;
}

/**
 * Build the org-agenda-api container using Nix
 */
export function buildContainer(): string {
  console.log('Building org-agenda-api container...');
  const result = execSync(
    'nix build .#container --no-link --print-out-paths',
    {
      cwd: ORG_AGENDA_API_PATH,
      encoding: 'utf-8',
    }
  );
  return result.trim();
}

/**
 * Load container image into Docker
 */
export function loadContainer(imagePath: string): string {
  console.log('Loading container into Docker...');
  const result = execSync(`docker load -i ${imagePath}`, {
    encoding: 'utf-8',
  });

  // Extract image name from output
  const match = result.match(/Loaded image: (.+)/);
  if (match) {
    return match[1].trim();
  }
  return 'org-agenda-api:latest';
}

/**
 * Find a free port
 */
function findFreePort(): number {
  const net = require('net');
  const server = net.createServer();
  server.listen(0);
  const port = server.address().port;
  server.close();
  return port;
}

/**
 * Wait for the API server to be ready
 */
async function waitForServer(
  url: string,
  timeout: number = 60000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`${url}/get-all-todos`);
      if (response.ok) {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

/**
 * Create a temporary org directory with test fixtures
 */
export function createTestOrgDir(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mova-test-org-'));

  // Create inbox.org
  fs.writeFileSync(
    path.join(tmpDir, 'inbox.org'),
    `#+TITLE: Test Inbox

* TODO Test task 1
  SCHEDULED: <2024-06-15 Sat>

* TODO Test task 2
  DEADLINE: <2024-06-16 Sun>

* NEXT Active task
  :PROPERTIES:
  :ID: test-task-active
  :END:

* DONE Completed task
  CLOSED: [2024-06-14 Fri]
`
  );

  // Create a project.org
  fs.writeFileSync(
    path.join(tmpDir, 'project.org'),
    `#+TITLE: Test Project

* Project A
** TODO Subtask A1 :work:
** TODO Subtask A2 :personal:

* Project B
** WAITING Waiting for response
** TODO Follow up task
   DEADLINE: <2024-06-20 Thu>
`
  );

  // Initialize git repo
  execSync('git init', { cwd: tmpDir });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir });
  execSync('git config user.name "Test User"', { cwd: tmpDir });
  execSync('git add .', { cwd: tmpDir });
  execSync('git commit -m "Initial test fixtures"', { cwd: tmpDir });

  return tmpDir;
}

/**
 * Start an org-agenda-api container for testing
 */
export async function startContainer(
  config: ContainerConfig = {}
): Promise<RunningContainer> {
  const port = config.port || findFreePort();
  const gitSyncInterval = config.gitSyncInterval || 2;
  const containerName = `mova-test-${process.pid}-${Date.now()}`;

  // Build and load container
  const imagePath = buildContainer();
  const imageName = loadContainer(imagePath);

  // Create test org directory
  const orgDir = createTestOrgDir();

  // Start container
  console.log(`Starting container on port ${port}...`);
  execSync(
    `docker run -d \
      --name ${containerName} \
      -p ${port}:80 \
      -v ${orgDir}:/data/org \
      -e GIT_SYNC_INTERVAL=${gitSyncInterval} \
      -e GIT_SYNC_NEW_FILES=true \
      ${imageName}`,
    { encoding: 'utf-8' }
  );

  const baseUrl = `http://localhost:${port}`;

  // Wait for server to be ready
  console.log('Waiting for server to be ready...');
  const ready = await waitForServer(baseUrl, 60000);
  if (!ready) {
    // Get logs for debugging
    try {
      const logs = execSync(`docker logs ${containerName}`, {
        encoding: 'utf-8',
      });
      console.error('Container logs:', logs);
    } catch {}

    // Cleanup
    execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
    fs.rmSync(orgDir, { recursive: true, force: true });

    throw new Error('Container did not start in time');
  }

  console.log(`Container ready at ${baseUrl}`);

  return {
    id: containerName,
    name: containerName,
    port,
    baseUrl,
    orgDir,
    stop: () => {
      console.log('Stopping container...');
      try {
        execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
      } catch {}
      try {
        fs.rmSync(orgDir, { recursive: true, force: true });
      } catch {}
    },
  };
}

/**
 * API client for testing
 */
export class TestApiClient {
  constructor(private baseUrl: string) {}

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return response.json();
  }

  async post<T>(path: string, body?: object): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return response.json();
  }

  async getAllTodos() {
    return this.get<{ todos: any[]; defaults: any }>('/get-all-todos');
  }

  async createTodo(title: string) {
    return this.post<{ status: string; title?: string }>('/create-todo', {
      title,
    });
  }

  async completeTodo(todo: { file: string; pos: number; title: string }) {
    return this.post<{ status: string; newState?: string }>('/complete', todo);
  }

  async getAgenda(span: 'day' | 'week' = 'day') {
    return this.get<{ span: string; entries: any[] }>(`/agenda?span=${span}`);
  }
}
