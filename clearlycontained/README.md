# ClearlyContained

To harvest information about Docker containers we run the crawler outside of the context of a container.
This allows us to spin up arbitrary containers and detect embedded packages

This is the general workflow

1. `docker pull <imageName>:<tag>`
2. `docker inspect <imageName>:<tag>`
3. pick out sha256 from the RepoDigests as the permanent revision
4. `docker run --entrypoint "apk" <imageName>@sha256:<imageSha> info`
5. `docker run --entrypoint "dpkg" <imageName>@sha256:<imageSha> --list`
6. [Pending] run detector like fossa to find npm-like packages in the image
7. queue up all packages found to be inspected individually

Since we are deploying the application onto a VM, instead of using the DockerFile we have to setup the environment. This folder contains the required configuration.

## Install prerequesites

See `install_prereqs.sh` for details on how to get them. These are things like git/node/docker/etc needed to run and manage the app.

## Configuration

Set the required environment variables, just as if you were using the DockerFile using any painless-config method
Make sure you set these variables in addition

```
"CRAWLER_HOST": "clearlycontained",
"CRAWLER_OPTIONS": "./config/containedConfig"
```

## Startup

We use crontab to initialize the app when the VM starts by running `startup.sh`

```
# make it executable
sudo chmod 755 /home/clearlycontained/startup.sh

# set the crontab
sudo crontab -e
-> add @reboot sh /home/clearlycontained/startup.sh
```

## Service

We use systemd to manage the running service with the configuration in `clearlycontained.service`.
Systemd will start the service once the rest of the system is ready by running `npm start` where the application lives.

Make sure to place this file in `/etc/systemd/system/clearlycontained.service`.

### Manually enable service

```
systemctl enable clearlycontained.service
```

### Manually start service

```
systemctl start clearlycontained.service
```

### Manually stop service

```
systemctl stop clearlycontained.service
```

### Check service status

```
systemctl status clearlycontained
```

### Reload system for service changes

```
systemctl daemon-reload
```
