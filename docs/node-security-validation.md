# Candidate validation

Status: draft candidate, not production deployed. Fleet `main` remains `235ee7668908879b995c9e203599caa1aaf38ab4`. No customer site, shared service, older repository or Pythia 2.0/2.1 was changed. See the [canary and rollback runbook](node-security-2026-10.md).

## Automated checks

Application/test source commit: `ef9d4dc9f6c314ac3b2f9dff0cf6d3fa55cab213`. Documentation may advance independently; compare the source diff before reusing this evidence.

- Windows: clean install and Bash build on Node 22.23.4; all 11 tests pass on 22.23.4 and 24.22.1. The existing cmd.exe build fails on `rm`; this is not a new regression.
- [Linux CI](https://github.com/Pythia-Scorecard/pythia-edge-app/actions/runs/40414040907): clean install, runtime policy, all 11 tests and build pass on Node 22.23.4 and 24.22.1.
- Office Pi 5 / Debian 12 ARM64 / UM02 microphone: clean install, build and all 11 tests pass on Node 22.23.4.
- Tests cover synthetic WAV/DOA upload, retention and retry, runtime rejection, real disposable Git fetch/pull/reset, and the update hold at startup, scheduled and HTTP entry points. Invalid settings fail closed; unset or `0` preserves guarded updates. Scheduled behavior was exercised by invoking the actual callback in an isolated test, not by waiting until 03:00.

## Office integration, October 26

The candidate used a separate PM2 home, systemd unit, recording queue, synthetic token and localhost receiver. The selected source was held with `PYTHIA_UPDATE_HOLD=1`. Private backups were preserved and a bounded supervisor restored the original app on test exit.

| Check | Result |
|---|---|
| Actual app and PM2 executable; systemd MainPID | Node 22.23.4 for both; daemon PID matched service MainPID |
| Held startup and HTTP update request | Hold reported; no Git calls or update restart |
| Recording, socket disconnect/reconnect | Passed while held |
| Synthetic queued audio during receiver outage | Retained; uploaded once after recovery |
| PM2 saved environment and systemd restart | Hold persisted; recording recovered |
| Lift hold against device-local Git fixture | Real fetch/pull, `npm ci`, build and PM2 restart passed |
| Reapply hold and restart service | Hold restored; recording continued |
| Python helper | PyUSB present and helper source unchanged |
| Restore original application/runtime | Passed; actual app and daemon Node 18.20.8, original commit, HTTP 200 and growing recording |

The successful run ended at 22:47:44 UTC. Final read-back at 22:48:20 UTC found the original startup service enabled/active, its MainPID matching PM2, and the test service inactive with no boot enablement. Original environment, manifest and modified lockfile matched the private backup. Test audio stayed on the office device. The local update marker was never published to GitHub; it was the only tree difference from the tested source.

Two test-harness failures were preserved separately: a recording-growth check ran before asynchronous microphone startup completed, and a typo in the local Git wrapper blocked the fixture update. Both helpers were corrected and the complete integration rerun passed. Neither required an application change.

The earlier `e809e452` candidate passed a physical reboot and restoration on October 22; its saved result was verified October 26. The new hold candidate was tested through service restart/resurrection, not a new physical reboot. Recovery here returns to the preserved original installation; restoration from a backup archive remains a separate rollout gate. The original Node 18 service is an availability fallback, not a security-patched deployment.

## Remaining limits

Other OS/architecture/microphone combinations, six-channel ReSpeaker/DOA, live worker Python/GPU transcription, customer-device startup and production end-to-end processing remain unverified. Old updaters do not understand this hold. Keep fleet `main` unchanged and obtain approval for the exact first customer canary after its inventory and recovery preparation.

simple-git 4.0.2 is an intentional security major upgrade and uses its named export without disabling safety guards. HTTP/form-data/system-information and compatible transitive fixes are included. The earlier production dependency audit still reports 24 affected packages (17 high, 6 moderate, 1 low), primarily existing npm 10/nodemon/tooling/cron chains; this hold adds no dependency changes. No forced major upgrades were used. Audit findings are not proof of exploitability or complete security clearance.
