# New developer rampup / training

These are suggested steps / tips to get familiar with the codebase:

- Two branches: master/prod correspond to dev/prod

0. Clone the repo
0. Run `npm install`
0. `npm test` to run tests
0. Try `npm audit fix` for a simple contribution
0. Open a PR to master
    - AzDo will run clearlydefined.crawler pipeline: npm install / npm test
    - After merge, crawler-pipeline will run, builds and pushes to ACR
    - Release step: deploys to cdcrawler-dev app service, restarts (dev crawler is still app service)
0. After successful dev deploy, can merge and push to prod branch
    - Prod build pipeline will build and push to Docker Hub, no actual deploymen.

## Dockerfile
-	based on node
-	installs scancode/lincesee, installs Ruby (for licensee), 
-	Sets all env vars
-	Npm install with production
-	Then starts



## Deployment
- Image is pushed to: https://hub.docker.com/r/clearlydefined/crawler
- Webhooks in docker hub for donated crawler resources, signals them to re-pull cthe crawler Docker image
- There are also donated crawler resources that don't have a webhook. These poll, monitor, or pull the image regularly.
- In effect: once crawler is pushed, will be deployed “eventually consistent” not all at once. Some versions of the old crawler and new crawler will be running at the same time.

[Tools repo: run.sh](https://github.com/clearlydefined/tools/blob/master/run.sh)
- Can be used for VM based crawlers
-	Cron job that checks for new docker crawler image, if new image: restart crawlers
-	Hardcoded # of docker containers, based on vcpu, based on experimentation
-	Where doe secrets come from? Not sure, need to investigate

## Local dev
- If you want to run locally, you’ll need to install scancode/licensee on your local machine with paths/etc. Easier to run docker image.
- There is a linux Dockerfile to build a container, that is the target environment
- Look at quick start in [README](/README.md#quick-start)
- Template.env.json has minimal settings: file storage provider, memory incoming queue
- “Queueing work with crawler”: instructions once crawler is running
    -	Could bring up service and crawler, and send harvest to service
    -	Easier to work with just crawler, example post message in readme
- See “Build and run docker image locally” in readme, need config file
- Run docker build command
- To get dev config: go to portal: cdcrawler-dev, Settings->Configuration
- Uses docker’s “env-file”, key/value environment vars, different than env.json
- From dev, change *crawler/harvest azblob_container_name, queue prefix, harvests, queue name, to be your own personal names
- Crawler_service_auth_token: the token needed for the harvest queue curl command
- When you use the curl command directly on the crawler, it puts a message on its own queue. You could just copy an existing harvest message from the storage queue, and put on your own named harvest queue

## Code
- Background:
    -	ghcrawler was used to crawl github and store data
    -	CD crawler pulled ghcrawler in as a dependency, was then forked/modified in an upstream branch
    -	Now just a directory: ghcrawler/ with unused upstream code removed, refactored
- Important directories: providers/, providers/fetch, providers/process
- Map.js: maps package types to code
- First queues is a “component” type, then either queues “package” and/or “source” type
- Then “tool” type messages for each tool (clearlydefined/scancode/licensee)
- Runs (type)fetch and (type)process for each tool


