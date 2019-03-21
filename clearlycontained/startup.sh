#! /bin/sh

WORKDIR="/home/clearlycontained/app"
CRAWLER_REPO="https://github.com/clearlydefined/crawler"
CRAWLER_BRANCH="prod"

if [ ! -d "$WORKDIR" ]; then
  # clone source into workdir
  /usr/bin/git clone $CRAWLER_REPO $WORKDIR
fi

cd $WORKDIR

# checkout the branch to run the app from
/usr/bin/git checkout $CRAWLER_BRANCH
/usr/bin/git pull

# install dependencies
/usr/bin/npm install

exit 0
