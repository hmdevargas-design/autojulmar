# Impressão automática Autojulmar

A página web usa o diálogo de impressão do navegador e, por segurança, o Chrome exige confirmação. Para impressão realmente silenciosa, use o agente local `imprimir-auto.ps1` com SumatraPDF.

## Instalação no PC da loja

1. Instale o SumatraPDF.
2. Mantenha `INSTALAR.cmd`, `imprimir-auto.ps1` e `instalar-impressao-auto.ps1` na mesma pasta.
3. Abra `INSTALAR.cmd` com duplo clique.
4. Informe a `IMPRESSAO_API_KEY` configurada na Vercel quando o instalador pedir.

O instalador deteta automaticamente uma impressora BIXOLON, cria uma tarefa no Arranque do Windows e inicia o agente imediatamente.

## Comportamento em falhas

- A fila e o cursor ficam guardados em `%LOCALAPPDATA%\Autojulmar\Impressao\estado.json`.
- Um pedido só sai da fila depois de o SumatraPDF aceitar o envio para a impressora.
- Falhas de rede, autenticação, PDF ou impressão são repetidas com intervalo progressivo até 5 minutos.
- Apenas uma instância do agente pode correr por utilizador.
- O registo fica em `%LOCALAPPDATA%\Autojulmar\Impressao\impressao.log`.

O spooler do Windows continua responsável por conservar trabalhos já aceites quando faltar papel ou a impressora estiver temporariamente desligada.
