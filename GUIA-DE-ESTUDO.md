# Guia de estudo do projeto (para explicar o código)

## O caminho de uma requisição
Exemplo: `POST /v1/category` (criar categoria)

1. **`app.js`** recebe a requisição e entrega para as rotas em `/v1`.
2. **`routes/categoryRoutes.js`** vê "POST na raiz" e manda para o middleware `authenticate` e depois para o controller.
3. **`middleware/auth.js`** confere o token JWT. Sem token válido, responde 401 e para por aqui.
4. **`controllers/categoryController.js`** pega o corpo da requisição (`req.body`), chama o serviço e responde com o status (201).
5. **`services/categoryService.js`** valida os dados (400 se estiverem errados), confere se o slug já existe e pede ao model para salvar.
6. **`models/category.js`** (Sequelize) transforma isso em SQL e grava na tabela `categories`.
7. Se algo lança um erro, o **`middleware/errorHandler.js`** transforma em resposta JSON com o status certo.

## Vocabulário
- **Rota:** endereço + método (GET, POST...) que a API entende.
- **Controller:** camada que fala HTTP (recebe e responde). Não tem regra de negócio.
- **Service:** camada com as regras (validar, calcular, decidir). Não conhece HTTP.
- **Model:** representa uma tabela do banco no código.
- **ORM (Sequelize):** biblioteca que permite usar o banco com JavaScript em vez de escrever SQL.
- **Migration:** arquivo que cria ou altera tabelas, com `up` (aplicar) e `down` (desfazer). Versiona o banco como o Git versiona o código.
- **Middleware:** função que roda no meio do caminho (ex.: conferir o token) antes do controller.
- **JWT:** "crachá" digital assinado que o servidor entrega no login; o cliente o envia nas próximas requisições.
- **bcrypt:** gera o *hash* da senha. Não dá para voltar do hash para a senha, só comparar.
- **Transação:** agrupa várias gravações; se uma falhar, nenhuma vale (usada ao criar e atualizar produtos).
- **CASCADE:** ao apagar o produto, o banco apaga também as imagens e opções ligadas a ele.
- **MVC:** separar o projeto em Model (dados), View (aqui, o JSON de resposta) e Controller.

## Perguntas que o professor pode fazer
1. **Por que separar controller e service?** Para o controller cuidar só do HTTP e o service só das regras; assim dá para testar e reaproveitar as regras.
2. **Como a senha é protegida?** `bcrypt.hash` ao cadastrar (`userService.create`) e `bcrypt.compare` no login (`generateToken`). A senha nunca é devolvida.
3. **Como funciona o login?** `POST /v1/user/token` confere e-mail e senha e devolve um JWT assinado com `JWT_SECRET`, que expira.
4. **Como as rotas são protegidas?** O middleware `authenticate` lê o cabeçalho `Authorization: Bearer ...` e verifica o token. Falhou, 401.
5. **O que é uma migration e por que usar?** Cria as tabelas por código, de forma repetível e reversível; todo mundo da equipe monta o mesmo banco com `npm run migrate`.
6. **Como são guardadas as imagens?** O cliente manda base64; o servidor grava o arquivo em `uploads/` e salva só o caminho no banco.
7. **Como funciona a relação produto e categoria?** Muitos-para-muitos pela tabela `product_categories` (`product_id` e `category_id`).
8. **O que significam 200, 201, 204, 400, 401 e 404?** Sucesso, criado, sucesso sem conteúdo, dados inválidos, sem permissão (token), e não encontrado.
9. **Como a busca com filtros funciona?** O `productService.search` monta as condições (`match`, `price-range`, `category_ids`, `option[ID]`) e faz a consulta paginada com `limit` e `page`.
10. **Como vocês testaram?** Com Jest e Supertest, contra um banco de testes separado (`npm test`).

## Onde está cada requisito
| Requisito | Onde |
|---|---|
| CRUD completo | `services/*Service.js` e `controllers/*Controller.js` |
| Autenticação | `middleware/auth.js` e `services/userService.js` |
| Erros e status HTTP | `utils/AppError.js` e `middleware/errorHandler.js` |
| Padrão MVC | pastas `models`, `controllers` e `routes` |
| Migrations | `src/database/migrations` |
| Swagger | `src/docs/swagger.js` (veja em `/api-docs`) |
| Testes | `tests/api.test.js` |
