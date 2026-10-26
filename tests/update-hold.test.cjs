'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function source(relative) {
  const file = path.join(__dirname, '../src', relative);
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}
function compile(text) {
  return ts.transpileModule(text, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
}
function heldUpdater(value = '1') {
  const parsed = source('services/systemService.ts');
  const cls = parsed.statements.find(n => ts.isClassDeclaration(n) && n.name.text === 'SystemService');
  const method = cls.members.find(n => n.name?.getText(parsed) === 'checkForUpdates');
  const touched = [];
  const forbid = name => async () => { touched.push(name); throw new Error(`Unexpected ${name}`); };
  const subject = vm.runInNewContext(compile('class Subject {' + method.getText(parsed) + '}; Subject;'), {
    process:{env:{PYTHIA_UPDATE_HOLD:value},execPath:process.execPath,cwd:process.cwd}, join:path.join,
    execFilePromise:forbid('runtime or PM2 command'), execPromise:forbid('install or build'),
    git:{fetch:forbid('fetch'),pull:forbid('pull'),reset:forbid('reset'),revparse:forbid('revision read')},
    logger:{info(){},error(){}}
  });
  subject.ensureCanonicalGitRemote = forbid('remote migration');
  subject.restartApp = () => { touched.push('restart'); };
  return {subject,touched};
}

test('hold prevents all update side effects, including repeated and concurrent calls', async () => {
  const {subject,touched} = heldUpdater();
  const results = await Promise.all([subject.checkForUpdates(),subject.checkForUpdates(),subject.checkForUpdates()]);
  for (const result of results) {
    assert.equal(result.code,200);
    assert.equal(result.message,'Application updates are held on this device.');
  }
  assert.deepEqual(touched,[]);
});

test('invalid hold settings fail closed without running commands or exposing the value', async () => {
  for (const value of ['', 'true', 'false', ' 1 ', '2', 'unexpected-private-value']) {
    const {subject,touched} = heldUpdater(value);
    const result = await subject.checkForUpdates();
    assert.equal(result.code,503);
    assert.equal(result.message,'Application updates are held: PYTHIA_UPDATE_HOLD must be 0 or 1.');
    assert.deepEqual(touched,[]);
  }
});

test('scheduled update callback respects the hold', async () => {
  const {subject,touched} = heldUpdater();
  let scheduled;
  const parsed = source('jobs/autoUpdateCron.ts');
  const schedule = parsed.statements.find(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && n.expression.expression.getText(parsed) === 'cron.schedule');
  vm.runInNewContext(compile(schedule.getText(parsed)), {
    cron:{schedule:(expression,callback)=>{assert.equal(expression,'0 3 * * *'); scheduled=callback;}},
    SystemService:subject, logger:{info(){},error(){}}
  });
  await scheduled();
  assert.deepEqual(touched,[]);
});

test('startup still starts recording and handles interrupted files while the update is held', async () => {
  const {subject,touched} = heldUpdater();
  const events = [];
  let updateResult;
  const parsed = source('jobs/audioRecording.ts');
  const declaration = parsed.statements.filter(ts.isVariableStatement).flatMap(n=>[...n.declarationList.declarations]).find(n=>n.name.getText(parsed)==='runOnStart');
  const runOnStart = vm.runInNewContext(compile('const runOnStart = ' + declaration.initializer.getText(parsed) + '; runOnStart;'), {
    SystemService:{installDOADependencies:async()=>{events.push('Python dependencies');},checkForUpdates:()=>{events.push('update'); updateResult=subject.checkForUpdates(); return updateResult;}},
    startRecording:()=>{events.push('record');},scheduleNextRestart:()=>{events.push('recording schedule');},
    handleInterruptedFiles:async()=>{events.push('recover queued files');},logger:{error(){}}
  });
  await runOnStart();
  assert.equal((await updateResult).code,200);
  assert.deepEqual(events,['Python dependencies','record','recording schedule','recover queued files','update']);
  assert.deepEqual(touched,[]);
});

test('HTTP update handler reports the hold instead of bypassing it', async () => {
  const {subject,touched} = heldUpdater();
  const parsed = source('app.ts');
  const route = parsed.statements.find(n=>ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && n.expression.expression.getText(parsed)==='app.get' && n.expression.arguments[0]?.text==='/update-app');
  const handler = vm.runInNewContext(compile('const handler = '+route.expression.arguments[1].getText(parsed)+'; handler;'),{SystemService:subject});
  const response = {status(code){this.code=code;return this;},json(body){this.body=body;}};
  await handler({},response);
  assert.equal(response.code,200);
  assert.equal(response.body.message,'Application updates are held on this device.');
  assert.deepEqual(touched,[]);
});
