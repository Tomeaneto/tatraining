# TA Triathlon

App pessoal de preparação para o **Ironman 70.3** (12 meses), com a fase de redução de gordura acompanhada por avaliações InBody. É mobile-first, funciona offline e pode ser instalado no iPhone como PWA.

- **Início:** contagem regressiva, fase e semana atual, treino de hoje ("Marcar como feito"), resumo da semana e composição atual
- **Plano:** linha do tempo das 4 fases, as 52 semanas dia a dia e zonas de FC
- **Treinos:** registro manual, histórico com filtro e volume semanal por modalidade
- **Corpo:** avaliações InBody completas, comparação com a linha de base, evolução e análise segmentar
- **Conectar:** Strava (OAuth), importação Garmin (.fit/.gpx/.csv), configurações e backup

Stack: React 18, Vite, TypeScript, Tailwind, React Router, Recharts, Zustand (persistido em `localStorage`), `vite-plugin-pwa` e `date-fns` (pt-BR). Duas Vercel Functions em `/api` cuidam do token do Strava.

---

## Rodar localmente

Requisitos: Node.js 20 ou mais recente.

```bash
npm install
npm run dev          # http://localhost:5173
```

Outros comandos:

```bash
npm run build        # checagem de tipos + build de produção em dist/
npm run preview      # serve o build (o service worker/offline só funciona aqui ou em produção)
npm run icons        # regenera os ícones do PWA a partir do logo (src/brand/logo.json)
```

O `npm run dev` **não** executa as funções de `/api`. Para testar o Strava localmente, use a CLI da Vercel:

```bash
npm i -g vercel
vercel dev           # sobe o front e as funções /api em http://localhost:3000
```

---

## Configurar o Strava

1. Acesse <https://www.strava.com/settings/api> e crie um aplicativo.
2. Em **Authorization Callback Domain**, coloque **só o domínio**, sem `https://` e sem caminho:
   - produção: `seu-app.vercel.app` (ou o seu domínio próprio);
   - testes locais: `localhost`.

   O app redireciona para `https://<domínio>/conectar` depois da autorização.
3. Anote o **Client ID** e o **Client Secret**.
4. Crie um arquivo `.env.local` (copie de `.env.example`):

   ```bash
   STRAVA_CLIENT_ID=12345
   STRAVA_CLIENT_SECRET=seu_secret
   VITE_STRAVA_CLIENT_ID=12345
   ```

O **secret nunca vai para o frontend**. A troca do `code` por token (`/api/strava/token`) e a renovação (`/api/strava/refresh`) acontecem nas Vercel Functions. O navegador só recebe o access token e o refresh token, que ficam no aparelho.

Na primeira sincronização vêm as atividades dos últimos 90 dias. Depois, só as novas. Natação, bike, corrida e força são mapeadas; outras modalidades, como caminhada e yoga, são ignoradas. Atividades repetidas não são importadas duas vezes.

---

## Garmin

A API oficial da Garmin exige aprovação como parceiro, por isso o app importa arquivos exportados do **Garmin Connect** (aba Conectar, botão "Escolher arquivos"):

| Formato | Como exportar | O que é lido |
|---|---|---|
| `.fit` | Atividade → ⚙ → *Exportar arquivo original* (vem em .zip; extraia o .fit) | modalidade, data, tempo, distância, FC média (SDK oficial da Garmin) |
| `.gpx` | Atividade → ⚙ → *Exportar para GPX* | distância pelo traçado, tempo, FC média |
| `.csv` | Lista de *Atividades* → *Exportar CSV* | várias atividades de uma vez (cabeçalho em inglês ou português) |

Quando a modalidade não é reconhecida, o treino recebe a modalidade escolhida em "Modalidade quando não identificada". Dá para corrigir depois na aba Treinos.

---

## Deploy na Vercel

1. Envie o repositório para o GitHub.
2. Em <https://vercel.com/new>, importe o repositório. O preset **Vite** é detectado sozinho (build `npm run build`, saída `dist`).
3. Em **Settings → Environment Variables**, cadastre as três variáveis para *Production* (e *Preview*, se quiser):

   | Variável | Valor | Onde é usada |
   |---|---|---|
   | `STRAVA_CLIENT_ID` | Client ID do Strava | funções `/api` |
   | `STRAVA_CLIENT_SECRET` | Client Secret do Strava | funções `/api` (secreta) |
   | `VITE_STRAVA_CLIENT_ID` | o mesmo Client ID | frontend (monta a URL de autorização) |

4. Faça o deploy. Se você mudar variáveis com prefixo `VITE_`, é preciso **fazer um novo deploy**, porque elas entram no build.
5. Atualize o *Authorization Callback Domain* no Strava com o domínio final.

O `vercel.json` já redireciona as rotas do app para o `index.html` e mantém `/api` de fora.

---

## Instalar no iPhone

1. Abra o endereço do app no **Safari**.
2. Toque em **Compartilhar** (quadrado com a seta para cima).
3. Escolha **Adicionar à Tela de Início** e confirme.

O app abre em tela cheia, com o ícone TA, e funciona offline. Os dados ficam no aparelho.

> O iOS pode apagar dados de sites que ficam muitas semanas sem uso. **Exporte um backup** de vez em quando em *Conectar → Backup → Exportar* e guarde o JSON no iCloud Drive ou em outro lugar seguro.

---

## Dados e personalização

- **Persistência:** tudo fica no `localStorage` do navegador (`ta-settings`, `ta-workouts`, `ta-body`, `ta-strava`). Não há backend de dados.
- **Backup:** *Conectar → Backup* exporta e importa um JSON com configurações, treinos e avaliações. Os tokens do Strava não entram no backup; reconecte depois de restaurar.
- **Linha de base:** a avaliação InBody de 26/01/2026 (`src/data/baseline.ts`) é a primeira do histórico. Pode ser editada, mas não excluída.
- **Faixa de massa muscular:** o laudo de base não traz a faixa de referência da massa muscular esquelética. O app usa uma estimativa de 28,7–35,1 kg. Se o seu laudo trouxer outra, ajuste `REFERENCE_RANGES.skeletalMuscleKg` em `src/data/baseline.ts`.
- **FC máxima:** o padrão é a estimativa de Tanaka (208 − 0,7 × idade ≈ 185 bpm). Troque pelo valor de um teste de esforço em *Conectar → Configurações*.
- **Programa:** as sessões vêm de `src/data/program.ts`, uma tabela fase × dia da semana. Cada bloco tem duração inicial e final (`minutes: [início, fim]`), interpolada semana a semana dentro da fase. A cada 4ª semana o volume cai 35% (semana de recuperação), exceto no pico. Edite essa tabela para ajustar os treinos; os componentes só a leem.
- **Fases:** a proporção padrão é 16/16/14/6 semanas e se ajusta ao total entre a data de início e a da prova (*Conectar → Configurações*).

---

## Estrutura

```
api/strava/            Vercel Functions (token e refresh do Strava)
public/icons/          ícones do PWA (gerados por npm run icons)
scripts/               gerador de ícones
src/
  brand/logo.json      geometria do monograma TA (componente e ícones)
  data/                program.ts (plano) e baseline.ts (InBody + faixas)
  lib/                 calendário, zonas, formatação pt-BR, Strava, importadores, backup
  store/               stores Zustand persistidos
  hooks/               useProgram (semana, fase, sessão do dia)
  components/ui/       Card, Button, MetricBig, ProgressBar, ZoneBadge, Field
  components/          TALogo, navegação, gráficos e cartões de cada aba
  pages/               Dashboard, Plano, Treinos, Composicao, Conectar
  types.ts             tipos do domínio
```
