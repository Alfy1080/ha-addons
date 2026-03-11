# Use the official Maintainerr image as the base
FROM jorenn92/maintainerr:latest

# We need to run as root to install packages and set up the Home Assistant environment
USER root

# Install jq to parse options.json. We use a conditional check to handle both Alpine and Debian bases
RUN if [ -f /etc/alpine-release ]; then \
        apk add --no-cache jq bash tzdata ca-certificates sed; \
    else \
        apt-get update && \
        apt-get install -y jq bash tzdata ca-certificates sed && \
        rm -rf /var/lib/apt/lists/*; \
    fi

# Configure the runtime environment
ENV DEBIAN_FRONTEND=noninteractive

# Copy the custom run script to inject variables
COPY run.sh /run.sh
RUN chmod +x /run.sh

# Override the original entrypoint with our script
ENTRYPOINT [ "/run.sh" ]