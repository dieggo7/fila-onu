# AGENTS.md

Guia para agentes de IA que trabalham neste repositório. Leia inteiro antes de alterar qualquer coisa. Em caso de conflito, **o pedido explícito da pessoa vence este arquivo**.

## 1. Sobre o projeto

Aplicação web para **simulações de debate da ONU**. O usuário principal é o **professor que conduz o debate**: ele gerencia a lista de oradores, e hoje faz isso à mão no bloco de notas. O sistema automatiza isso.

- Cada **delegação** (país) tem um **controle de portão 433 MHz** de uma cor. Quando o controle é apertado, um ESP32 com receptor RF manda `CODE,<valor>,<bits>` pela USB (serial, 115200 baud) e a página lê direto no navegador via **Web Serial API**.
- A tela principal (**Debate**) tem tópicos, lista de oradores por tópico, "Falando agora" com cronômetro, histórico ("Já falaram") e modo telão para a plateia.
- A tela **Controles** vincula cada controle físico a uma cor (Vincular/Refazer, Testar) e permite renomear a cor (ex.: Azul → EUA).
- Não há backend. Tudo roda no navegador e é persistido em `localStorage`. Deploy na Vercel.

**Quem usa:** um professor, ao vivo, na frente de uma turma, muitas vezes em um notebook com projetor. Cada clique precisa ser óbvio, rápido e difícil de errar.

## 2. Stack e comandos

- Next.js (App Router), React, TypeScript estrito, Tailwind CSS.
- Sem bibliotecas de estado externas (`useState`/`useReducer` bastam). Sem dependência nova sem motivo claro; se adicionar, justifique em uma linha.

```bash
npm run dev     # desenvolvimento
npm run lint    # deve passar sem avisos
npm run build   # deve passar sem erros nem avisos
```

## 3. Regras do projeto (não negociáveis)

- **Não existe botão de limpar/resetar a lista de oradores** nem atalho de teclado (Espaço) para isso. A lista só esvazia removendo item por item (✕). "Reiniciar tempo" do cronômetro é a única coisa com "reiniciar".
- Cada delegação aparece **uma vez** na lista do tópico (não repete entrada enquanto está na lista ou falando).
- Toda a interface é em **português do Brasil**.
- **Não altere o `README.md`** a menos que a pessoa peça. Ele não deve citar o contexto da simulação da ONU.
- Não mexa no firmware do ESP32 nem no formato da linha serial.
- A sessão inteira (tópicos, listas, histórico, vínculos, nomes) persiste em `localStorage` com chave **versionada**. Mudou o formato? Aumente a versão e **migre** os dados antigos, sem perder vínculos.
- Ações destrutivas ou fáceis de errar (remover da lista, finalizar fala) têm **Desfazer**; exclusão de tópico pede confirmação.

## 4. Como projetar a interface

Pense como um designer que **trabalha para esse professor**, e não como um gerador de templates.

### Estrutura é informação

Borda, divisor, número, rótulo e ícone existem para **dizer algo**. Se não dizem, corte.

- Pouca borda: no máximo **um nível visível** por tela. Separe com espaçamento e leve diferença de fundo, não com contornos em volta de tudo.
- Campos editáveis sem borda no estado normal podem usar fundo sutil ou sublinhado; o contorno forte fica para foco e hover.
- Numeração só quando o conteúdo **é** uma sequência (a ordem da lista de oradores é; o contador de uma seção não é).
- Nada de eyebrows em caixa alta com letter-spacing, selos decorativos, ícones em caixinha no estado vazio, brilho (glow) em botão, gradiente como enfeite, mesmo raio de borda e mesma sombra em tudo.
- **Nunca mostre informação que não é verdade** (ex.: "ao vivo" enquanto desconectado).

### Hierarquia e foco

- Em cada tela existe **uma coisa mais importante**: no Debate é "Falando agora" e a lista; nos Controles é o que **ainda não foi vinculado**. Dê a ela o maior peso e deixe o resto quieto.
- **Uma ação principal por contexto.** Ações secundárias ficam discretas ou dentro de um menu (⋯). Quinze botões azuis iguais na mesma tela é um erro de design.
- Não repita a mesma informação em dois lugares (ex.: nome da cor no título do card e no input).
- Estados importam: vazio, carregando, erro, desconectado, aguardando controle, sucesso. Projete todos.

### Tipografia, cor e espaço

- **Uma família tipográfica** (duas, no máximo, claramente distintas), escala de tamanhos definida e usada de forma consistente. Texto de apoio **nunca abaixo de 14px**; corpo a partir de 16px.
- Não use caixa alta para rótulos. Texto em sentence case.
- Tema escuro sóbrio e neutro. **As cores vivas pertencem às delegações** (as 15 cores dos controles) e a uma única cor de destaque para ações. Contraste mínimo **AA**, inclusive em textos secundários.
- Espaçamento em escala de 4/8 px. Centralize tokens (cores, tamanhos, espaços) em um só lugar (tema do Tailwind ou variáveis CSS); sem valores mágicos espalhados.
- Tamanho de texto para o telão: legível de longe, mas **sem exagero**. O nome em destaque usa `clamp()` com teto em torno de 3rem.
- Movimento só quando responde a uma ação (entrada de um orador na lista, abrir menu). Curto (150–200 ms), sutil, e respeitando `prefers-reduced-motion`. Sem animações de entrada decorativas por seção.

### Texto da interface

- Escreva do ponto de vista do professor, com verbos simples: **Chamar**, **Finalizar fala**, **Vincular**, **Desfazer**. Nada de jargão técnico ("serial", "payload") na UI.
- Uma ação mantém o **mesmo nome** em todo o fluxo (o botão "Chamar" não vira "Selecionar" em outro lugar).
- Erros dizem o que aconteceu **e o que fazer** ("Código desconhecido: 5592405. Vincule esse controle na tela Controles."). Não peça desculpas e não sejam vagos.
- Estado vazio é um convite à ação, em uma linha.

## 5. Responsivo (celular, notebook e telão)

Teste mentalmente (e, se possível, com captura de tela) em **360, 390, 768, 1366×768 e 1920×1080**.

- Sem scroll horizontal em nenhuma largura.
- No celular: **coluna única** com ordem de prioridade (tópico → falando agora → próximos → já falaram). Ferramentas secundárias agrupadas em **um** menu ou barra, nunca espalhadas.
- Itens de lista em **duas camadas** no celular: informação em cima, uma ação principal visível, o resto em menu ⋯. Não enfie nome, número e quatro botões na mesma linha.
- Alvos de toque de **no mínimo 44px**.
- Botões flutuantes não podem cobrir conteúdo.
- No notebook (1366×768), a tela Controles mostra as 15 delegações **sem rolar**.

## 6. Acessibilidade (piso mínimo)

- Foco visível e navegação completa por teclado, na ordem lógica.
- `aria-label` em todo botão só de ícone (ex.: "Tirar Azul da fila"), `aria-live="polite"` em "Falando agora", na lista e nos toasts.
- Nunca depender só da cor: o nome da delegação sempre aparece ao lado da cor.
- Respeitar `prefers-reduced-motion`.

## 7. Código

- **Componentes pequenos, com uma responsabilidade.** Não crie abstração para algo usado uma vez. Lógica em hooks (`useSerial`, `useControls`, `useTopics`, `useSpeakers`, `useTimer`); componentes só apresentam.
- TypeScript estrito, **sem `any`**, tipos de domínio em um lugar só (`types/`).
- Nomes claros e em um idioma consistente. Sem comentários que apenas narram o óbvio; comente o **porquê** de decisões não óbvias.
- **Delete código morto**, estilos e dependências sem uso. Sem `console.log` esquecido.
- Evite repetir longas listas de classes: extraia para componente ou token quando o padrão aparece três vezes.
- Cuidado com especificidade e conflito de classes (padding/margin que se anulam).

### Next.js e navegador

- Tudo que usa `navigator.serial`, `localStorage`, `window` ou `document` fica em **Client Components** (`"use client"`) e só é lido **depois de montar** (`useEffect`), para evitar erro de hidratação.
- **Web Serial**: abra a porta uma única vez (cuidado com o double-effect do React Strict Mode), faça buffer por linhas (`\n`), trate linha parcial, e libere reader/porta ao desconectar ou desmontar. Trate cabo desconectado voltando ao estado "Desconectado" e permitindo reconectar sem recarregar a página.
- Se `"serial" in navigator` for falso (Firefox/Safari), mostre um aviso claro ("Use Chrome ou Edge no computador") e mantenha o resto funcionando em modo de teste.
- O botão **Testar** (simula o aperto) precisa continuar funcionando sem hardware.

## 8. Como trabalhar

1. **Entenda antes de mudar.** Leia os arquivos envolvidos. Peça esclarecimento só se for impossível decidir sozinho; caso contrário, decida e diga a suposição.
2. **Faça só o que foi pedido.** Não refatore, renomeie nem redesenhe o que está fora do escopo. Se vir um problema fora do escopo, **mencione** em vez de consertar.
3. **Planeje a mudança de UI em poucas linhas** (o que muda e por quê) antes de codar. Pergunte-se: "isso parece o template genérico que sairia para qualquer app?" Se sim, ajuste.
4. **Revise o próprio trabalho.** Antes de entregar, tire um "acessório": remova o que é decoração.
5. **Verifique**: `npm run lint` e `npm run build` limpos, sem erros no console do navegador nem no terminal (inclusive o indicador "Issues" do Next).
6. **Resuma no final**, em poucas linhas: o que mudou, o que decidiu por conta própria e o que ficou de fora.

## 9. Definição de pronto

- [ ] Funciona do jeito pedido, no desktop e no celular, sem scroll horizontal.
- [ ] O professor entende o que clicar sem explicação.
- [ ] As regras da seção 3 continuam valendo (sem reset, sem Espaço, uma entrada por delegação, README intacto).
- [ ] Contraste AA, foco visível, alvos de 44px, `aria-label` nos botões de ícone.
- [ ] Nenhum texto menor que 14px, nenhuma informação falsa na tela.
- [ ] `lint` e `build` limpos, sem código morto e sem `any`.
- [ ] Dados salvos antes continuam funcionando (migração, se o formato mudou).