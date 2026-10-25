# Fila de Controles

Sistema de "buzzer" para quiz: vários participantes apertam o botão de um **controle de portão** e a **ordem de chegada** aparece como uma fila ao vivo na tela. Cada controle tem uma cor, e o nome de cada cor pode ser editado (por exemplo, Azul = EUA).

Um ESP32 com receptor 433 MHz capta os sinais dos controles e os envia ao computador pelo cabo USB. A página web (Next.js) lê a porta serial direto do navegador, usando a **Web Serial API**, sem precisar de backend.

## Como funciona

```
Controle (433 MHz) ──rádio──> Receptor RXB6 ──> ESP32 ──USB/Serial──> Navegador (Next.js)
```

1. O controle envia um código numérico fixo ao apertar o botão.
2. O ESP32 recebe o código e imprime na serial uma linha no formato `CODE,<valor>,<bits>`.
3. A página lê essa linha, descobre a qual cor o código pertence e coloca a cor no final da fila.

## Funcionalidades

- Conexão com o ESP32 via Web Serial (Chrome/Edge).
- 15 controles, cada um com uma cor fixa.
- **Nome editável** para cada cor (texto livre, com sugestões de países).
- Botão **Aprender**: vincula o próximo controle apertado à cor escolhida.
- Botão **Testar**: simula o aperto de uma cor, sem precisar de hardware.
- Fila por ordem de chegada, com cada cor aparecendo uma única vez.
- Botão **✕** para tirar um item da fila.
- Configuração salva no navegador (localStorage).
- Layout responsivo para telão, tablet e celular.

## Hardware

| Item | Quantidade |
| --- | --- |
| ESP32 (DevKit) | 1 |
| Módulo receptor 433 MHz **RXB6** | 1 |
| Fio de ~17 cm (antena) | 1 |
| Controles de portão 433 MHz de **código fixo** | até 15 |
| Cabo USB | 1 |

### Ligação

| RXB6 | ESP32 |
| --- | --- |
| VCC | 3V3 |
| GND | GND |
| DATA | GPIO 27 |

Solde o fio de ~17 cm no pino **ANT** do módulo. Sem a antena, o alcance cai muito.

### Compatibilidade dos controles

- Funcionam controles de **código fixo** (os de dip switch e os simples de 4 botões).
- **Não funcionam** controles com **rolling code** (como KeeLoq), porque o código muda a cada aperto.
- A maioria opera em 433,92 MHz, mas confira a frequência na etiqueta do controle.
- Cada botão do controle envia um código diferente. Cadastre apenas o botão que será usado.

## Firmware do ESP32

Instale a biblioteca **rc-switch** (autor: sui77) pela Library Manager da Arduino IDE e grave este código:

```cpp
#include <RCSwitch.h>

#define PINO_RX 27

RCSwitch rx;
unsigned long ultimoCodigo = 0;
unsigned long ultimoTempo = 0;

void setup() {
  Serial.begin(115200);
  rx.enableReceive(digitalPinToInterrupt(PINO_RX));
  Serial.println("PRONTO");
}

void loop() {
  if (rx.available()) {
    unsigned long codigo = rx.getReceivedValue();

    if (codigo != 0) {
      // ignora repetição enquanto o botão está sendo segurado (300 ms)
      bool repetido = (codigo == ultimoCodigo) && (millis() - ultimoTempo < 300);
      if (!repetido) {
        Serial.printf("CODE,%lu,%u\n", codigo, rx.getReceivedBitlength());
      }
      ultimoCodigo = codigo;
      ultimoTempo = millis();
    }
    rx.resetAvailable();
  }
}
```

## Rodando o projeto

Requisitos: Node.js 18 ou superior.

```bash
git clone https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
cd SEU-REPOSITORIO
npm install
npm run dev
```

Abra `http://localhost:3000` no **Chrome** ou **Edge**.

## Aplicativo para Windows (.exe)

O VOX também pode ser executado como aplicativo desktop usando Electron. Para desenvolver ou gerar os executáveis, instale as dependências com `npm install` em um computador com Node.js 18 ou superior.

### Desenvolvimento

```bash
npm run electron:dev
```

Esse comando inicia o Next.js e abre o Electron apontando para `http://localhost:3000`. Encerre com `Ctrl+C` no terminal.

### Gerar instalador e versão portátil

```bash
npm run electron:build
```

O comando exporta o site para uso offline, compila o processo Electron e gera os executáveis Windows x64 na pasta `release/`:

- `VOX Setup 0.1.0.exe`: instalador, com opção de escolher a pasta e criar atalho na área de trabalho.
- `VOX-Portable-0.1.0.exe`: versão portátil, sem instalação.

Execute o instalador ou o arquivo portátil e conecte o ESP32 por USB. Com uma porta serial disponível, o VOX a seleciona diretamente; com mais de uma, abre uma janela para escolher. Feche outros programas que estejam usando a porta (como o monitor serial da Arduino IDE) antes de conectar.

O Windows pode exibir um aviso do SmartScreen porque os executáveis ainda não têm assinatura digital. Os dados locais do aplicativo, como nomes e vínculos, ficam no perfil do usuário e são mantidos entre execuções.

## Como usar

1. Ligue o ESP32 no computador pelo cabo USB.
2. Na página, clique em **Conectar ESP32** e escolha a porta do ESP32.
3. Para cada cor, clique em **Aprender** e aperte o botão do controle correspondente. O código aparece ao lado da cor.
4. Edite o nome de cada cor na caixa de texto (por exemplo, trocar "Azul" por "EUA").
5. Aperte os controles: a fila mostra a ordem de chegada.
6. Para tirar alguém da fila, clique no **✕** do item.

O botão **Testar** simula o aperto de uma cor, e serve para ver a interface funcionando sem hardware.

## Deploy na Vercel

O projeto não tem backend nem variáveis de ambiente, então o deploy é direto:

1. Envie o código para um repositório no GitHub.
2. Na [Vercel](https://vercel.com), clique em **Add New > Project** e importe o repositório.
3. Mantenha as configurações padrão e clique em **Deploy**.

A Web Serial exige HTTPS, que a Vercel já fornece. A leitura da porta acontece no navegador de quem abre a página, então o ESP32 precisa estar ligado no **computador que está com a página aberta**.

## Compatibilidade de navegador

| Navegador | Suporte |
| --- | --- |
| Chrome (desktop) | Sim |
| Edge (desktop) | Sim |
| Firefox | Não (sem Web Serial) |
| Safari | Não (sem Web Serial) |

Nos navegadores sem suporte, a página mostra um aviso e continua funcionando em modo de teste.

## Limitações

- Funciona apenas com controles de código fixo.
- A fila fica na memória e é perdida ao recarregar a página (a configuração de nomes e códigos é mantida).
- Se dois controles apertarem com menos de ~1 ms de diferença, a ordem pode ser ambígua.
- Cores muito parecidas (branco, cinza, preto) podem ser difíceis de distinguir de longe.

## Tecnologias

- [Next.js](https://nextjs.org/) (App Router) e React
- TypeScript
- Tailwind CSS
- Web Serial API
- ESP32 com a biblioteca rc-switch

## Licença

Defina a licença do projeto (por exemplo, MIT) e adicione o arquivo `LICENSE`.
