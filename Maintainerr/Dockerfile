# -----------------------------------------------------------------------------
# STAGE 1: Fetch the upstream image
# -----------------------------------------------------------------------------
FROM jorenn92/maintainerr:latest AS upstream

# -----------------------------------------------------------------------------
# STAGE 2: The Clean Slate
# We start from a fresh node:20-alpine image (the exact same base OS the app 
# was compiled for). This strips away ALL upstream Docker metadata, meaning the 
# "VOLUME /opt/data" instruction is permanently erased.
# -----------------------------------------------------------------------------
FROM node:20-alpine

USER root

# Install jq for reading Home Assistant options
RUN apk add --no-cache jq bash tzdata ca-certificates

# Copy ONLY the fully compiled application from the upstream image.
# Because the base OS perfectly matches, better-sqlite3 will NOT crash.
COPY --from=upstream /opt/app /opt/app

# Since the VOLUME metadata is gone, Docker will no longer lock this directory!
# We can safely create a hard symlink routing /opt/data straight to Home 
# Assistant's permanent /config bind mount (Host OS: addon_configs/maintainerr).
RUN ln -s /config /opt/data

# Match the necessary upstream environment variables
ENV NODE_ENV=production \
    DATA_DIR=/config

# Copy our startup script
COPY run.sh /run.sh
RUN chmod +x /run.sh

WORKDIR /opt/app

# Set our script as the entrypoint
CMD [ "/run.sh" ]