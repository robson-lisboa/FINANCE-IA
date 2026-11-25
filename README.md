# FINANCE IA — versão 1.0

Aplicação web de controle financeiro com visual escuro, responsivo e tecnológico.

## O que já funciona

- Dashboard com saldo, receitas, despesas e taxa de economia.
- Cadastro de receitas e despesas.
- Categorias e datas.
- Pesquisa e filtro dos lançamentos.
- Exclusão de lançamentos.
- Gravação automática no navegador (`localStorage`).
- Exportação dos lançamentos em CSV.
- Resumo automático e despesas por categoria.
- Gráfico mensal de receitas e despesas calculado pelos lançamentos reais dos últimos seis meses.
- Instalação nova começa vazia, sem movimentações fictícias.
- Layout adaptado para celular.

## Importante sobre esta versão

Esta é uma demonstração funcional para validação do produto. Os dados ficam salvos somente no navegador/dispositivo em que foram cadastrados. Ainda não há login, sincronização entre dispositivos, banco de dados na nuvem, cobrança recorrente ou integração bancária. O gráfico de fluxo dos seis meses, os indicadores e os resumos refletem os lançamentos cadastrados. Em uma instalação nova, o painel começa sem movimentações; cadastre receitas e despesas para formar o histórico.

Não use dados bancários reais ou informações sensíveis nesta versão de demonstração.

## Requisitos

- Node.js 20.19+ ou 22.12+
- npm

## Rodar no computador

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite, normalmente `http://localhost:5173`.

## Gerar versão de produção

```bash
npm run build
npm run preview
```

A pasta `dist` será criada.

## Publicar no GitHub

1. Crie um repositório vazio chamado `finance-ia`.
2. Extraia este ZIP.
3. Abra o PowerShell dentro da pasta `finance-ia`.
4. Execute:

```powershell
git init
git add .
git commit -m "Primeira versão do FINANCE IA"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/finance-ia.git
git push -u origin main
```

Troque `SEU-USUARIO` pelo seu usuário do GitHub.

## Publicar no Render

1. Entre em https://render.com e conecte o GitHub.
2. Escolha **New +** → **Static Site**.
3. Selecione o repositório `finance-ia`.
4. Build Command: `npm install && npm run build`
5. Publish Directory: `dist`
6. Clique em **Create Static Site**.

O arquivo `render.yaml` também descreve essa configuração para Blueprint.

## Próximas etapas antes de vender

1. Criar autenticação e banco de dados multiusuário.
2. Isolar os dados de cada conta com políticas de segurança no banco.
3. Implementar backups, exclusão/exportação de dados e política de privacidade.
4. Integrar pagamento e controle de assinatura.
5. Substituir dados demonstrativos do gráfico por dados reais.
6. Adicionar testes automatizados e validação de segurança.

## Login e banco de dados na nuvem (Supabase)

A aplicação já contém a tela de cadastro/login e a camada de acesso à API do Supabase. Para ativar a sincronização, é necessário conectar um projeto Supabase e configurar as variáveis no ambiente de publicação.

### Configuração inicial

1. Crie um projeto em [Supabase](https://supabase.com/dashboard).
2. No projeto, abra **SQL Editor** e execute todo o conteúdo de `supabase/migrations/20261125000100_create_transactions.sql`.
3. Em **Project Settings → API**, copie a URL do projeto e a chave pública **anon** (ou publishable key compatível).
4. No Render, abra o serviço do frontend e adicione:
   - `VITE_SUPABASE_URL`: URL do projeto Supabase.
   - `VITE_SUPABASE_ANON_KEY`: chave pública do projeto.
5. Salve e faça um novo deploy. As variáveis `VITE_*` são incorporadas durante o build do Vite.
6. No Supabase, em **Authentication → URL Configuration**, configure a URL pública do site como Site URL e inclua a URL do Render nas Redirect URLs.

### Segurança e migração

- A tabela `public.transactions` exige autenticação e Row Level Security (RLS).
- As políticas limitam leitura, inclusão, alteração e exclusão ao próprio `auth.uid()`.
- A chave `service_role` nunca deve ser colocada no frontend nem nas variáveis `VITE_*`.
- Ao entrar pela primeira vez, se houver lançamentos locais e a conta na nuvem estiver vazia, o aplicativo pede confirmação antes de importar. O backup local é mantido se a importação não for aceita.
- Preferências visuais continuam salvas no navegador; lançamentos passam a ser lidos e gravados na nuvem após a conexão.

**Importante:** o código está preparado, mas a autenticação e a sincronização só ficam ativas depois que o projeto Supabase e as variáveis do Render forem configurados.
