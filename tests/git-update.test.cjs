'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const ts = require('typescript');
const { simpleGit } = require('simple-git');

for (const hold of [undefined, '0']) {
test(`automatic application update preserves fetch/install/build/restart with hold ${hold ?? 'unset'}`, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pythia-git-test-'));
  const source = path.join(dir, 'source'); const device = path.join(dir, 'device');
  fs.mkdirSync(source);
  // Isolate the fixture from user Git configuration. No remote network or device is used.
  const gitEnv = { PATH: process.env.PATH, HOME: dir, USERPROFILE: dir, XDG_CONFIG_HOME: dir };
  for (const key of ['SystemRoot', 'TEMP', 'TMP']) if (process.env[key]) gitEnv[key] = process.env[key];
  const origin = simpleGit(source).env(gitEnv);
  try {
    await origin.init(); await origin.checkoutLocalBranch('main');
    await origin.addConfig('user.name','Synthetic Test'); await origin.addConfig('user.email','test@example.invalid');
    fs.writeFileSync(path.join(source,'fixture.txt'),'before');
    await origin.add('fixture.txt'); await origin.commit('Initial fixture');
    await simpleGit().env(gitEnv).clone(source, device);
    const local = simpleGit(device).env(gitEnv);
    assert.equal((await local.remote(['get-url','origin'])).trim().replaceAll('\\','/'), source.replaceAll('\\','/'));
    fs.writeFileSync(path.join(source,'fixture.txt'),'after');
    await origin.add('fixture.txt'); await origin.commit('Updated fixture');
    const file = path.join(__dirname,'../src/services/systemService.ts');
    const parsed = ts.createSourceFile(file, fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
    const cls = parsed.statements.find(n => ts.isClassDeclaration(n) && n.name.text === 'SystemService');
    const method = cls.members.find(n => n.name?.getText(parsed) === 'checkForUpdates');
    const js = ts.transpileModule('class Subject {' + method.getText(parsed) + '}; Subject;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    const commands = []; let restarted = 0;
    const subject = vm.runInNewContext(js,{
      git:local, OFFICIAL_GIT_BRANCH:'main',
      process:{env:{PYTHIA_UPDATE_HOLD:hold},execPath:process.execPath,version:process.version,cwd:process.cwd}, join:path.join,
      execFilePromise:async(command,args)=>({stdout:args[0] === '--version' ? process.version : ''}),
      execPromise:async command=>{commands.push(command); return {stdout:'fixture build/install'};},
      logger:{info(){},error(){}}
    });
    subject.ensureCanonicalGitRemote = async()=>false;
    subject.restartApp = ()=>{restarted++;};
    assert.equal((await subject.checkForUpdates()).code,200);
    assert.equal(fs.readFileSync(path.join(device,'fixture.txt'),'utf8'),'after');
    assert.deepEqual(commands,['npm ci','npm run build']); assert.equal(restarted,1);
    assert.equal((await subject.checkForUpdates()).message,'No updates found. The app is up to date.');
    assert.equal(restarted,1);
    // The existing legacy-remote migration uses these same methods.
    await local.remote(['set-url','origin',source]);
    await local.reset(['--hard','origin/main']);
    assert.equal(await local.revparse(['HEAD']),await origin.revparse(['HEAD']));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
}

