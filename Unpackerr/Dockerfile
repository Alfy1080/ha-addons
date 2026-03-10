# We use the official Unpackerr image to grab the correct pre-compiled binary
FROM golift/unpackerr:latest AS unpackerr-bin

# We build the final addon image using Debian to match your other addons
FROM debian:bookworm-slim

# Install necessary utilities
RUN apt-get update && \
    apt-get install -y \
    jq \
    bash \
    curl \
    tzdata \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the Unpackerr binary from the official image stage
COPY --from=unpackerr-bin /unpackerr /usr/local/bin/unpackerr

# Configure the runtime environment
ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /

COPY run.sh /run.sh
RUN chmod +x /run.sh

CMD [ "/run.sh" ]
