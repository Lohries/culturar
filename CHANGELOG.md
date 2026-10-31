# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [0.2.0] - 2026-10-31

### Adicionado
- Imagem da obra (`public/obras/independencia-ou-morte.jpg`, domínio público) e mapa de profundidade pré-calculado, servidos pelo próprio site.
- Teste automatizado ponta a ponta (`npm run teste:e2e`) no Chrome headless com câmera simulada.
- Geração dos diagramas a partir de Mermaid (`npm run diagramas`).
- Documentação técnica no modelo da disciplina: diagramas, screenshots e roteiro de validação em `docs/`.
- Dados de exemplo no roteiro de validação (modo de desenvolvimento).

### Corrigido
- URLs de reserva da imagem no Wikimedia Commons: a miniatura de 2560 px respondia 400 e um dos arquivos não existia (404).

## [0.1.0] - 2026-10-29

### Adicionado
- Experiência da obra: entrada, portal em RA, travessia, cena 360° com profundidade, pontos de interesse, selfie com recorte e foto com etiqueta.
- Leitor de QR code, painel da equipe (placas e gerador de profundidade) e roteiro de validação com diagnóstico automático.
