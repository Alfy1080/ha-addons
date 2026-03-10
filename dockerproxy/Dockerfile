ARG BUILD_FROM
FROM tecnativa/docker-socket-proxy:latest

# Install jq and bash for the run script
USER root
RUN apk add --no-cache jq bash

COPY run.sh /ha-run.sh
RUN chmod a+x /ha-run.sh

ENTRYPOINT [ "/ha-run.sh" ]