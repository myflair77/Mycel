@echo off
setlocal
cd /d "%~dp0.."
set "DEVKIT=%LOCALAPPDATA%\Mycel\PC\devkit"
if not exist "%DEVKIT%\.git" (
  git clone https://github.com/openai/sign-in-with-chatgpt-devkit.git "%DEVKIT%" || exit /b 1
)
git -C "%DEVKIT%" checkout --detach 0a36fefeb913055c8c7a1a29b63d82b96b2e841a || exit /b 1
pushd "%DEVKIT%"
call npm ci --ignore-scripts --no-audit || exit /b 1
call npm run build -w @siwc/local || exit /b 1
popd
if not exist node_modules\vite (call npm ci || exit /b 1)
call npm run build || exit /b 1
node scripts\mycel-pc.mjs
pause

