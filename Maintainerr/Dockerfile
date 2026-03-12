# Stage 1: Extract the application from the upstream image
FROM jorenn92/maintainerr:latest AS upstream

# Stage 2: Build a fresh, clean image with NO inherited VOLUME directives
FROM node:20-alpine

# We need to run as root to install packages and set up the Home Assistant environment
USER root

# Install jq to parse options.json and other utilities
RUN apk add --no-cache jq bash tzdata ca-certificates

# Copy ONLY the application files from the upstream image, leaving the cursed VOLUME metadata behind
COPY --from=upstream /opt/app /opt/app

# Create a permanent symlink pointing /opt/data directly to Home Assistant's /data bind mount.
# Because there is NO VOLUME instruction in this clean image, Docker will NOT create an ephemeral volume!
RUN ln -s /data/maintainerr /opt/data

# Configure the runtime environment
ENV NODE_ENV=production

# Copy the custom run script to inject variables
COPY run.sh /run.sh
RUN chmod +x /run.sh

WORKDIR /opt/app

# Override the original entrypoint with our script
CMD [ "/run.sh" ]