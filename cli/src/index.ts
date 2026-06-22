#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import FormData from 'form-data';

const CONFIG_FILE = '.mini-vercel.json';
const API_BASE = process.env.MINI_VERCEL_API || 'http://localhost:4000/api';

interface Config {
  token?: string;
  projectId?: string;
  projectName?: string;
}

function loadConfig(): Config {
  const configPath = path.join(process.cwd(), CONFIG_FILE);
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return {};
}

function saveConfig(config: Config): void {
  const configPath = path.join(process.cwd(), CONFIG_FILE);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getGlobalConfig(): Config {
  const configDir = path.join(require('os').homedir(), '.mini-vercel');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  const configPath = path.join(configDir, 'config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return {};
}

function saveGlobalConfig(config: Config): void {
  const configDir = path.join(require('os').homedir(), '.mini-vercel');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  const configPath = path.join(configDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

async function apiRequest(
  endpoint: string,
  options: { method?: string; body?: unknown; token?: string } = {}
): Promise<any> {
  const { method = 'GET', body, token } = options;
  const url = new URL(`${API_BASE}${endpoint}`);

  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const reqOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          try {
            const parsed = JSON.parse(data);
            reject(new Error(parsed.message || parsed.error || `HTTP ${res.statusCode}`));
          } catch {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } else if (res.statusCode === 204) {
          resolve(null);
        } else {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function uploadDirectory(dirPath: string, token: string, projectId: string): Promise<any> {
  const form = new FormData();

  function addFiles(dir: string, prefix: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        addFiles(fullPath, relativePath);
      } else {
        const content = fs.readFileSync(fullPath);
        form.append('files', content, { filename: relativePath });
      }
    }
  }

  addFiles(dirPath, '');

  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}/projects/${projectId}/deployments`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const headers = {
      ...form.getHeaders(),
      Authorization: `Bearer ${token}`,
    };

    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Upload failed: ${data}`));
          } else {
            resolve(JSON.parse(data));
          }
        });
      }
    );

    req.on('error', reject);
    form.pipe(req);
  });
}

function findProjectRoot(): string | null {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, CONFIG_FILE))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  if (fs.existsSync(path.join(process.cwd(), CONFIG_FILE))) {
    return process.cwd();
  }
  return null;
}

// ---- Commands ----

const program = new Command();

program
  .name('mini-vercel')
  .description('Mini Vercel CLI - Deploy and manage your projects')
  .version('1.0.0');

// Auth command
program
  .command('login')
  .description('Login to Mini Vercel')
  .action(async () => {
    const { email, password } = await inquirer.prompt([
      { type: 'input', name: 'email', message: 'Email:' },
      { type: 'password', name: 'password', message: 'Password:' },
    ]);

    const spinner = ora('Logging in...').start();
    try {
      const result = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      saveGlobalConfig({ token: result.token });
      spinner.succeed(chalk.green('Logged in successfully!'));
    } catch (err: any) {
      spinner.fail(chalk.red(`Login failed: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('whoami')
  .description('Show current user')
  .action(async () => {
    const config = getGlobalConfig();
    if (!config.token) {
      console.log(chalk.red('Not logged in. Run `mini-vercel login` first.'));
      process.exit(1);
    }

    try {
      const user = await apiRequest('/auth/me', { token: config.token });
      console.log(chalk.bold('Logged in as:'));
      console.log(`  Name:  ${user.name}`);
      console.log(`  Email: ${user.email}`);
    } catch (err: any) {
      console.log(chalk.red(`Error: ${err.message}`));
    }
  });

// Deploy commands
const deploy = program
  .command('deploy')
  .description('Deploy commands');

deploy
  .command('init')
  .description('Initialize project (create vercel.json)')
  .action(async () => {
    const answers = await inquirer.prompt([
      { type: 'input', name: 'name', message: 'Project name:', default: path.basename(process.cwd()) },
      {
        type: 'list',
        name: 'framework',
        message: 'Framework:',
        choices: ['node', 'static', 'next', 'react', 'python'],
        default: 'node',
      },
      {
        type: 'input',
        name: 'buildCommand',
        message: 'Build command (leave empty for default):',
        default: '',
      },
      {
        type: 'input',
        name: 'outputDir',
        message: 'Output directory:',
        default: './dist',
      },
    ]);

    const vercelJson = {
      name: answers.name,
      framework: answers.framework,
      buildCommand: answers.buildCommand || undefined,
      outputDir: answers.outputDir,
      installCommand: 'npm install',
    };

    fs.writeFileSync(
      path.join(process.cwd(), 'vercel.json'),
      JSON.stringify(vercelJson, null, 2)
    );

    // Create project via API
    const globalConfig = getGlobalConfig();
    if (globalConfig.token) {
      const spinner = ora('Creating project on Mini Vercel...').start();
      try {
        const project = await apiRequest('/projects', {
          method: 'POST',
          body: { name: answers.name, framework: answers.framework },
          token: globalConfig.token,
        });
        saveConfig({ projectId: project.id, projectName: project.name });
        spinner.succeed(chalk.green(`Project created: ${project.name}`));
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed to create project: ${err.message}`));
        console.log(chalk.yellow('vercel.json has been created locally.'));
      }
    } else {
      console.log(chalk.yellow('Not logged in. Run `mini-vercel login` first.'));
      console.log(chalk.yellow('vercel.json has been created locally.'));
    }

    console.log(chalk.green('✓ Project initialized!'));
  });

deploy
  .description('Deploy current directory')
  .action(async () => {
    const globalConfig = getGlobalConfig();
    const projectConfig = loadConfig();

    if (!globalConfig.token) {
      console.log(chalk.red('Not logged in. Run `mini-vercel login` first.'));
      process.exit(1);
    }

    const projectId = projectConfig.projectId;
    if (!projectId) {
      console.log(chalk.red('No project found. Run `mini-vercel deploy init` first.'));
      process.exit(1);
    }

    // Check for output directory
    const vercelJson = fs.existsSync(path.join(process.cwd(), 'vercel.json'))
      ? JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf-8'))
      : {};
    const outputDir = vercelJson.outputDir || './dist';
    const distPath = path.resolve(process.cwd(), outputDir);

    if (!fs.existsSync(distPath)) {
      console.log(chalk.yellow(`Output directory "${outputDir}" not found.`));
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Deploy without building? (upload source files)',
          default: true,
        },
      ]);
      if (!proceed) process.exit(0);
    }

    const uploadPath = fs.existsSync(distPath) ? distPath : process.cwd();
    const spinner = ora('Deploying...').start();

    try {
      const deployment = await uploadDirectory(uploadPath, globalConfig.token, projectId);
      spinner.succeed(chalk.green(`Deployment ready!`));
      console.log(`  URL:      ${chalk.cyan(deployment.url)}`);
      console.log(`  Status:   ${deployment.status}`);
      console.log(`  ID:       ${deployment.id}`);
    } catch (err: any) {
      spinner.fail(chalk.red(`Deployment failed: ${err.message}`));
      process.exit(1);
    }
  });

deploy
  .command('logs [deployment-id]')
  .description('View deployment logs')
  .action(async (deploymentId?: string) => {
    const globalConfig = getGlobalConfig();
    const projectConfig = loadConfig();

    if (!globalConfig.token || !projectConfig.projectId) {
      console.log(chalk.red('Not logged in or no project. Run `mini-vercel login` and `mini-vercel deploy init`.'));
      process.exit(1);
    }

    if (!deploymentId) {
      // List recent deployments
      try {
        const deps = await apiRequest(`/projects/${projectConfig.projectId}/deployments`, {
          token: globalConfig.token,
        });
        if (deps.length === 0) {
          console.log(chalk.yellow('No deployments found.'));
          return;
        }
        console.log(chalk.bold('Recent deployments:\n'));
        for (const dep of deps.slice(0, 10)) {
          const statusColor =
            dep.status === 'ready' ? chalk.green :
            dep.status === 'failed' ? chalk.red :
            dep.status === 'building' ? chalk.yellow : chalk.gray;
          console.log(`  ${dep.id.slice(0, 8)}  ${statusColor(dep.status.padEnd(10))}  ${dep.url || ''}`);
        }
        console.log(`\nUse ${chalk.cyan('mini-vercel deploy logs <deployment-id>')} to view logs.`);
      } catch (err: any) {
        console.log(chalk.red(`Error: ${err.message}`));
      }
      return;
    }

    const spinner = ora('Fetching logs...').start();
    try {
      const logs = await apiRequest(
        `/projects/${projectConfig.projectId}/deployments/${deploymentId}/logs`,
        { token: globalConfig.token }
      );
      spinner.stop();
      if (logs.length === 0) {
        console.log(chalk.yellow('No logs available.'));
        return;
      }
      for (const log of logs) {
        const color =
          log.level === 'error' ? chalk.red :
          log.level === 'warn' ? chalk.yellow : chalk.gray;
        const time = new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false });
        console.log(color(`[${time}] ${log.message}`));
      }
    } catch (err: any) {
      spinner.fail(chalk.red(`Failed to fetch logs: ${err.message}`));
    }
  });

deploy
  .command('env')
  .description('Manage environment variables')
  .option('-l, --list', 'List environment variables')
  .option('-s, --set <key=value>', 'Set an environment variable')
  .option('-d, --delete <key>', 'Delete an environment variable')
  .action(async (options) => {
    const globalConfig = getGlobalConfig();
    const projectConfig = loadConfig();

    if (!globalConfig.token || !projectConfig.projectId) {
      console.log(chalk.red('Not logged in or no project. Run `mini-vercel login` and `mini-vercel deploy init`.'));
      process.exit(1);
    }

    const pid = projectConfig.projectId;

    if (options.list) {
      try {
        const envs = await apiRequest(`/projects/${pid}/env`, { token: globalConfig.token });
        if (envs.length === 0) {
          console.log(chalk.yellow('No environment variables set.'));
          return;
        }
        console.log(chalk.bold('Environment variables:\n'));
        for (const env of envs) {
          const masked = env.value.substring(0, 8) + '••••••••';
          console.log(`  ${chalk.cyan(env.key)} = ${masked}  [${env.target.join(', ')}]`);
        }
      } catch (err: any) {
        console.log(chalk.red(`Error: ${err.message}`));
      }
      return;
    }

    if (options.set) {
      const [key, ...valueParts] = options.set.split('=');
      const value = valueParts.join('=');
      if (!key || !value) {
        console.log(chalk.red('Invalid format. Use: --set KEY=value'));
        process.exit(1);
      }
      try {
        await apiRequest(`/projects/${pid}/env`, {
          method: 'POST',
          body: { key, value, target: ['production'] },
          token: globalConfig.token,
        });
        console.log(chalk.green(`✓ ${key} set successfully`));
      } catch (err: any) {
        console.log(chalk.red(`Error: ${err.message}`));
      }
      return;
    }

    if (options.delete) {
      try {
        await apiRequest(`/projects/${pid}/env/${encodeURIComponent(options.delete)}`, {
          method: 'DELETE',
          token: globalConfig.token,
        });
        console.log(chalk.green(`✓ ${options.delete} deleted`));
      } catch (err: any) {
        console.log(chalk.red(`Error: ${err.message}`));
      }
      return;
    }

    // Interactive mode
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What do you want to do?',
        choices: ['List', 'Set new', 'Delete'],
      },
    ]);

    if (action === 'List') {
      const envs = await apiRequest(`/projects/${pid}/env`, { token: globalConfig.token });
      for (const env of envs) {
        console.log(`  ${chalk.cyan(env.key)} = ${env.value.substring(0, 8)}••••••`);
      }
    } else if (action === 'Set new') {
      const { key, value } = await inquirer.prompt([
        { type: 'input', name: 'key', message: 'Key:' },
        { type: 'password', name: 'value', message: 'Value:' },
      ]);
      await apiRequest(`/projects/${pid}/env`, {
        method: 'POST',
        body: { key, value, target: ['production'] },
        token: globalConfig.token,
      });
      console.log(chalk.green(`✓ ${key} set`));
    } else {
      const envs = await apiRequest(`/projects/${pid}/env`, { token: globalConfig.token });
      const { key } = await inquirer.prompt([
        {
          type: 'list',
          name: 'key',
          message: 'Select variable to delete:',
          choices: envs.map((e: any) => e.key),
        },
      ]);
      await apiRequest(`/projects/${pid}/env/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        token: globalConfig.token,
      });
      console.log(chalk.green(`✓ ${key} deleted`));
    }
  });

deploy
  .command('domains')
  .description('Manage domains')
  .option('-l, --list', 'List domains')
  .option('-a, --add <domain>', 'Add a domain')
  .option('-r, --remove <domain>', 'Remove a domain')
  .option('-v, --verify <domain>', 'Verify a domain')
  .action(async (options) => {
    const globalConfig = getGlobalConfig();
    const projectConfig = loadConfig();

    if (!globalConfig.token || !projectConfig.projectId) {
      console.log(chalk.red('Not logged in or no project.'));
      process.exit(1);
    }

    const pid = projectConfig.projectId;

    if (options.list) {
      try {
        const domains = await apiRequest(`/projects/${pid}/domains`, { token: globalConfig.token });
        if (domains.length === 0) {
          console.log(chalk.yellow('No domains configured.'));
          return;
        }
        console.log(chalk.bold('Domains:\n'));
        for (const domain of domains) {
          const verified = domain.verified ? chalk.green('✓ Verified') : chalk.yellow('Pending');
          const ssl = domain.sslStatus === 'active' ? chalk.green('SSL ✓') : chalk.yellow('SSL pending');
          console.log(`  ${chalk.cyan(domain.name)}  ${verified}  ${ssl}`);
        }
      } catch (err: any) {
        console.log(chalk.red(`Error: ${err.message}`));
      }
      return;
    }

    if (options.add) {
      try {
        await apiRequest(`/projects/${pid}/domains`, {
          method: 'POST',
          body: { name: options.add },
          token: globalConfig.token,
        });
        console.log(chalk.green(`✓ Domain ${options.add} added`));
      } catch (err: any) {
        console.log(chalk.red(`Error: ${err.message}`));
      }
      return;
    }

    if (options.verify) {
      try {
        const domains = await apiRequest(`/projects/${pid}/domains`, { token: globalConfig.token });
        const domain = domains.find((d: any) => d.name === options.verify);
        if (!domain) {
          console.log(chalk.red(`Domain ${options.verify} not found.`));
          return;
        }
        await apiRequest(`/projects/${pid}/domains/${domain.id}/verify`, {
          method: 'POST',
          token: globalConfig.token,
        });
        console.log(chalk.green(`✓ Domain ${options.verify} verification initiated`));
      } catch (err: any) {
        console.log(chalk.red(`Error: ${err.message}`));
      }
      return;
    }

    if (options.remove) {
      try {
        const domains = await apiRequest(`/projects/${pid}/domains`, { token: globalConfig.token });
        const domain = domains.find((d: any) => d.name === options.remove);
        if (!domain) {
          console.log(chalk.red(`Domain ${options.remove} not found.`));
          return;
        }
        await apiRequest(`/projects/${pid}/domains/${domain.id}`, {
          method: 'DELETE',
          token: globalConfig.token,
        });
        console.log(chalk.green(`✓ Domain ${options.remove} removed`));
      } catch (err: any) {
        console.log(chalk.red(`Error: ${err.message}`));
      }
      return;
    }

    // Interactive mode
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Domain management:',
        choices: ['List domains', 'Add domain', 'Remove domain', 'Verify domain'],
      },
    ]);

    if (action === 'List domains') {
      const domains = await apiRequest(`/projects/${pid}/domains`, { token: globalConfig.token });
      for (const domain of domains) {
        console.log(`  ${chalk.cyan(domain.name)} ${domain.verified ? chalk.green('✓') : chalk.yellow('pending')}`);
      }
    } else if (action === 'Add domain') {
      const { name } = await inquirer.prompt([{ type: 'input', name: 'name', message: 'Domain name:' }]);
      await apiRequest(`/projects/${pid}/domains`, {
        method: 'POST',
        body: { name },
        token: globalConfig.token,
      });
      console.log(chalk.green(`✓ Domain ${name} added`));
    } else if (action === 'Remove domain') {
      const domains = await apiRequest(`/projects/${pid}/domains`, { token: globalConfig.token });
      const { name } = await inquirer.prompt([
        { type: 'list', name: 'name', message: 'Select:', choices: domains.map((d: any) => d.name) },
      ]);
      const domain = domains.find((d: any) => d.name === name);
      await apiRequest(`/projects/${pid}/domains/${domain.id}`, {
        method: 'DELETE',
        token: globalConfig.token,
      });
      console.log(chalk.green(`✓ Removed ${name}`));
    } else {
      const domains = await apiRequest(`/projects/${pid}/domains`, { token: globalConfig.token });
      const { name } = await inquirer.prompt([
        { type: 'list', name: 'name', message: 'Select:', choices: domains.map((d: any) => d.name) },
      ]);
      const domain = domains.find((d: any) => d.name === name);
      await apiRequest(`/projects/${pid}/domains/${domain.id}/verify`, {
        method: 'POST',
        token: globalConfig.token,
      });
      console.log(chalk.green(`✓ Verification initiated for ${name}`));
    }
  });

program.parse();
