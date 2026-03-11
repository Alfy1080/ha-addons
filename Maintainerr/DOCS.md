Configuration & Setup

This add-on runs Maintainerr directly inside your Home Assistant instance. Maintainerr is a tool used to automatically remove media from your Plex server based on rules you define.

Volume Mounts & Paths

Because this is running as a Home Assistant add-on, it has direct access to your Home Assistant /share and /media folders.
If Maintainerr needs direct file-system access to delete your media (rather than relying on Radarr/Sonarr to do it), make sure your media folders are mapped properly.
For example, if your movies are in the Home Assistant network share under movies, the path inside Maintainerr will be /share/movies.

Configuration Options

timezone (Optional)

The timezone for logs and cron job execution.
Default: Europe/Bucharest

debug (Optional)

Enable debug logging for deeper insights into what Maintainerr is doing behind the scenes.
Default: false

base_path (Optional)

If you are running Home Assistant behind a reverse proxy and want to host Maintainerr under a sub-folder (e.g., /maintainerr), you can specify that base path here. Leave blank for standard root (/) access.

Data Persistence

All your Maintainerr rules, settings, and local database are automatically saved to Home Assistant's persistent /data directory. Your configurations will survive add-on restarts and updates.

Troubleshooting

If the add-on stops immediately or you cannot reach the UI:

Check the Log tab: Ensure there are no database permission errors or issues mapping the timezone.

Ports: Ensure port 6246 is not already being used by another Home Assistant add-on.