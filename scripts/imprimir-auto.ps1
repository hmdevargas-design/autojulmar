# =============================================================
#  Estação de Impressão Automática — Autojulmar
#  Guarda este ficheiro no PC-loja e corre: powershell -File imprimir-auto.ps1
# =============================================================

# ── CONFIGURAÇÃO (preenche estes 3 valores) ──────────────────
$APP_URL    = "https://autojulmar.pt"
$TENANT_ID  = "COLE_AQUI_O_TENANT_ID"       # ver instruções abaixo
$PRINT_KEY  = "COLE_AQUI_A_CHAVE_IMPRESSAO"  # definida na Vercel
$IMPRESSORA = "Bixolon SRP-350Plus III"       # nome exacto da impressora no Windows
$SUMATRA    = "C:\SumatraPDF\SumatraPDF.exe"  # caminho do Sumatra PDF
# ─────────────────────────────────────────────────────────────

if (-not (Test-Path $SUMATRA)) {
    Write-Host "ERRO: Sumatra PDF não encontrado em $SUMATRA" -ForegroundColor Red
    Write-Host "Descarrega em: https://www.sumatrapdfreader.org/download-free-pdf-viewer"
    Read-Host "Prima Enter para sair"
    exit 1
}

$headers = @{ "x-print-key" = $PRINT_KEY }
$desde   = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

Write-Host "================================================" -ForegroundColor Green
Write-Host "  Estacao de impressao activa" -ForegroundColor Green
Write-Host "  A verificar pedidos novos a cada 5 segundos" -ForegroundColor Green
Write-Host "  Prima Ctrl+C para parar" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

while ($true) {
    try {
        $url   = "$APP_URL/api/pedidos/recentes?tenantId=$TENANT_ID&desde=$([Uri]::EscapeDataString($desde))"
        $novos = Invoke-RestMethod -Uri $url -Headers $headers -Method GET

        $desde = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

        foreach ($pedido in $novos) {
            $num  = $pedido.numero_pedido
            $id   = $pedido.id
            Write-Host "$(Get-Date -Format 'HH:mm:ss')  Pedido #$num detectado — a imprimir..." -ForegroundColor Yellow

            $pdfUrl  = "$APP_URL/api/pedidos/$id/pdf?formato=termica"
            $tmpFile = "$env:TEMP\pedido-$id.pdf"

            try {
                Invoke-WebRequest -Uri $pdfUrl -Headers $headers -OutFile $tmpFile

                & $SUMATRA -print-to $IMPRESSORA -silent $tmpFile
                Start-Sleep -Seconds 3

                Remove-Item $tmpFile -ErrorAction SilentlyContinue
                Write-Host "$(Get-Date -Format 'HH:mm:ss')  Pedido #$num impresso!" -ForegroundColor Green
            } catch {
                Write-Host "$(Get-Date -Format 'HH:mm:ss')  Erro ao imprimir pedido #$num : $_" -ForegroundColor Red
            }
        }
    } catch {
        Write-Host "$(Get-Date -Format 'HH:mm:ss')  Erro de rede: $_" -ForegroundColor Red
    }

    Start-Sleep -Seconds 5
}
