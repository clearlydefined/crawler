SET TARGETPATH=%~dp0..\..\env.list
copy /-Y .\local.env.list %TARGETPATH%
ECHO Update %TARGETPATH% with a personal github PAT