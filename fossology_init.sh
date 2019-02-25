#!/bin/bash

./docker-entrypoint.sh &

RETRIES=5

until /etc/init.d/postgresql status | grep online > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  echo "Waiting for postgres server, $((RETRIES--)) remaining attempts..."
  sleep 5
done

echo "postgres status online!"
sleep 5

# Build the knowledgebase file so we can pick it up in the next stage of the build
/usr/local/share/fossology/monk/agent/monk -s /tmp/monk_knowledgebase
