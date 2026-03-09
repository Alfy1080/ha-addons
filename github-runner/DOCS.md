Configuration & Setup

To get this runner working, you must configure it to talk to your specific GitHub repository.

Prerequisites

Before starting the add-on, you must generate an SSH key on your Home Assistant instance so the runner can pull your code.

In your Home Assistant terminal, run:
```bash
mkdir -p /config/.ssh
ssh-keygen -t ed25519 -C "ha-runner" -f /config/.ssh/id_ed25519 -N ""
```
Copy the contents of the generated .pub file and add it as a Deploy Key in your GitHub repository settings.

Configuration Options

github_repo (Required)

The target GitHub repository where the runner will register itself.
Format: USERNAME/REPOSITORY_NAME (e.g., Alfy1080/Heimdall-PROD).

github_pat (Required)

A GitHub Personal Access Token (PAT).
This must be a "Classic" token with the repo scope enabled so it has permission to generate runner registration tokens.

runner_name (Optional)

The name this runner will use when it appears in your GitHub Repository -> Settings -> Actions -> Runners list.
Default: ha-runner (You should change this to ha-prod-runner or ha-dev-runner depending on the instance).

runner_labels (Optional)

Comma-separated labels used in your GitHub Actions Workflow files (the runs-on: key) to target this specific runner.
Default: self-hosted
Recommendation: Use self-hosted,prod for production and self-hosted,dev for development.

Troubleshooting

If the add-on stops immediately, check the Log tab.

"Configuration Missing": You forgot to fill out the github_repo or github_pat.

"Failed to get registration token": Your PAT is invalid, expired, or doesn't have the repo scope.

"No such file or directory": Your SSH keys are missing from /config/.ssh/.