# TA Triathlon

App pessoal de preparação para o **Ironman 70.3** (12 meses), com a fase de redução de gordura acompanhada por avaliações InBody. É mobile-first, funciona offline e pode ser instalado no iPhone como PWA.

- **Início:** contagem regressiva, fase e semana atual, treino de hoje ("Marcar como feito"), resumo da semana e composição atual
- **Plano:** linha do tempo das 4 fases, as 52 semanas dia a dia e zonas de FC
- **Treinos:** registro manual, histórico com filtro e volume semanal por modalidade
- **Corpo:** avaliações InBody completas, comparação com a linha de base, evolução e análise segmentar
- **Conectar:** conta (login por e-mail e sincronização), Strava (OAuth), importação Garmin (.fit/.gpx/.csv), configurações e backup

Stack: React 18, Vite, TypeScript, Tailwind, React Router, Recharts, Zustand (persistido em `localStorage`), Supabase (login e sincronização, opcional), `vite-plugin-pwa` e `date-fns` (pt-BR). Vercel Functions em `/api` cuidam do token do Strava.

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

O **secret nunca vai para o frontend**. A troca do `code` por token (`/api/strava/token`) e a renovação acontecem nas Vercel Functions.

- **Com login** (e `SUPABASE_SERVICE_ROLE_KEY` no servidor): os tokens ficam na tabela `strava_connections` do Supabase, que o navegador não consegue ler. O app recebe só o access token, de curta duração, via `/api/strava/connection` (que também renova, registra a última sincronização e desconecta). A conexão vale para todos os aparelhos da conta. Se o Strava foi conectado antes do login, o token é movido para o servidor no primeiro login.
- **Sem login:** como antes, o navegador recebe o access token e o refresh token, que ficam no aparelho (`/api/strava/refresh` renova).

Na primeira sincronização vêm as atividades dos últimos 90 dias. Depois, só as novas. Natação, bike, corrida e força são mapeadas; outras modalidades, como caminhada e yoga, são ignoradas. Atividades repetidas não são importadas duas vezes.

---

## Configurar o Supabase (login e sincronização)

Opcional: sem estas variáveis o app funciona como antes, com os dados só no aparelho.

1. No painel do projeto, abra o **SQL Editor** e rode `supabase/schema.sql` (pode rodar de novo; é idempotente). Ele cria `profiles`, `workouts`, `body_compositions` e `strava_connections` com RLS por `auth.uid()`, e um gatilho que cria o perfil e a linha de base do InBody a cada novo usuário.
2. Em **Authentication → URL Configuration**:
   - **Site URL:** o endereço de produção (ex.: `https://seu-app.vercel.app`);
   - **Redirect URLs:** `https://seu-app.vercel.app/conectar`, `http://localhost:5173/conectar` e `http://localhost:3000/conectar`.
3. *(Recomendado para o PWA no iPhone)* Em **Authentication → Emails → Magic Link**, inclua o código no modelo, por exemplo `<p>Ou digite o código: {{ .Token }}</p>`. No app instalado, o link do e-mail abre no Safari, que tem outro armazenamento; com o código dá para entrar direto no app (*Conectar → Conta → Ou digite o código*).
4. Em **Project Settings → API**, copie a URL, a `anon` key e a `service_role` key para o `.env.local`:

   ```bash
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...   # só servidor; nunca com prefixo VITE_
   ```

   A `anon` key é pública por design (o RLS protege os dados). A `service_role` ignora o RLS: fica só nas Vercel Functions, que a usam para gravar os tokens do Strava.

**Como funciona a sincronização** (`src/lib/sync.ts`):

- O login é por link mágico (ou código) enviado ao e-mail, em *Conectar → Conta*.
- O `localStorage` continua sendo o cache do app: tudo funciona offline e sem login.
- Cada alteração nos treinos, avaliações e configurações entra numa fila (`ta-sync`) e sobe para o Supabase assim que houver sessão e rede. A fila sobrevive a fechar o app.
- Ao entrar, ao voltar ao app (após 1 min) e ao recuperar a conexão, o app baixa tudo do Supabase e substitui o cache local, mantendo por cima o que ainda não foi enviado. É assim que os dados aparecem nos outros aparelhos.
- **Primeiro login no aparelho:** os treinos e avaliações locais que não existem na conta sobem (sem duplicar atividades do Strava/Garmin já importadas nem dias do plano já marcados). Configurações e linha de base locais só substituem as da conta se estas nunca foram editadas.
- Se outra conta entrar no mesmo aparelho, os dados locais da conta anterior não sobem: o aparelho passa a espelhar a nova conta.
- Sair da conta mantém os dados no aparelho.
- Os ids do app são UUID (os mesmos das linhas no Supabase); dados antigos (`w-…`, `bc-…`) são convertidos automaticamente.

---

## Bot do Telegram (dieta com Gemini)

Você manda ao bot uma **foto** do prato ou uma **descrição** do que comeu. O Gemini estima porções, calorias e macros, comenta levando em conta o que já foi comido no dia, os treinos e a última avaliação InBody, e a refeição é gravada em `meals` no Supabase. Exige o Supabase configurado e login no app.

1. Rode de novo o `supabase/schema.sql`. Ele cria `meals` (RLS por usuário) e `telegram_links` (só servidor).
2. No Telegram, fale com **@BotFather** → `/newbot` e copie o token.
3. Gere uma chave em <https://aistudio.google.com/apikey>.
4. Na Vercel, cadastre as variáveis (só servidor, **sem** prefixo `VITE_`) e faça um novo deploy:

   | Variável | Valor |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | token do BotFather |
   | `TELEGRAM_WEBHOOK_SECRET` | texto aleatório longo (só letras, números, `_` e `-`) |
   | `GEMINI_API_KEY` | chave do Google AI Studio (`GOOGLE_API_KEY` também funciona) |
   | `GEMINI_MODEL` | opcional, padrão `gemini-2.5-flash` |
   | `APP_TIMEZONE` | opcional, padrão `America/Sao_Paulo` (define o "hoje" das refeições) |

5. Abra uma vez no navegador: `https://<seu-app>.vercel.app/api/telegram/setup?secret=<TELEGRAM_WEBHOOK_SECRET>`. A resposta deve ter `"ok": true` e a URL do webhook.
6. No app, em **Conectar → Telegram · Dieta**, toque em **Conectar Telegram** e depois em **Abrir no Telegram**, toque em **Iniciar** no bot e volte para tocar em Verificar.

Comandos do bot: `/hoje` (total do dia), `/desfazer` (apaga a última refeição), `/ajuda`. Mensagens de chats não vinculados são ignoradas.

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
3. Em **Settings → Environment Variables**, cadastre as variáveis para *Production* (e *Preview*, se quiser):

   | Variável | Valor | Onde é usada |
   |---|---|---|
   | `STRAVA_CLIENT_ID` | Client ID do Strava | funções `/api` |
   | `STRAVA_CLIENT_SECRET` | Client Secret do Strava | funções `/api` (secreta) |
   | `VITE_STRAVA_CLIENT_ID` | o mesmo Client ID | frontend (monta a URL de autorização) |
   | `VITE_SUPABASE_URL` | URL do projeto Supabase | frontend (login e sincronização) |
   | `VITE_SUPABASE_ANON_KEY` | `anon` key do Supabase | frontend (pública; o RLS protege os dados) |
   | `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key do Supabase | funções `/api` (secreta; grava os tokens do Strava) |

4. Faça o deploy. Se você mudar variáveis com prefixo `VITE_`, é preciso **fazer um novo deploy**, porque elas entram no build.
5. Atualize o *Authorization Callback Domain* no Strava com o domínio final.

O `vercel.json` já redireciona as rotas do app para o `index.html` e mantém `/api` de fora.

---

## Instalar no iPhone

1. Abra o endereço do app no **Safari**.
2. Toque em **Compartilhar** (quadrado com a seta para cima).
3. Escolha **Adicionar à Tela de Início** e confirme.

O app abre em tela cheia, com o ícone TA, e funciona offline. Sem login, os dados ficam só no aparelho; com login, também na sua conta do Supabase.

> O iOS pode apagar dados de sites que ficam muitas semanas sem uso. Com login, basta entrar de novo; sem login, **exporte um backup** de vez em quando em *Conectar → Backup → Exportar* e guarde o JSON no iCloud Drive ou em outro lugar seguro.

---

## Dados e personalização

- **Persistência:** o `localStorage` do navegador (`ta-settings`, `ta-workouts`, `ta-body`, `ta-strava`, `ta-sync`) é o cache do app. Com login, os dados também ficam no Supabase (veja *Configurar o Supabase*).
- **Backup:** *Conectar → Backup* exporta e importa um JSON com configurações, treinos e avaliações. Os tokens do Strava não entram no backup; reconecte depois de restaurar.
- **Linha de base:** a avaliação InBody de 26/01/2026 (`src/data/baseline.ts`) é a primeira do histórico. Pode ser editada, mas não excluída.
- **Faixa de massa muscular:** o laudo de base não traz a faixa de referência da massa muscular esquelética. O app usa uma estimativa de 28,7–35,1 kg. Se o seu laudo trouxer outra, ajuste `REFERENCE_RANGES.skeletalMuscleKg` em `src/data/baseline.ts`.
- **FC máxima:** o padrão é a estimativa de Tanaka (208 − 0,7 × idade ≈ 185 bpm). Troque pelo valor de um teste de esforço em *Conectar → Configurações*.
- **Programa:** as sessões vêm de `src/data/program.ts`, uma tabela fase × dia da semana. Cada bloco tem duração inicial e final (`minutes: [início, fim]`), interpolada semana a semana dentro da fase. A cada 4ª semana o volume cai 35% (semana de recuperação), exceto no pico. Edite essa tabela para ajustar os treinos; os componentes só a leem.
- **Fases:** a proporção padrão é 16/16/14/6 semanas e se ajusta ao total entre a data de início e a da prova (*Conectar → Configurações*).

---

## Estrutura

```
api/strava/            Vercel Functions (token, refresh e conexão do Strava)
supabase/schema.sql    tabelas, RLS e gatilho de novo usuário
public/icons/          ícones do PWA (gerados por npm run icons)
scripts/               gerador de ícones
src/
  brand/logo.json      geometria do monograma TA (componente e ícones)
  data/                program.ts (plano) e baseline.ts (InBody + faixas)
  lib/                 calendário, zonas, formatação pt-BR, Strava, Supabase/sincronização, importadores, backup
  store/               stores Zustand persistidos
  hooks/               useProgram (semana, fase, sessão do dia)
  components/ui/       Card, Button, MetricBig, ProgressBar, ZoneBadge, Field
  components/          TALogo, navegação, gráficos e cartões de cada aba
  pages/               Dashboard, Plano, Treinos, Composicao, Conectar
  types.ts             tipos do domínio
```
