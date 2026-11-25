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
