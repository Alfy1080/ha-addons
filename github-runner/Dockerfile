FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y \
    curl \
    jq \
    git \
    openssh-client \
    libicu-dev \
    tar \
    bash \
    sudo \
    && rm -rf /var/lib/apt/lists/*

ENV RUNNER_ALLOW_RUNASROOT=1
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /actions-runner

COPY run.sh /run.sh
RUN chmod +x /run.sh

CMD [ "/run.sh" ]