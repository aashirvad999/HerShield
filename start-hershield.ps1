<#
.SYNOPSIS
    Starts all HerShield services: FastAPI AI Service, Cloudflare Tunnel (if installed), and Next.js Localhost.
.DESCRIPTION
    Launches the AI service on port 8001, optionally starts a Cloudflare quick tunnel for remote access,
    and runs the Next.js development server on http://localhost:3000.
    Press Ctrl+C to cleanly stop all started processes.
#>

param(
    [switch]$WithTunnel
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AiDir = Join-Path $RootDir "ai-service"
$VenvPython = Join-Path $AiDir ".venv\Scripts\python.exe"
$LogDir = Join-Path $AiDir "storage\logs"
$AiHost = "127.0.0.1"
$AiPort = 8001

if (-not (Test-Path $VenvPython)) {
    Write-Host "[ERROR] Python virtualenv not found at: $VenvPython" -ForegroundColor Red
    Write-Host "Please create the virtual environment and install ai-service\requirements.txt first." -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npm is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$AiOutLog = Join-Path $LogDir "ai-service.out.log"
$AiErrLog = Join-Path $LogDir "ai-service.err.log"
$CfOutLog = Join-Path $LogDir "cloudflared.out.log"
$CfErrLog = Join-Path $LogDir "cloudflared.err.log"

$AiProc = $null
$CfProc = $null
$NextProc = $null

function Stop-HerShieldServices {
    Write-Host "`nStopping HerShield services..." -ForegroundColor Yellow
    foreach ($proc in @($NextProc, $CfProc, $AiProc)) {
        if ($null -ne $proc -and -not $proc.HasExited) {
            try {
                # Kill process tree on Windows so child workers (uvicorn/next) also exit
                & taskkill /PID $proc.Id /T /F 2>$null | Out-Null
            } catch {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Write-Host "All HerShield services stopped." -ForegroundColor Green
}

try {
    Write-Host "==========================================" -ForegroundColor Magenta
    Write-Host "       Starting HerShield Platform        " -ForegroundColor Magenta
    Write-Host "==========================================" -ForegroundColor Magenta

    # 1. Start Python FastAPI AI Service
    Write-Host "[1/3] Starting FastAPI AI Service on http://${AiHost}:${AiPort}..." -ForegroundColor Cyan
    $AiProc = Start-Process -FilePath $VenvPython `
        -ArgumentList "-m", "uvicorn", "main:app", "--host", $AiHost, "--port", "$AiPort" `
        -WorkingDirectory $AiDir `
        -RedirectStandardOutput $AiOutLog `
        -RedirectStandardError $AiErrLog `
        -NoNewWindow `
        -PassThru

    # Wait for AI service /health endpoint
    $AiReady = $false
    for ($i = 0; $i -lt 30; $i++) {
        if ($AiProc.HasExited) {
            Write-Host "[ERROR] AI Service exited unexpectedly. Check logs at $AiErrLog" -ForegroundColor Red
            Get-Content $AiErrLog -Tail 20 -ErrorAction SilentlyContinue
            exit 1
        }
        try {
            $health = Invoke-RestMethod -Uri "http://${AiHost}:${AiPort}/health" -Method Get -TimeoutSec 2
            if ($health.online) {
                $AiReady = $true
                Write-Host "      AI Service ready (Device: $($health.device), Model Loaded: $($health.modelLoaded))" -ForegroundColor Green
                break
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $AiReady) {
        Write-Host "[WARN] AI Service is still starting up. Continuing..." -ForegroundColor Yellow
    }

    # 2. Start Cloudflare Quick Tunnel (only when -WithTunnel is passed)
    if ($WithTunnel) {
        $CloudflaredCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
        if ($CloudflaredCmd) {
            Write-Host "[2/3] Starting Cloudflare Tunnel for AI Service..." -ForegroundColor Cyan
            if (Test-Path $CfErrLog) { Remove-Item $CfErrLog -Force -ErrorAction SilentlyContinue }
            if (Test-Path $CfOutLog) { Remove-Item $CfOutLog -Force -ErrorAction SilentlyContinue }

            $CfProc = Start-Process -FilePath $CloudflaredCmd.Source `
                -ArgumentList "tunnel", "--url", "http://${AiHost}:${AiPort}" `
                -WorkingDirectory $RootDir `
                -RedirectStandardOutput $CfOutLog `
                -RedirectStandardError $CfErrLog `
                -NoNewWindow `
                -PassThru

            $TunnelUrl = $null
            for ($i = 0; $i -lt 15; $i++) {
                Start-Sleep -Seconds 1
                $logContent = ""
                if (Test-Path $CfErrLog) { $logContent += (Get-Content $CfErrLog -Raw -ErrorAction SilentlyContinue) }
                if (Test-Path $CfOutLog) { $logContent += (Get-Content $CfOutLog -Raw -ErrorAction SilentlyContinue) }
                if ($logContent -match "(https://[a-zA-Z0-9-]+\.trycloudflare\.com)") {
                    $TunnelUrl = $Matches[1]
                    break
                }
            }

            if ($TunnelUrl) {
                Write-Host "      Cloudflare Tunnel URL: $TunnelUrl" -ForegroundColor Green
            } else {
                Write-Host "      Cloudflare Tunnel started (URL pending in $CfErrLog)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[2/3] cloudflared not found; skipping Cloudflare Tunnel." -ForegroundColor DarkGray
        }
    } else {
        Write-Host "[2/3] Local-only mode (skipping Cloudflare Tunnel; pass -WithTunnel to enable)." -ForegroundColor DarkGray
    }

    # 3. Start Next.js Localhost Dev Server
    Write-Host "[3/3] Starting Next.js Localhost on http://localhost:3000..." -ForegroundColor Cyan
    Write-Host "      Logs: $LogDir" -ForegroundColor DarkGray
    Write-Host "      Press Ctrl+C to stop all services.`n" -ForegroundColor Yellow

    $NextProc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "npm run dev" `
        -WorkingDirectory $RootDir `
        -NoNewWindow `
        -PassThru

    while (-not $NextProc.HasExited) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Stop-HerShieldServices
}
