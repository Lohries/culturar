# Roteiro de validação do CulturAR

Protocolo para testar a experiência em celulares reais. O roteiro também está dentro do app, em `#/validacao`, com diagnóstico automático.

## Objetivo

Confirmar, aparelho por aparelho, que o visitante consegue ir do QR code até a foto compartilhada, e registrar o que falha em cada combinação de celular e navegador.

## Condições do teste

- Pelo menos **um iPhone (Safari)** e **um Android (Chrome)**.
- Testar a **versão publicada** (HTTPS), que é a que o visitante usa.
- Testar a **primeira visita**: aba anônima ou dados do site apagados.
- Placa impressa pelo `#/painel`, ao lado da obra ou de uma reprodução dela.
- Lugar com espaço para girar o corpo.

## Como aplicar

1. No celular, abra `https://SEU-SITE/#/validacao` e toque em **Começar teste**.
2. Faça a experiência inteira, como um visitante.
3. Volte pelo botão **Roteiro** no topo da tela e toque em **Atualizar** no bloco "Detectado neste aparelho".
4. Confirme ou corrija os passos pré-marcados, marque os demais e escolha o veredito.
5. Toque em **Salvar teste** e depois em **Compartilhar resultado** para mandar o CSV a quem consolida.

## Passos verificados

Cada passo é marcado como **Passou**, **Parcial**, **Falhou** ou **Não testei**. Os marcados com (auto) são sugeridos pelo app a partir do que ele detectou.

| Etapa | Passo |
|---|---|
| Acesso pelo QR | A câmera nativa lê a placa e abre a obra |
| | O leitor do app reconhece a placa (auto) |
| | Um QR de outro site mostra o aviso certo (auto) |
| Entrada | A pintura e a etiqueta aparecem (auto) |
| | O celular pede câmera e movimento ao tocar em **Entrar no quadro** (auto) |
| Portal | A câmera traseira abre com a moldura (auto) |
| | Tocar na moldura faz a travessia (auto) |
| | **Pular** leva direto para dentro (auto) |
| | O indicador termina em "Cena em 3D" (auto) |
| Dentro da cena | A obra está à frente ao entrar |
| | Girar o celular move a vista no sentido certo, sem tremer (auto: falha se o movimento for negado) |
| | Dá para sentir a profundidade |
| | Os 4 pontos ficam sobre D. Pedro I, a Guarda de Honra, o carreiro e a casa |
| | Pontos e "Sobre a obra" abrem o texto (auto) |
| | A cena roda sem engasgos nem aquecimento excessivo |
| Selfie | Tocar em **Selfie** liga a câmera frontal (auto) |
| | O recorte separa a pessoa do fundo sem bordas grosseiras |
| | Girar o celular muda o cenário atrás da pessoa |
| Foto | A foto sai com a etiqueta do museu (auto) |
| | Na selfie, o texto da etiqueta está legível |
| | **Compartilhar** abre o menu do celular (auto) |
| | **Salvar** guarda a imagem |

Além dos passos: notas de 1 a 5 (facilidade, imersão, velocidade, recomendaria), tempo até **Entrar no quadro**, comentários e veredito (Aprovado / Com ressalvas / Reprovado).

## Consolidação

Os CSVs de todos os aparelhos têm as mesmas colunas e podem ser colados numa única planilha. Registre o resumo na seção **Dispositivos testados** do README, só com aparelhos efetivamente testados.

## Dados de exemplo

`src/validacao-exemplos.json` contém 12 testes **fictícios**, carregáveis em `#/validacao` só no modo de desenvolvimento, para demonstrar o histórico. Eles não são resultados de teste.
