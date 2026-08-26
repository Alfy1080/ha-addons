ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install Node.js, npm, jq, and curl
RUN apk add --no-cache nodejs npm jq curl

# Set up application
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm ci --production 2>/dev/null || npm install --production
COPY server/ .

# Copy entrypoint
COPY run.sh /
RUN chmod a+x /run.sh

CMD ["/run.sh"]
