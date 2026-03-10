Configuration & Setup

This add-on runs Unpackerr to automatically extract archives for your Radarr, Sonarr, Lidarr, or Readarr instances.

Volume Mounts & Paths (Important)

Because this is running as a Home Assistant add-on, it has direct access to your Home Assistant share and media folders.
If you previously used a Docker mapping like /mnt/data/supervisor/share/SynologyTorrents:/downloads, your path inside this add-on configuration should simply be /share/SynologyTorrents.

Configuration Options

timezone (Optional)

The timezone for logs.
Default: Europe/Bucharest

sonarr / radarr

You can configure both Sonarr and Radarr directly through the Home Assistant UI.

url: The full URL to your instance (e.g., http://192.168.1.200:8989/sonarr).

api_key: Your API Key. You can find this in your instance under Settings -> General -> Security. (This will be stored securely as a password/secret in Home Assistant).

paths: A list of paths Unpackerr should watch for extractions. You can add as many paths as you need.

Troubleshooting

If the add-on stops immediately or doesn't seem to extract:

Check the Log tab: Ensure your API keys are correct and there are no connection refused errors.

Verify Paths: Make sure the path you entered in paths actually matches where the files are being downloaded to inside the /share folder.
