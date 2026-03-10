# Use the official Honeygain image to grab the correct pre-compiled binary
FROM honeygain/honeygain:latest AS honeygain-bin

# Build the final addon image using Debian to match HA addon standards
FROM debian:bookworm-slim

# Install necessary utilities for parsing Home Assistant configs
RUN apt-get update && \
    apt-get install -y \
    jq \
    bash \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# The inspect file shows WorkingDir is /app
WORKDIR /app

# Copy the Honeygain files from the official image stage
COPY --from=honeygain-bin /app /app

# Configure the runtime environment
ENV DEBIAN_FRONTEND=noninteractive

# Copy and setup the startup script
COPY run.sh /run.sh
RUN chmod +x /run.sh

CMD [ "/run.sh" ]