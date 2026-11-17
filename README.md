# Digital Store API (Drip Store) - Projeto final de Back-end

API REST da loja Digital Store: usuários com login (JWT), categorias e produtos com imagens e opções.
Feita em **Node.js + Express**, banco **MySQL** com **Sequelize** (migrations), testes com **Jest** e documentação com **Swagger**.

**Equipe:** Wermeson Freire *(adicione aqui o nome de todos os integrantes)*

**Front-end deste projeto:** https://github.com/Wermesonfreire85/Projeto-Front-End-

## Tecnologias

Node.js, Express, Sequelize, MySQL (mysql2), JWT (jsonwebtoken), bcrypt, dotenv, cors, Swagger UI, Jest e Supertest.

## Como rodar

Pré-requisitos: **Node.js 18+** e **MySQL** instalados e rodando.

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie o banco de dados vazio (no MySQL Workbench, ou pelo terminal):
   ```sql
   CREATE DATABASE drip_store;
   ```
3. Copie o arquivo `.env.example` para `.env` e preencha a senha do seu MySQL e o `JWT_SECRET`.
4. Crie as tabelas com as migrations:
   ```bash
   npm run migrate
   ```
5. (Opcional) Popule com dados de exemplo (categorias, produtos e um usuário de teste `admin@digitalstore.com` / `123456`):
   ```bash
   npm run seed
   ```
6. Inicie a API:
   ```bash
   npm run dev      # reinicia sozinha quando você salva um arquivo
   npm start        # modo normal
   ```

A API fica em `http://localhost:3000` e a documentação em **`http://localhost:3000/api-docs`**.

Para desfazer todas as migrations: `npm run migrate:undo`.

## Testes

Os testes usam um banco separado (`DB_NAME_TEST`, padrão `drip_store_test`), que precisa existir:

```sql
CREATE DATABASE drip_store_test;
```

```bash
npm test
```

Cobrem cadastro, login, token, CRUD de usuários, categorias e produtos, busca com filtros, upload de imagens e os erros 400, 401 e 404.

## Estrutura de pastas

```
src/
├── config/        configuração do banco, do JWT e da pasta de imagens
├── controllers/   recebem a requisição e devolvem a resposta HTTP
├── services/      regras de negócio e validações
├── models/        tabelas do banco (Sequelize) e relações entre elas
├── routes/        ligam cada endereço ao seu controller
├── middleware/    autenticação (JWT) e tratamento de erros
├── database/      migrations (criação das tabelas) e seed (dados de exemplo)
├── docs/          documentação Swagger
├── utils/         funções auxiliares (erros, validação de parâmetros)
├── app.js         monta o Express
└── server.js      liga o servidor
tests/             testes automáticos
uploads/           imagens enviadas (não vai para o Git)
```

O caminho de uma requisição: **rota → (middleware de autenticação) → controller → service → model → banco**.

## Banco de dados

| Tabela | Campos principais |
|---|---|
| `users` | id, firstname, surname, email (único), password (hash bcrypt), created_at, updated_at |
| `categories` | id, name, slug (único), use_in_menu, created_at, updated_at |
| `products` | id, enabled, name, slug (único), use_in_menu, stock, description, price, price_with_discount, created_at, updated_at |
| `product_images` | id, product_id, enabled, path |
| `product_options` | id, product_id, title, shape, radius, type, values |
| `product_categories` | product_id, category_id |

Um produto tem várias imagens, várias opções e várias categorias (relação muitos-para-muitos pela tabela `product_categories`).
Ao apagar um produto, suas imagens, opções e ligações com categorias são apagadas junto (`ON DELETE CASCADE`).

## Endpoints

| Método | Rota | Token | Respostas |
|---|---|---|---|
| POST | `/v1/user/token` | não | 200, 400 |
| POST | `/v1/user` | não | 201, 400 |
| GET | `/v1/user/:id` | não | 200, 404 |
| PUT | `/v1/user/:id` | sim | 204, 400, 401, 404 |
| DELETE | `/v1/user/:id` | sim | 204, 401, 404 |
| GET | `/v1/category/search` | não | 200, 400 |
| GET | `/v1/category/:id` | não | 200, 404 |
| POST | `/v1/category` | sim | 201, 400, 401 |
| PUT | `/v1/category/:id` | sim | 204, 400, 401, 404 |
| DELETE | `/v1/category/:id` | sim | 204, 401, 404 |
| GET | `/v1/product/search` | não | 200, 400 |
| GET | `/v1/product/:id` | não | 200, 404 |
| POST | `/v1/product` | sim | 201, 400, 401 |
| PUT | `/v1/product/:id` | sim | 204, 400, 401, 404 |
| DELETE | `/v1/product/:id` | sim | 204, 401, 404 |

**Filtros da busca de categorias:** `limit` (padrão 12, `-1` traz tudo), `page`, `fields`, `use_in_menu`.

**Filtros da busca de produtos:** `limit`, `page`, `fields`, `match` (nome ou descrição), `category_ids` (ex.: `1,2`), `price-range` (ex.: `100-200`) e `option[ID]` (ex.: `option[45]=GG,PP`).

### Autenticação

1. Cadastre um usuário em `POST /v1/user`.
2. Gere o token em `POST /v1/user/token` com e-mail e senha.
3. Nas rotas protegidas, envie o cabeçalho `Authorization: Bearer <token>`.

No Swagger, use o botão **Authorize** e cole o token.

### Imagens dos produtos

As imagens são enviadas em **base64** (`{ "type": "image/png", "content": "..." }`), salvas na pasta `uploads/` e servidas em `/media/...`. Na resposta, cada imagem traz o link completo em `content`.

## Decisões de projeto

- **Token ausente ou inválido:** devolve **401**.
- **Rotas públicas mesmo sendo POST:** o cadastro de usuário e a geração do token, porque ninguém consegue se cadastrar ou entrar já tendo um token.
- **`price_with_discount`:** é obrigatório na criação do produto; use `0` quando não houver desconto.
- **Senha:** nunca é devolvida pela API, e é guardada com hash do bcrypt.
- **Erros:** sempre em JSON, no formato `{ "message": "..." }`.
