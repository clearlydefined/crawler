This folder is for local dev scripts. Windows specific scripts end in .bat.

### General flow:

setup.foo -- Sets up your env.list in the expected location (one folder above current). Then asks you to manually add your github token.

build.foo -- Builds the docker container.

run.foo -- Runs the docker container, killing a previous run if it exists. Hosts file output in a C:\temp\crawler-data directory.

### Extra:

debug.foo -- Does everything run does, but also pauses execution until a debugger is attached. Attach using vscode's profile.