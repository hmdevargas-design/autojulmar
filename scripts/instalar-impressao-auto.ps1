# Instala a estação de impressão no utilizador atual e inicia-a com o Windows.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourceAgent = Join-Path $PSScriptRoot 'imprimir-auto.ps1'
$installDir = Join-Path $env:LOCALAPPDATA 'Autojulmar\Impressao'
$installedAgent = Join-Path $installDir 'imprimir-auto.ps1'
$configPath = Join-Path $installDir 'impressao-config.json'
$bundledKeyPath = Join-Path $PSScriptRoot 'chave-impressao-autojulmar.txt'
$taskName = 'Autojulmar - Impressao Automatica'

if (-not (Test-Path -LiteralPath $sourceAgent)) {
    throw "Agente não encontrado em $sourceAgent."
}

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item -LiteralPath $sourceAgent -Destination $installedAgent -Force

$existing = $null
if (Test-Path -LiteralPath $configPath) {
    try { $existing = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { }
}

$defaultUrl = if ($existing -and $existing.app_url) { [string]$existing.app_url } else { 'https://www.autojulmar.pt' }
$defaultTenant = if ($existing -and $existing.tenant_id) { [string]$existing.tenant_id } else { '00000000-0000-0000-0000-000000000001' }
$defaultPrinter = if ($existing -and $existing.impressora) { [string]$existing.impressora } else { 'auto' }
$defaultSumatra = if ($existing -and $existing.sumatra) { [string]$existing.sumatra } else { '' }

$appUrlInput = Read-Host "Endereço do sistema [$defaultUrl]"
$tenantInput = Read-Host "Tenant ID [$defaultTenant]"
$printerInput = Read-Host "Nome da impressora ou auto [$defaultPrinter]"
$sumatraInput = Read-Host "Caminho do SumatraPDF ou vazio para deteção automática [$defaultSumatra]"

$appUrl = if ($appUrlInput.Trim()) { $appUrlInput.Trim() } else { $defaultUrl }
$tenantId = if ($tenantInput.Trim()) { $tenantInput.Trim() } else { $defaultTenant }
$printer = if ($printerInput.Trim()) { $printerInput.Trim() } else { $defaultPrinter }
$sumatra = if ($sumatraInput.Trim()) { $sumatraInput.Trim() } else { $defaultSumatra }

$printKey = ''
if (Test-Path -LiteralPath $bundledKeyPath) {
    $printKey = [System.IO.File]::ReadAllText($bundledKeyPath).Trim()
    if ($printKey) {
        Write-Host 'Chave de impressão carregada automaticamente.' -ForegroundColor Green
    }
}
if (-not $printKey -and $existing -and $existing.print_key) {
    $keepKey = Read-Host 'Manter a chave de impressão já configurada? [S/n]'
    if (-not $keepKey.Trim() -or $keepKey.Trim().ToUpperInvariant() -eq 'S') {
        $printKey = [string]$existing.print_key
    }
}
if (-not $printKey) {
    $secureKey = Read-Host 'Chave IMPRESSAO_API_KEY da Vercel' -AsSecureString
    $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    try {
        $printKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    }
}

if (-not $printKey.Trim()) { throw 'A chave de impressão é obrigatória.' }

[pscustomobject]@{
    app_url = $appUrl.TrimEnd('/')
    tenant_id = $tenantId
    print_key = $printKey
    impressora = $printer
    sumatra = $sumatra
} | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8

if (Test-Path -LiteralPath $bundledKeyPath) {
    Remove-Item -LiteralPath $bundledKeyPath -Force
}

$powerShellPath = Join-Path $PSHOME 'powershell.exe'
$actionArguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installedAgent`""
$action = New-ScheduledTaskAction -Execute $powerShellPath -Argument $actionArguments
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Fila local de impressão silenciosa da Autojulmar.' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host ''
Write-Host 'Impressão automática instalada e iniciada.' -ForegroundColor Green
Write-Host "Configuração: $configPath"
Write-Host "Registo: $(Join-Path $installDir 'impressao.log')"
Write-Host "Tarefa do Windows: $taskName"
