# update package lists
sudo apt-get update

# install base things
sudo apt-get install apt-transport-https curl software-properties-common ca-certificates gnupg2

# install node
sudo curl -sL https://deb.nodesource.com/setup_10.x | sudo bash -
sudo apt-get install nodejs

# install git
sudo apt-get install git-core

# install docker
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/debian $(lsb_release -cs) stable"
sudo apt update && sudo apt install docker-ce

# add user to the docker group
sudo usermod -a -G docker $USER
