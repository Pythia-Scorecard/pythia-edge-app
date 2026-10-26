'use strict';
// Read-only: never start a missing daemon, dump the PM2 environment, or restart a process.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { assertSupported } = require('./check-node.cjs');
const name = process.argv[2];
if (!name || process.platform !== 'linux') throw new Error('Usage on Linux: node scripts/check-pm2.cjs <app-name>');
assertSupported();
const pm2Home = process.env.PM2_HOME || path.join(os.homedir(), '.pm2');
const daemonPid = Number(fs.readFileSync(path.join(pm2Home, 'pm2.pid'), 'utf8').trim());
if (!Number.isSafeInteger(daemonPid) || daemonPid <= 1) throw new Error('PM2 daemon PID is invalid');
process.kill(daemonPid, 0);
function inspect(pid, label) {
  if (!Number.isSafeInteger(pid) || pid <= 1) throw new Error(label + ' has no running PID');
  const procExe = '/proc/' + pid + '/exe';
  const executable = fs.readlinkSync(procExe);
  if (!/\/node(?:js)?(?: \(deleted\))?$/.test(executable)) throw new Error(label + ' executable is not Node');
  const version = execFileSync(procExe, ['--version'], { encoding: 'utf8', timeout: 5000 }).trim();
  assertSupported(version);
  if (version !== process.version) throw new Error(label + ' uses ' + version + ' but deployment uses ' + process.version);
  console.log(JSON.stringify({ label, pid, executable, version }));
}
inspect(daemonPid, 'PM2 daemon');
const apps = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] }));
const selected = apps.filter(app => app.name === name);
if (!selected.length) throw new Error('Requested PM2 application was not found');
for (const app of selected) {
  if (app.pm2_env.status !== 'online') throw new Error(name + ' is not online');
  inspect(app.pid, name);
}
