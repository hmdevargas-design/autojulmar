# Estação local de impressão silenciosa da Autojulmar.
# A configuração é criada por instalar-impressao-auto.ps1.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$configPath = Join-Path $PSScriptRoot 'impressao-config.json'
$runtimeDir = Join-Path $env:LOCALAPPDATA 'Autojulmar\Impressao'
$statePath = Join-Path $runtimeDir 'estado.json'
$logPath = Join-Path $runtimeDir 'impressao.log'
$pollSeconds = 5
$overlapMinutes = 2

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

function Write-PrintLog {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ConsoleColor]$Color = [ConsoleColor]::Gray
    )

    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Message"
    Write-Host $line -ForegroundColor $Color
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
}

function Save-State {
    param([Parameter(Mandatory = $true)]$State)

    $temporaryPath = "$statePath.tmp"
    $State | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temporaryPath -Encoding UTF8
    Move-Item -LiteralPath $temporaryPath -Destination $statePath -Force
}

function New-State {
    return [pscustomobject]@{
        cursor = (Get-Date).ToUniversalTime().ToString('o')
        sobreposicao_ativa = $false
        pendentes = @()
        concluidos = @()
    }
}

function Load-State {
    if (-not (Test-Path -LiteralPath $statePath)) {
        $newState = New-State
        Save-State -State $newState
        return $newState
    }

    try {
        $loaded = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
        if (-not $loaded.cursor) { throw 'Estado sem cursor.' }
        if ($null -eq $loaded.PSObject.Properties['sobreposicao_ativa']) {
            $loaded | Add-Member -NotePropertyName sobreposicao_ativa -NotePropertyValue $true
        }
        if ($null -eq $loaded.pendentes) { $loaded | Add-Member -NotePropertyName pendentes -NotePropertyValue @() -Force }
        if ($null -eq $loaded.concluidos) { $loaded | Add-Member -NotePropertyName concluidos -NotePropertyValue @() -Force }
        return $loaded
    } catch {
        $backupPath = "$statePath.corrompido-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item -LiteralPath $statePath -Destination $backupPath
        Write-PrintLog -Message "Estado inválido preservado em $backupPath. Foi iniciada uma fila nova." -Color Yellow
        $newState = New-State
        Save-State -State $newState
        return $newState
    }
}

function Resolve-SumatraPath {
    param([string]$ConfiguredPath)

    $candidates = @(
        $ConfiguredPath,
        (Join-Path $PSScriptRoot 'SumatraPDF.exe'),
        (Join-Path $env:LOCALAPPDATA 'SumatraPDF\SumatraPDF.exe'),
        'C:\Program Files\SumatraPDF\SumatraPDF.exe',
        'C:\Program Files (x86)\SumatraPDF\SumatraPDF.exe',
        'C:\SumatraPDF\SumatraPDF.exe'
    ) | Where-Object { $_ -and $_.Trim() }

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw 'SumatraPDF não encontrado. Execute novamente o instalador depois de instalar o SumatraPDF.'
}

function Resolve-PrinterName {
    param([string]$ConfiguredName)

    $printers = @(Get-CimInstance -ClassName Win32_Printer)
    if ($ConfiguredName -and $ConfiguredName.Trim() -and $ConfiguredName -ne 'auto') {
        $configured = $printers | Where-Object { $_.Name -eq $ConfiguredName } | Select-Object -First 1
        if (-not $configured) {
            throw "Impressora '$ConfiguredName' não encontrada no Windows."
        }
        return $configured.Name
    }

    $bixolon = @($printers | Where-Object { $_.Name -match 'BIXOLON|SRP[- ]?350' })
    if ($bixolon.Count -eq 1) { return $bixolon[0].Name }

    $defaultBixolon = $bixolon | Where-Object { $_.Default } | Select-Object -First 1
    if ($defaultBixolon) { return $defaultBixolon.Name }

    if ($bixolon.Count -gt 1) {
        throw "Foram encontradas várias impressoras BIXOLON: $($bixolon.Name -join ', '). Defina 'impressora' no ficheiro de configuração."
    }

    throw 'Nenhuma impressora BIXOLON foi encontrada no Windows.'
}

function Test-PdfFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $stream = [System.IO.File]::OpenRead($Path)
    try {
        if ($stream.Length -lt 4) { return $false }
        $signature = New-Object byte[] 4
        [void]$stream.Read($signature, 0, 4)
        return ([System.Text.Encoding]::ASCII.GetString($signature) -eq '%PDF')
    } finally {
        $stream.Dispose()
    }
}

function Get-PrinterProblem {
    param([Parameter(Mandatory = $true)][string]$PrinterName)

    $printer = Get-Printer -Name $PrinterName -ErrorAction Stop
    $status = [string]$printer.PrinterStatus
    if ($status -match 'Error|Offline|Paused|PaperProblem|NoToner|DoorOpen|OutOfMemory|PaperOut|UserIntervention') {
        return "A impressora '$PrinterName' está no estado '$status'."
    }

    $problemJob = Get-PrintJob -PrinterName $PrinterName -ErrorAction SilentlyContinue |
        Where-Object {
            [string]$_.JobStatus -match 'Error|Blocked|Offline|PaperOut|UserIntervention'
        } |
        Select-Object -First 1

    if ($problemJob) {
        return "O trabalho $($problemJob.ID) ficou bloqueado no Windows: $($problemJob.JobStatus)."
    }

    return $null
}

function Invoke-PrintPedido {
    param(
        [Parameter(Mandatory = $true)]$Pedido,
        [Parameter(Mandatory = $true)][string]$AppUrl,
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][string]$SumatraPath,
        [Parameter(Mandatory = $true)][string]$PrinterName
    )

    $pdfUrl = "$AppUrl/api/pedidos/$($Pedido.id)/pdf?formato=termica"
    $temporaryPdf = Join-Path $runtimeDir "pedido-$($Pedido.id).pdf"
    $failedPdf = Join-Path $runtimeDir "falha-pedido-$($Pedido.id).pdf"
    $printSucceeded = $false

    try {
        $printerProblem = Get-PrinterProblem -PrinterName $PrinterName
        if ($printerProblem) { throw $printerProblem }

        Invoke-WebRequest -Uri $pdfUrl -Headers $Headers -OutFile $temporaryPdf -UseBasicParsing
        if (-not (Test-PdfFile -Path $temporaryPdf)) {
            throw 'O servidor não devolveu um PDF válido. Confirme a chave de impressão.'
        }

        $printSettings = 'fit,paper=80mm x 297mm,monochrome'
        $arguments = "-print-to `"$PrinterName`" -print-settings `"$printSettings`" -silent `"$temporaryPdf`""
        $process = Start-Process -FilePath $SumatraPath -ArgumentList $arguments -PassThru -WindowStyle Hidden
        if (-not $process.WaitForExit(60000)) {
            try { $process.Kill() } catch { }
            throw 'O SumatraPDF não concluiu o envio para a impressora em 60 segundos.'
        }
        if ($process.ExitCode -ne 0) {
            throw "O SumatraPDF terminou com o código $($process.ExitCode)."
        }

        Start-Sleep -Seconds 3
        $printerProblem = Get-PrinterProblem -PrinterName $PrinterName
        if ($printerProblem) { throw $printerProblem }

        $printSucceeded = $true
    } finally {
        if ($printSucceeded) {
            Remove-Item -LiteralPath $temporaryPdf -Force -ErrorAction SilentlyContinue
            Remove-Item -LiteralPath $failedPdf -Force -ErrorAction SilentlyContinue
        } elseif (Test-Path -LiteralPath $temporaryPdf) {
            Move-Item -LiteralPath $temporaryPdf -Destination $failedPdf -Force
        }
    }
}

if (-not (Test-Path -LiteralPath $configPath)) {
    throw "Configuração não encontrada em $configPath. Execute primeiro instalar-impressao-auto.ps1."
}

$config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
$appUrl = ([string]$config.app_url).Trim().TrimEnd('/')
$tenantId = ([string]$config.tenant_id).Trim()
$printKey = ([string]$config.print_key).Trim()

if (-not $appUrl -or -not $tenantId -or -not $printKey -or $printKey -match 'COLE_AQUI') {
    throw 'Configuração incompleta: app_url, tenant_id e print_key são obrigatórios.'
}

$sumatraPath = Resolve-SumatraPath -ConfiguredPath ([string]$config.sumatra)
$printerName = Resolve-PrinterName -ConfiguredName ([string]$config.impressora)
$headers = @{ 'x-print-key' = $printKey }

$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\AutojulmarImpressao', [ref]$createdNew)
if (-not $createdNew) {
    Write-PrintLog -Message 'A estação já está em execução neste Windows.' -Color Yellow
    exit 0
}

try {
    $state = Load-State
    Write-PrintLog -Message "Estação ativa. Impressora: $printerName" -Color Green

    while ($true) {
        try {
            $pollUntil = (Get-Date).ToUniversalTime()
            $cursorDate = ([DateTime]::Parse([string]$state.cursor)).ToUniversalTime()
            $pollFrom = if ([bool]$state.sobreposicao_ativa) {
                $cursorDate.AddMinutes(-$overlapMinutes)
            } else {
                $cursorDate
            }
            $recentUrl = "$appUrl/api/pedidos/recentes?tenantId=$([Uri]::EscapeDataString($tenantId))&desde=$([Uri]::EscapeDataString($pollFrom.ToString('o')))&ate=$([Uri]::EscapeDataString($pollUntil.ToString('o')))"
            $apiResponse = Invoke-RestMethod -Uri $recentUrl -Headers $headers -Method GET
            $newOrders = @($apiResponse | ForEach-Object { $_ })

            foreach ($order in $newOrders) {
                $propertyNames = @($order.PSObject.Properties.Name)
                if (
                    $propertyNames -notcontains 'id' -or
                    $propertyNames -notcontains 'numero_pedido' -or
                    $propertyNames -notcontains 'criado_em'
                ) {
                    throw 'A API devolveu uma resposta inválida. Confirme a chave de impressão e o endereço do sistema.'
                }
            }

            $knownIds = @{}
            foreach ($item in @($state.pendentes)) { $knownIds[[string]$item.id] = $true }
            foreach ($item in @($state.concluidos)) { $knownIds[[string]$item.id] = $true }

            foreach ($order in $newOrders) {
                if (-not $knownIds.ContainsKey([string]$order.id)) {
                    $state.pendentes = @($state.pendentes) + [pscustomobject]@{
                        id = [string]$order.id
                        numero_pedido = [int]$order.numero_pedido
                        criado_em = [string]$order.criado_em
                        tentativas = 0
                        proxima_tentativa = (Get-Date).ToUniversalTime().ToString('o')
                    }
                    $knownIds[[string]$order.id] = $true
                    Write-PrintLog -Message "Pedido #$($order.numero_pedido) adicionado à fila." -Color Yellow
                }
            }

            $state.cursor = $pollUntil.ToString('o')
            $state.sobreposicao_ativa = $true
            $retentionLimit = (Get-Date).ToUniversalTime().AddDays(-7)
            $state.concluidos = @($state.concluidos | Where-Object {
                ([DateTime]::Parse([string]$_.concluido_em)).ToUniversalTime() -ge $retentionLimit
            })
            Save-State -State $state
        } catch {
            Write-PrintLog -Message "Falha ao consultar pedidos: $($_.Exception.Message)" -Color Red
        }

        foreach ($order in @($state.pendentes | Sort-Object criado_em)) {
            $nextAttempt = ([DateTime]::Parse([string]$order.proxima_tentativa)).ToUniversalTime()
            if ($nextAttempt -gt (Get-Date).ToUniversalTime()) { continue }

            try {
                Write-PrintLog -Message "Pedido #$($order.numero_pedido): a enviar para impressão..." -Color Yellow
                Invoke-PrintPedido -Pedido $order -AppUrl $appUrl -Headers $headers -SumatraPath $sumatraPath -PrinterName $printerName

                $state.pendentes = @($state.pendentes | Where-Object { $_.id -ne $order.id })
                $state.concluidos = @($state.concluidos) + [pscustomobject]@{
                    id = [string]$order.id
                    concluido_em = (Get-Date).ToUniversalTime().ToString('o')
                }
                Save-State -State $state
                Write-PrintLog -Message "Pedido #$($order.numero_pedido) enviado para a impressora." -Color Green
            } catch {
                $order.tentativas = [int]$order.tentativas + 1
                $delaySeconds = [Math]::Min(300, 5 * [Math]::Pow(2, [Math]::Min(6, $order.tentativas - 1)))
                $order.proxima_tentativa = (Get-Date).ToUniversalTime().AddSeconds($delaySeconds).ToString('o')
                Save-State -State $state
                Write-PrintLog -Message "Pedido #$($order.numero_pedido) mantido na fila. Nova tentativa em $delaySeconds s: $($_.Exception.Message)" -Color Red
            }
        }

        Start-Sleep -Seconds $pollSeconds
    }
} finally {
    if ($mutex) {
        try { $mutex.ReleaseMutex() } catch { }
        $mutex.Dispose()
    }
}
