@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto :missing_node
where npm >nul 2>nul
if errorlevel 1 goto :missing_node
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)"
if errorlevel 1 goto :missing_node
if not exist cms\grapesjs\node_modules\grapesjs goto :install
if not exist cms\grapesjs\node_modules\sanitize-html goto :install
goto :run
:install
call npm --prefix cms\grapesjs ci --ignore-scripts
if errorlevel 1 goto :install_failed
:run
set "POC_HOST=127.0.0.1"
set "POC_HOSTED=0"
if not defined POC_PORT set "POC_PORT=4174"
if not defined POC_STATIC_SITE_ORIGIN set "POC_STATIC_SITE_ORIGIN=https://avalook.github.io/deedee-studio-static/"
if not defined POC_STATIC_SITE_DIR set "POC_STATIC_SITE_DIR=%CD%"
if not defined CMS_EXPORT_DIR set "CMS_EXPORT_DIR=%CD%"
if not defined CMS_GIT_PUSH set "CMS_GIT_PUSH=1"
echo.
echo DeeDee CMS: http://127.0.0.1:%POC_PORT%/admin/content
echo Keep this window open. Open the URL after the server reports ready.
echo Publish pushes to GitHub from clean main. Set CMS_GIT_PUSH=0 for local export only.
node cms\grapesjs\server.mjs
if errorlevel 1 goto :server_failed
exit /b 0
:missing_node
echo Install Node.js 24 LTS with npm. Minimum supported version is 22.12.
pause
exit /b 1
:install_failed
echo Dependency installation failed. Check Internet access and retry.
pause
exit /b 1
:server_failed
echo CMS stopped with an error. Check the message above and port availability.
pause
exit /b 1
