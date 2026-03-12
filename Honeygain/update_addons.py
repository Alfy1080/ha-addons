import json
import os
import re
import sys
import requests
from datetime import datetime

# Configure folders to skip or check
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def get_local_version(addon_dir):
    config_path = os.path.join(addon_dir, "config.yaml")
    if not os.path.exists(config_path):
        config_path = os.path.join(addon_dir, "config.json")
    
    if not os.path.exists(config_path):
        return None, None

    with open(config_path, "r") as f:
        content = f.read()
        
    # Simple regex to find version: "1.2.3" or version: 1.2.3
    match = re.search(r'^version: ["\']?([^"\']+)["\']?', content, re.MULTILINE)
    if match:
        return match.group(1), config_path
    return None, config_path

def update_version(addon_name, addon_dir, old_ver, new_ver, config_path):
    print(f"Updating {addon_name}: {old_ver} -> {new_ver}")
    
    # 1. Update config.yaml/json
    with open(config_path, "r") as f:
        content = f.read()
    
    # Regex replace version
    new_content = re.sub(
        r'^(version: )["\']?([^"\']+)["\']?',
        f'\\g<1>"{new_ver}"',
        content,
        flags=re.MULTILINE
    )
    
    with open(config_path, "w") as f:
        f.write(new_content)

    # 2. Update CHANGELOG.md
    changelog_path = os.path.join(addon_dir, "CHANGELOG.md")
    date_str = datetime.now().strftime("%Y-%m-%d")
    entry = f"\n## [{new_ver}] - {date_str}\n- Automatically updated to version {new_ver}\n"
    
    if os.path.exists(changelog_path):
        with open(changelog_path, "r") as f:
            cl_content = f.read()
        
        # Insert after the header or first line
        if "## [Unreleased]" in cl_content:
             cl_content = cl_content.replace("## [Unreleased]", f"## [Unreleased]\n{entry}")
        else:
             # Fallback: append
             cl_content += entry
             
        with open(changelog_path, "w") as f:
            f.write(cl_content)

def main():
    for item in os.listdir(ROOT_DIR):
        addon_dir = os.path.join(ROOT_DIR, item)
        updater_file = os.path.join(addon_dir, "updater.json")
        
        if os.path.isdir(addon_dir) and os.path.exists(updater_file):
            with open(updater_file, "r") as f:
                data = json.load(f)
            
            repo = data.get("repository")
            if not repo:
                continue
                
            # Fetch latest release from GitHub
            resp = requests.get(f"https://api.github.com/repos/{repo}/releases/latest")
            if resp.status_code == 200:
                latest_tag = resp.json().get("tag_name", "").lstrip("v")
                local_ver, config_path = get_local_version(addon_dir)
                
                if local_ver and latest_tag and local_ver != latest_tag:
                    update_version(item, addon_dir, local_ver, latest_tag, config_path)

if __name__ == "__main__":
    main()