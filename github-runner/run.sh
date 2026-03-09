#!/bin/bash
set -e

CONFIG_PATH=/data/options.json
REPO=$(jq --raw-output '.github_repo' $CONFIG_PATH)
PAT=$(jq --raw-output '.github_pat' $CONFIG_PATH)
RUNNER_NAME=$(jq --raw-output '.runner_name' $CONFIG_PATH)
LABELS=$(jq --raw-output '.runner_labels' $CONFIG_PATH)

echo "Starting GitHub Runner setup for $REPO..."

ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then RUNNER_ARCH="x64";
elif [ "$ARCH" = "aarch64" ]; then RUNNER_ARCH="arm64";
elif [ "$ARCH" = "armv7l" ]; then RUNNER_ARCH="arm";
else echo "Unsupported architecture: $ARCH"; exit 1; fi

if [ ! -f "config.sh" ]; then
    echo "Downloading GitHub Runner for $RUNNER_ARCH..."
    RUNNER_VERSION=$(curl -s "[https://api.github.com/repos/actions/runner/releases/latest](https://api.github.com/repos/actions/runner/releases/latest)" | jq -r '.tag_name' | sed 's/v//')
    curl -o actions-runner-linux.tar.gz -L "[https://github.com/actions/runner/releases/download/v$](https://github.com/actions/runner/releases/download/v$){RUNNER_VERSION}/actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
    tar xzf ./actions-runner-linux.tar.gz
    rm actions-runner-linux.tar.gz
fi

echo "Requesting runner registration token..."
REG_TOKEN=$(curl -sX POST -H "Authorization: token ${PAT}" -H "Accept: application/vnd.github.v3+json" "[https://api.github.com/repos/$](https://api.github.com/repos/$){REPO}/actions/runners/registration-token" | jq -r '.token')

if [ "$REG_TOKEN" == "null" ] || [ -z "$REG_TOKEN" ]; then
    echo "Failed to get registration token. Check your PAT permissions and Repo name."
    exit 1
fi

echo "Configuring runner..."
./config.sh --url "[https://github.com/$](https://github.com/$){REPO}" --token "${REG_TOKEN}" --name "${RUNNER_NAME}" --labels "${LABELS}" --unattended --replace

cleanup() {
    echo "Removing runner..."
    REM_TOKEN=$(curl -sX POST -H "Authorization: token ${PAT}" -H "Accept: application/vnd.github.v3+json" "[https://api.github.com/repos/$](https://api.github.com/repos/$){REPO}/actions/runners/remove-token" | jq -r '.token')
    ./config.sh remove --token "${REM_TOKEN}"
    exit 0
}
trap cleanup SIGTERM SIGINT

mkdir -p ~/.ssh
echo "StrictHostKeyChecking no" > ~/.ssh/config
cp /config/.ssh/id_ed25519 ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519

echo "Starting runner..."
./run.sh & wait $!
