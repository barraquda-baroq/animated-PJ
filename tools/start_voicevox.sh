#!/usr/bin/env bash
# Start the official VOICEVOX ENGINE (CPU) extracted from the Docker Hub image voicevox/voicevox_engine:cpu-latest.
# Only run this with the user's permission (it executes a downloaded binary).
ENGINE=/home/user/voicevox/engine_root/opt/voicevox_engine
nohup "$ENGINE/run" --host 127.0.0.1 --port 50021 --cpu_num_threads 4 > /tmp/claude-0/voicevox.log 2>&1 &
for i in $(seq 1 60); do curl -s http://127.0.0.1:50021/version && echo " VOICEVOX ready" && exit 0; sleep 2; done
echo "VOICEVOX failed to start"; tail -20 /tmp/claude-0/voicevox.log; exit 1
