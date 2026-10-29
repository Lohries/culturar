# CulturAR

Protótipo: o visitante escaneia o QR code ao lado de uma obra e **entra no quadro**.

1. **Portal**: a câmera traseira abre e uma moldura dourada flutua no ambiente real, mostrando a pintura. O visitante toca nela e atravessa.
2. **Dentro da cena**: a pintura vira um lugar 360° ao redor do visitante, com profundidade (o primeiro plano fica perto e o fundo fica longe). Ele olha em volta girando o celular, e os pontos dourados contam a história de cada parte da cena.
3. **Selfie na cena**: a câmera frontal recorta a pessoa do fundo e a coloca dentro da pintura, com o tom de tinta a óleo. Ao girar o celular, o cenário atrás dela muda. A foto sai com a etiqueta do museu, pronta para compartilhar.

Tudo roda no navegador do celular, sem instalar app. A profundidade da pintura e o recorte da pessoa usam IA que roda no próprio aparelho: o Depth Anything V2 e o MediaPipe Selfie Segmenter.

## Rotas

| Endereço | O que é |
| --- | --- |
| `#/` | Acervo, com o botão de escanear |
| `#/escanear` | Leitor de QR dentro do app |
| `#/obra/<id>` | A experiência de uma obra (é para cá que a placa aponta) |
| `#/painel` | Painel da equipe: placas com QR e gerador de profundidade |
| `#/validacao` | Roteiro de validação para os testadores |

## Requisitos

- **Node.js 18 ou mais novo** e npm.
- **HTTPS** para câmera e giroscópio (o `localhost` já conta como seguro).
- Internet na primeira visita: o recorte da selfie busca o MediaPipe no jsDelivr e no Google Storage, e a IA de profundidade vem do Hugging Face quando não há mapa pré-calculado.

## Compatibilidade

Alvos previstos pelo código. A confirmação em aparelho real vem do formulário de validação (abaixo).

| Aparelho | Situação |
| --- | --- |
| iPhone (Safari, iOS 16.4+) | Suportado. Precisa de `OffscreenCanvas` (16.4+). Pede permissão de movimento separada, no toque em "Entrar no quadro". |
| Android (Chrome) | Suportado. O leitor interno usa o `BarcodeDetector` nativo. |
| Android (Samsung Internet, Firefox) | Não verificado. |
| Computador | Arraste com o mouse para olhar em volta; a webcam faz a selfie. |

## Rodar no computador

```bash
npm install
npm run dev          # abre em http://localhost:5173
```

No computador, você arrasta com o mouse para olhar em volta e a webcam serve para a selfie.

## Testar no celular (mesma rede Wi-Fi)

Câmera e giroscópio só funcionam em **HTTPS**:

```bash
npm run celular
```

1. Abra no celular o endereço `https://192.168.x.x:5173` que aparece no terminal.
2. Aceite o aviso de certificado. Ele é autoassinado, o que é normal em teste.

## Publicar (para o QR code funcionar em qualquer lugar)

```bash
npm run build        # gera a pasta dist/
```

Depois, publique a pasta `dist/` em qualquer uma destas opções:

- **Netlify Drop**: arraste a pasta `dist` em app.netlify.com/drop. Você recebe um link HTTPS na hora.
- **Vercel**: rode `npx vercel` na pasta do projeto.
- **GitHub Pages**: envie o conteúdo de `dist/` para a branch `gh-pages`.

## Gerar as placas com QR code

Abra `https://SEU-SITE/#/painel`:

1. Confirme o endereço público. É para lá que o QR aponta.
2. Clique em **Imprimir placas**.

Cada placa aponta para `https://SEU-SITE/#/obra/<id-da-obra>`. A câmera nativa do iPhone e do Android lê o QR e abre o link direto. O app também tem leitor próprio em `#/escanear`.

## Deixar a experiência rápida (recomendado antes de apresentar)

Por padrão, na **primeira visita** de cada celular o app baixa a IA de profundidade (cerca de 27 MB) e calcula a cena. Para evitar isso:

1. Coloque a pintura em `public/obras/independencia-ou-morte.jpg`. O original em domínio público está no Wikimedia Commons. Sem esse arquivo, o app busca a imagem no Commons pela internet.
2. Abra `#/painel`, clique em **Gerar mapa de profundidade** e depois em **Baixar PNG**.
3. Salve o PNG em `public/obras/independencia-ou-morte-profundidade.png`.
4. Rode `npm run build` de novo.

Pronto: o visitante não baixa IA nenhuma para a cena. Só o recorte da selfie (cerca de 250 KB) é baixado quando ele toca em **Selfie**.

## Adicionar outra obra

Em `src/obras.js`, copie o bloco de "Independência ou Morte!" e troque:

- `id`: vira a rota `#/obra/<id>` e o nome dos arquivos em `public/obras/`.
- `titulo`, `artista`, `ano`, `acervo`, `cena` e `resumo`: os textos da etiqueta.
- `imagens`: o arquivo local e, se quiser, a URL de outro lugar.
- `ambiente.horizonte`: onde está a linha do horizonte na tela (0 = topo, 1 = base). Ela fica na altura dos olhos.
- `ambiente.campo`: quantos graus a tela ocupa à sua frente. O valor 360 dividido por esse número precisa dar um número par (90 ou 60, por exemplo).
- `pontos`: os pontos de interesse. `u` e `v` são a posição na tela, de 0 a 1. As posições que vieram configuradas são aproximadas, então ajuste olhando a cena.

Use obras em **domínio público** ou com autorização do acervo.

## Validação

O roteiro de teste está dentro do app, em `https://SEU-SITE/#/validacao` (também há um botão no `#/painel`).

1. No celular, abra `#/validacao` e toque em **Começar teste**. O app limpa as anotações anteriores e abre a obra.
2. Faça a experiência inteira: QR, portal, cena, selfie e foto. Enquanto o teste está em andamento, um botão **Roteiro** aparece no topo da tela para voltar ao formulário.
3. No roteiro, cada passo é marcado como *Passou*, *Parcial*, *Falhou* ou *Não testei*. O que o app consegue detectar sozinho já vem sugerido (câmera, movimento, de onde veio a profundidade, tempo de carregamento, selfie, foto, compartilhamento). O testador confirma ou corrige. O bloco **Detectado neste aparelho** mostra também sistema, navegador e recursos que faltam (HTTPS, giroscópio, `OffscreenCanvas`).
4. Toque em **Salvar teste**. O teste fica guardado no próprio aparelho. **Compartilhar resultado** manda um CSV pelo menu do celular (WhatsApp, e-mail) para quem está consolidando. Os CSVs de todos os aparelhos podem ser juntados numa planilha.

Nada sai do aparelho sem o testador compartilhar: o app não tem servidor.

Se preferir reunir as respostas num lugar só, sem trocar arquivos, use a versão online do mesmo roteiro: [Validação CulturAR](https://claude.ai/artifact/ELQfVhqGT7v4FaswSEFkKj). Os testadores precisam de acesso de **Contribuidor**. Quem é editor vê a aba **Resultados** com tudo consolidado. Essa versão não tem a detecção automática.

Para o teste valer, faça pelo menos uma rodada em iPhone e uma em Android, as duas na **primeira visita** (aba anônima ou dados do site apagados) e no **site publicado**, que é o que o visitante vai usar.

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| A câmera não abre | Página em HTTP, ou permissão negada | Use `npm run celular` ou o site publicado; libere a câmera nas configurações do navegador |
| A cena não gira com o celular (iPhone) | Permissão de movimento negada | Feche a aba, abra de novo e aceite o pedido de movimento. Enquanto isso, arraste a tela |
| "Não consegui carregar a imagem da obra" | Sem internet e sem o arquivo local | Coloque a pintura em `public/obras/<id>.jpg` |
| Fica em "Baixando IA de profundidade" | Primeira visita sem o mapa pré-calculado | Gere o PNG em `#/painel` (veja acima) |
| A cena entra em "modo simples" | A IA de profundidade falhou no aparelho | Gere o mapa de profundidade em `#/painel` |
| "Não deu para usar a câmera frontal" | Permissão negada, ou o MediaPipe não baixou | Confira a permissão e a conexão |
| O celular esquenta ou trava | Aparelho modesto | Ative o modo leve (veja abaixo) |

## Limites do protótipo (e próximos passos)

- O celular percebe quando você **gira**, mas não quando você **anda**. Para andar dentro da cena no Android, o próximo passo é usar WebXR (`immersive-ar`).
- Atrás de você aparece a mesma pintura espelhada, que encaixa sem emenda. Uma evolução é gerar um panorama 360° completo de cada obra com IA (outpainting) e salvar como imagem.
- Áudio ambiente por obra (cavalos, vento, o grito) aumentaria muito a imersão e é simples de adicionar.
- Se algum celular ficar lento, ative o modo leve no console do navegador:
  ```js
  localStorage.setItem("culturar-leve", "1")
  ```

## Estrutura

```
src/
  obras.js                    acervo (textos, imagens, ambiente, pontos)
  pages/Obra.jsx              a experiência: entrada → portal → dentro → selfie → foto
  pages/Scanner.jsx           leitor de QR dentro do app
  pages/Painel.jsx            placas com QR + gerador de profundidade
  pages/Validacao.jsx         roteiro de validação (#/validacao)
  validacao.js                passos do roteiro, anotações automáticas e exportação em CSV
  engine/Engine.js            cena 3D (three.js): pintura em 360°, portal, selfie
  engine/orientacao.js        giroscópio → câmera
  engine/profundidade.js      mapa de profundidade (arquivo → cache → IA)
  engine/recorte.js           recorte da pessoa em tempo real
```
