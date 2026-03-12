# Use the official Maintainerr image as the base
FROM jorenn92/maintainerr:latest

# We need to run as root to install packages and set up the Home Assistant environment
USER root

# Install jq to parse options.json. We use a conditional check to handle both Alpine and Debian bases
RUN if [ -f /etc/alpine-release ]; then \
        apk add --no-cache jq bash tzdata ca-certificates; \
    else \
        apt-get update && \
        apt-get install -y jq bash tzdata ca-certificates && \
        rm -rf /var/lib/apt/lists/*; \
    fi

# WORKAROUND FOR DOCKER VOLUME LOCK:
# The base image defines a strict VOLUME for /opt/data which traps database writes into an ephemeral mount.
# By copying the app to /usr/local/app, its internal relative paths (e.g., ../../data) will resolve to /usr/local/data.
# We then symlink /usr/local/data directly to Home Assistant's persistent /data/maintainerr directory.
RUN cp -a /opt/app /usr/local/app && \
    ln -s /data/maintainerr /usr/local/data

# Configure the runtime environment
ENV DEBIAN_FRONTEND=noninteractive

# Copy the custom run script to inject variables
COPY run.sh /run.sh
RUN chmod +x /run.sh

# Override the original entrypoint with our script
CMD [ "/run.sh" ]