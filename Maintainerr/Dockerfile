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

# Redirect Maintainerr's internal data directory to Home Assistant's /share map
# This guarantees data persists across reboots and is easily accessible on the host machine
RUN rm -rf /opt/data && ln -s /share/Maintainerr /opt/data

# Configure the runtime environment
ENV DEBIAN_FRONTEND=noninteractive

# Copy the custom run script to inject variables
COPY run.sh /run.sh
RUN chmod +x /run.sh

# Override the original entrypoint with our script
CMD [ "/run.sh" ]