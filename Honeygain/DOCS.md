Configuration & Setup

This add-on runs Honeygain to passively share your internet connection and earn rewards directly from your Home Assistant instance.

Configuration Options

You can configure your settings directly through the Home Assistant UI in the add-on's Configuration tab.

email (Required)

The email address associated with your Honeygain account.

password (Required)

The password for your Honeygain account. This is stored securely by Home Assistant as a secret.

device_name (Optional)

The name of the device as it will appear in your Honeygain dashboard.
Default: HomeAssistantOS

Troubleshooting

If the add-on stops immediately or doesn't seem to connect:

Check the Log tab: Ensure your email and password are correct. Invalid credentials will cause the application to crash on startup.

Account Verification: Verify your account is fully active. If Honeygain requires further verification steps (like email confirmation or multi-factor authentication), it might block the CLI login.