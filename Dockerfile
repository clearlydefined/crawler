# Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
# SPDX-License-Identifier: MIT

#FROM node:8-alpine # switch back to node:8-alpine after removing Scancode
FROM node:8
ENV APPDIR=/opt/service
#RUN apk update && apk upgrade && \
#    apk add --no-cache bash git openssh

# Scancode
RUN curl -sL https://github.com/nexB/scancode-toolkit/releases/download/v2.9.2/scancode-toolkit-2.9.2.tar.bz2 | tar -C /opt -jx \
  && /opt/scancode-toolkit-2.9.2/scancode --version
ENV SCANCODE_HOME=/opt/scancode-toolkit-2.9.2

# FOSSology
WORKDIR /opt
RUN git clone https://github.com/fossology/fossology.git

WORKDIR /opt/fossology
RUN apt-get update && \
    apt-get install -y lsb-release sudo postgresql php5-curl libpq-dev libdbd-sqlite3-perl libspreadsheet-writeexcel-perl && \
    /opt/fossology/utils/fo-installdeps -e -y && \
    rm -rf /var/lib/apt/lists/*
RUN curl -sS https://getcomposer.org/installer | php && \
    mv composer.phar /usr/local/bin/composer
RUN /opt/fossology/install/scripts/install-spdx-tools.sh
RUN /opt/fossology/install/scripts/install-ninka.sh
RUN make install
RUN /etc/init.d/postgresql start
RUN /usr/local/lib/fossology/fo-postinstall
ENV FOSSOLOGY_HOME=/usr/local/etc/fossology/mods-enabled

COPY package*.json /tmp/
RUN cd /tmp && npm install --production
RUN mkdir -p "${APPDIR}" && cp -a /tmp/node_modules "${APPDIR}"

WORKDIR "${APPDIR}"
COPY . "${APPDIR}"

ENV PORT 4000
EXPOSE 4000
ENTRYPOINT ["npm", "start"]
