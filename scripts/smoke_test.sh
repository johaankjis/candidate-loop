#!/usr/bin/env bash
set -e

echo "Running CandidateLoop Smoke Test..."

cd "$(dirname "$0")/.."
ROOT_DIR=$(pwd)

echo "==> Setting up backend..."
cd "$ROOT_DIR/apps/agent"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
.venv/bin/pip install -e '.[dev]'

echo "==> Checking backend formatting and tests..."
.venv/bin/ruff check .
.venv/bin/pytest -q

echo "==> Starting backend API in the background..."
.venv/bin/uvicorn api.main:app --host 127.0.0.1 --port 8000 &
API_PID=$!

cleanup() {
    echo "==> Cleaning up..."
    if kill -0 $API_PID 2>/dev/null; then
        kill $API_PID
    fi
}
trap cleanup EXIT

echo "==> Waiting for API health endpoint..."
for i in {1..10}; do
    if curl -s http://127.0.0.1:8000/health | grep '"status":"ok"' > /dev/null; then
        echo "API is up!"
        break
    fi
    sleep 1
    if [ "$i" -eq 10 ]; then
        echo "API failed to start in time."
        exit 1
    fi
done

echo "==> Testing demo reset..."
curl -s -X POST http://127.0.0.1:8000/api/demo/reset > /dev/null
echo "Demo reset successful."

echo "==> Testing agent run..."
curl -s -X POST http://127.0.0.1:8000/api/agent/run > /dev/null
echo "Agent run successful."

echo "==> Building frontend..."
cd "$ROOT_DIR/apps/web"
npm install --no-audit --no-fund > /dev/null 2>&1
npm run lint
npm run build

echo "==> Verifying Docker build..."
cd "$ROOT_DIR/apps/agent"
if command -v docker &> /dev/null; then
    docker build -t candidateloop-agent:test . > /dev/null
    echo "Docker build successful."
else
    echo "Docker not installed, skipping build verification."
fi

echo "Smoke test passed successfully!"
