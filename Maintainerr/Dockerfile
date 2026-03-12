# Use the official Maintainerr image as the base
FROM jorenn92/maintainerr:latest

# We need to run as root to install packages and set up the Home Assistant environment
USER root

# Install jq to parse options.json, plus bindfs and fuse to solve the Docker volume lock
RUN if [ -f /etc/alpine-release ]; then \
        apk add --no-cache jq bash tzdata ca-certificates fuse bindfs; \
    else \
        apt-get update && \
        apt-get install -y jq bash tzdata ca-certificates fuse bindfs && \
        rm -rf /var/lib/apt/lists/*; \
    fi && \
    echo "user_allow_other" >> /etc/fuse.conf

# Configure the runtime environment
# We set DATA_DIR to /config/data so the app natively aims for the persistent directory
ENV DEBIAN_FRONTEND=noninteractive \
    DATA_DIR=/config/data

# Copy the custom run script to inject variables
COPY run.sh /run.sh
RUN chmod +x /run.sh

# -----------------------------------------------------------------------------
# THE ULTIMATE PERSISTENCE WORKAROUND
# We wrap the user's run.sh with a script that uses bindfs (FUSE).
# This mounts Home Assistant's permanent /config folder directly OVER the 
# ephemeral /opt/data Docker volume. This replicates the exact behavior of 
# a docker-compose volume bind mount, forcing all data to the Host OS!
# -----------------------------------------------------------------------------
RUN echo '#!/bin/bash' > /wrapper.sh && \
    echo 'set -e' >> /wrapper.sh && \
    echo 'echo "======================================================"' >> /wrapper.sh && \
    echo 'echo " Executing Host OS Bind Mount Workaround..."' >> /wrapper.sh && \
    echo 'mkdir -p /config/data' >> /wrapper.sh && \
    echo 'chown -R node:node /config/data' >> /wrapper.sh && \
    echo 'if command -v bindfs >/dev/null; then' >> /wrapper.sh && \
    echo '    echo " Mounting /config/data over /opt/data using FUSE..."' >> /wrapper.sh && \
    echo '    bindfs -o nonempty,allow_other /config/data /opt/data || echo "  Warning: FUSE mount skipped."' >> /wrapper.sh && \
    echo 'fi' >> /wrapper.sh && \
    echo 'echo "======================================================"' >> /wrapper.sh && \
    echo 'exec /run.sh' >> /wrapper.sh && \
    chmod +x /wrapper.sh

# Override the original entrypoint with our wrapper script
CMD [ "/wrapper.sh" ]