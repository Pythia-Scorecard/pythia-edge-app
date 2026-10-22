'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const http = require('node:http');
const os = require('node:os');
const axios = require('axios');
const FormData = require('form-data');

function recordingClass(api) {
  const file = path.join(__dirname, '../src/services/recordingsService.ts');
  const parsed = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const subject = parsed.statements.find(n => ts.isClassDeclaration(n) && n.name.text === 'RecordingService');
  const methods = subject.members.filter(n => ['uploadRecording', 'deleteFilePair'].includes(n.name?.getText(parsed))).map(n => n.getText(parsed)).join('\n');
  const js = ts.transpileModule('class Subject {' + methods + '}; Subject;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return vm.runInNewContext(js, {
    FormData, fs, serverAPI: api, isAxiosError: axios.isAxiosError,
    logger: { info() {}, error() {} }, getTimeZone: () => 'UTC', getFileName: path.basename
  });
}
test('synthetic audio and DOA remain queued on network failure, then upload after reconnect', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pythia-upload-test-'));
  const audio = path.join(dir, 'synthetic.wav'); const doa = path.join(dir, 'synthetic.json');
  const wav = Buffer.alloc(204); wav.write('RIFF', 0); wav.writeUInt32LE(196, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(160, 40);
  fs.writeFileSync(audio, wav); fs.writeFileSync(doa, '{"samples":[]}');
  let mode = 'offline'; let received = Buffer.alloc(0);
  const server = http.createServer((req, res) => {
    if (mode === 'offline') { req.resume(); res.writeHead(503); res.end('test outage'); return; }
    assert.equal(req.url, '/recordings/device-upload');
    assert.equal(req.headers.authorization, 'Bearer synthetic-device-token');
    const chunks = []; req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => { received = Buffer.concat(chunks); res.writeHead(200, {'Content-Type':'application/json'}); res.end('{}'); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const api = axios.create({ baseURL: 'http://127.0.0.1:' + server.address().port, headers: { Authorization:'Bearer synthetic-device-token' }, proxy:false, timeout:2000 });
    const subject = recordingClass(api);
    await subject.uploadRecording(audio, doa);
    assert.equal(fs.existsSync(audio), true); assert.equal(fs.existsSync(doa), true);
    mode = 'online'; await subject.uploadRecording(audio, doa);
    assert.equal(fs.existsSync(audio), false); assert.equal(fs.existsSync(doa), false);
    const content = received.toString('latin1');
    assert.match(content, /name="mediaFile"/); assert.match(content, /name="doaJsonFile"/);
    assert.match(content, /RIFF/); assert.match(content, /"samples"/);
  } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(dir, { recursive:true, force:true }); }
});
test('automatic update refuses a rejected runtime before changing Git or restarting', async () => {
  const file = path.join(__dirname, '../src/services/systemService.ts');
  const parsed = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const cls = parsed.statements.find(n => ts.isClassDeclaration(n) && n.name.text === 'SystemService');
  const method = cls.members.find(n => n.name?.getText(parsed) === 'checkForUpdates');
  const js = ts.transpileModule('class Subject {' + method.getText(parsed) + '}; Subject;', { compilerOptions:{target:ts.ScriptTarget.ES2022} }).outputText;
  let touched = false;
  const subject = vm.runInNewContext(js, {
    execFilePromise: async () => { throw new Error('Node is unpatched'); },
    process, join:path.join, logger:{info(){},error(){}}
  });
  subject.ensureCanonicalGitRemote = async () => { touched = true; };
  const result = await subject.checkForUpdates();
  assert.equal(result.code, 500); assert.equal(touched, false);
});
