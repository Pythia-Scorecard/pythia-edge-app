# Node security update — October 21, 2026

## Status and runtime choice

This is a prepared change, not evidence of a production upgrade. Do not merge or deploy until the running application, PM2 daemon and startup service have been inventoried and the owner approves the canary.

Use Node **22.23.4** on an existing supported 22.x installation and **24.22.1** on an existing supported 24.x installation. The exact version in .nvmrc is a reproducible development/build default, not a claim about production. Both versions are exercised by the proposed CI. Node 26 has not been selected or validated for this application. If production is already on 26, stop and review it rather than silently downgrading it.

The [official October advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) fixes DNS, TLS, Brotli and other runtime vulnerabilities. The [release index](https://nodejs.org/dist/index.json) was checked for newer security releases on October 21. Recheck it at rollout time.

Node 14/16/18/20 are obsolete for this rollout. An obsolete installed runtime requires a staged compatibility migration. Never assume a README version is the installed version. Linux armv7l devices must stay on the tested Node 22 line; Node 24's official builds do not provide armv7l. Check OS, glibc, architecture, audio/USB libraries and native modules on the actual device.

## Reproducible validation

Select the reviewed version, then run:

```sh
node --version
npm ci
npm run test:runtime
npm test --if-present
npm run build
```

Use Bash for the edge application's existing build command. A Windows cmd.exe failure on its existing `rm` command is not an application regression. Do not point tests at production databases, queues, email providers or customer recordings.

The package engine and lifecycle checks reject obsolete or unpatched runtimes. They do not change an installed runtime. PM2 can bypass npm lifecycle hooks: inspect its real processes separately. A successful build alone does not establish production safety.

## Required live inventory (read-only)

Record these fields for each application, without printing environment variables, credentials, PM2 dumps or raw user/audio data:

- Repository remote (redact any embedded credentials), branch, deployed commit, and whether deployed files differ from that commit. Preserve existing fixes and local build/lockfile changes.
- Hosting account/region, instance ID or device ID, OS release, `uname -m`, and libc version.
- For every application PID and PM2 daemon PID, `readlink /proc/PID/exe` and `/proc/PID/exe --version`. Do not substitute interactive `node -v`.
- PM2 application name, status, interpreter path, working directory and start script. Parse only those fields from PM2's JSON inside the host; do not print its environment.
- The startup unit name, user, executable/interpreter and PATH, enabled/active state, and whether its absolute paths still exist. Inspect relevant fields privately; unit environments can contain secrets.
- For containers: running container ID, image ID and immutable digest, deployed application commit, OS/architecture, and Node from inside that running container. A Dockerfile tag is not running-image evidence.
- For Amplify: repository/branch, app platform, successful deployed job commit, build image/Node version, output mode, and actual compute runtime if SSR. Build Node does not prove deployed SSR Node. A genuinely static deployment has no server Node, but its build environment still needs a patched runtime. Confirm this from deployed artifacts and hosting settings.

For repositories with `scripts/check-pm2.cjs`, after the approved runtime switch run it as the service owner:

```sh
node scripts/check-pm2.cjs APP_NAME
```

It checks live application and PM2 executable versions against the current shell and policy, without dumping secrets. It refuses a missing daemon. It does not establish systemd configuration, commit identity, device health or end-to-end processing; those are separate gates.

For repositories with `scripts/provision-node.sh`, the script only prepares a checksum-verified official Linux runtime under /opt alongside the old runtime. It does not switch PATH, PM2, systemd or an application. Do not run it on production before approval. It refuses unsupported architectures and existing destination directories.

## Approval and canary gates

1. Complete live inventory and identify the one canonical deployment for each application. Do not deploy the old NebulaCodeX26 copy as a second application. Do not revive an archived repository or change Pythia 2.0/2.1, firmware or standalone Python components.
2. Capture rollback artifacts privately: previous deployed commit plus local modifications, lockfile, built output, native node_modules or reproducible old-runtime install, exact old Node binary/archive or container digest, PM2 version and saved process list, startup unit and interpreter/PATH. Protect process dumps and environment files as secrets. Verify restoration on the test host.
3. Test the complete candidate in staging with isolated data/queues: correct/wrong login, permission-denied paths, dashboard pages/API rewrites, synthetic audio upload, transcription and Python/CUDA helper, analysis jobs and results. Confirm no duplicate jobs and no lost queued recordings.
4. Test one non-customer device of each actual architecture/OS combination: USB/audio capture, disconnect/reconnect, durable queue recovery, application update, PM2 restart, systemd service restart and a real reboot. CI on x64 is not a substitute for ARM hardware.
5. Present evidence and obtain approval for one production canary device and, if required, one isolated worker plus staging-to-production service releases. Do not start paid worker capacity without approval. Keep all other devices on their current release. Observe at least 24 hours and a complete representative processing cycle before requesting a wider rollout.

## Automatic deployment hazards

A merge can be a deployment. The backend's main-push workflow deploys to EC2; the edge's current scheduled updater follows main. Hold these PRs until runtime migration, rollback and canary isolation are ready. Existing deployed updater code does not acquire the new guard until it has already fetched the update. Therefore the new guard alone cannot control the first fleet rollout.

Do not merge edge main to run a canary. Stage a selected commit on the test/canary device with its automatic update path held there under the approved rollout, leaving fleet main unchanged. Verify the fleet's update behavior before any later merge.

## Stop conditions and rollback

Stop on any auth/permission regression, lost or duplicate audio/job, unexplained queue growth, failed reconnect, restart loop, missing Python/CUDA/USB dependency, runtime mismatch, or failed startup/reboot. Also stop if 5xx exceeds 1% for five minutes or processing latency exceeds twice the comparable baseline for 15 minutes. Adjust numerical thresholds only with a recorded baseline and owner approval.

Stop further rollout first. Retain queued audio and jobs; never purge queues or reset production recordings to hide failures. Restore the previous application artifact together with its compatible native modules and exact old runtime. Restore the PM2 daemon/interpreter and startup unit/PATH, then verify /proc executables, service restart and the synthetic end-to-end case again. A Git revert by itself does not roll back Node. The previous runtime may remain vulnerable; rollback is a temporary availability measure requiring a follow-up patch plan.

## Completion evidence

After an approved deployment, record actual running Node executables, application commit, PM2/systemd or container identity, service health, synthetic end-to-end outcome, queue integrity and the monitoring window. Until these exist, label the application **unknown/unverified**, not safe or patched in production.

