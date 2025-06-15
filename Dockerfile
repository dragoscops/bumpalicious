FROM alpine:latest

RUN cd \
  \
  && apk add --no-cache bash curl jq git unzip \
  \
  && sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b /usr/local/bin \
  \
  && apk add --no-cache yq \
  \
  && apk add --no-cache deno \
  \
  && apk add --no-cache go \
  \
  && apk add --no-cache nodejs npm \
  \
  && apk add --no-cache python3 py3-pip \
  \
  && apk add --no-cache rust cargo && cargo install cargo-set-version \
  \
  && apk add --no-cache zig \
  \
  && mkdir /app \
  \
  && npm i -g pino-pretty

VOLUME ["/app"]

WORKDIR /app

ENTRYPOINT ["task"]
