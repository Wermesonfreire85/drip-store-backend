// Documentação da API no padrão OpenAPI (Swagger). Abra http://localhost:3000/api-docs
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const body = (schema) => ({ required: true, content: json(schema) });
const res = (description, schema) => (schema ? { description, content: json(schema) } : { description });
const secured = [{ bearerAuth: [] }];

const R400 = res('Dados da requisição incorretos', ref('Error'));
const R401 = res('Token de autorização não enviado ou inválido', ref('Error'));
const R404 = res('Recurso não encontrado', ref('Error'));
const R204 = res('Sucesso, sem conteúdo');

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer' } };
const pagination = [
  { name: 'limit', in: 'query', description: 'Itens por página (padrão 12). Use -1 para trazer todos.', schema: { type: 'integer', default: 12 } },
  { name: 'page', in: 'query', description: 'Página (padrão 1). Ignorado quando limit=-1.', schema: { type: 'integer', default: 1 } },
];

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Digital Store API',
    version: '1.0.0',
    description:
      'API da loja Digital Store (projeto final de Back-end). Rotas POST, PUT e DELETE exigem o cabeçalho ' +
      '`Authorization: Bearer <token>`, exceto o cadastro de usuário e a geração do token. ' +
      'Passo a passo: 1) cadastre um usuário, 2) gere o token em /v1/user/token, 3) clique em "Authorize" e cole o token.',
  },
  servers: [{ url: 'http://localhost:3000' }],
  tags: [{ name: 'Usuários' }, { name: 'Categorias' }, { name: 'Produtos' }],
  paths: {
    '/v1/user/token': {
      post: {
        tags: ['Usuários'], summary: 'Gerar token JWT (login)',
        requestBody: body(ref('Login')),
        responses: { 200: res('Token gerado', ref('Token')), 400: R400 },
      },
    },
    '/v1/user': {
      post: {
        tags: ['Usuários'], summary: 'Cadastrar usuário',
        requestBody: body(ref('UserCreate')),
        responses: { 201: res('Usuário criado', ref('User')), 400: R400 },
      },
    },
    '/v1/user/{id}': {
      get: {
        tags: ['Usuários'], summary: 'Obter usuário pelo ID', parameters: [idParam],
        responses: { 200: res('Usuário encontrado', ref('User')), 404: R404 },
      },
      put: {
        tags: ['Usuários'], summary: 'Atualizar usuário', security: secured, parameters: [idParam],
        requestBody: body(ref('UserUpdate')),
        responses: { 204: R204, 400: R400, 401: R401, 404: R404 },
      },
      delete: {
        tags: ['Usuários'], summary: 'Deletar usuário', security: secured, parameters: [idParam],
        responses: { 204: R204, 401: R401, 404: R404 },
      },
    },
    '/v1/category/search': {
      get: {
        tags: ['Categorias'], summary: 'Listar categorias',
        parameters: [
          ...pagination,
          { name: 'fields', in: 'query', description: 'Campos a retornar, ex.: name,slug', schema: { type: 'string' } },
          { name: 'use_in_menu', in: 'query', description: 'true para trazer só as categorias do menu', schema: { type: 'boolean' } },
        ],
        responses: { 200: res('Lista paginada', ref('CategoryList')), 400: R400 },
      },
    },
    '/v1/category': {
      post: {
        tags: ['Categorias'], summary: 'Cadastrar categoria', security: secured,
        requestBody: body(ref('CategoryInput')),
        responses: { 201: res('Categoria criada', ref('Category')), 400: R400, 401: R401 },
      },
    },
    '/v1/category/{id}': {
      get: {
        tags: ['Categorias'], summary: 'Obter categoria pelo ID', parameters: [idParam],
        responses: { 200: res('Categoria encontrada', ref('Category')), 404: R404 },
      },
      put: {
        tags: ['Categorias'], summary: 'Atualizar categoria', security: secured, parameters: [idParam],
        requestBody: body(ref('CategoryInput')),
        responses: { 204: R204, 400: R400, 401: R401, 404: R404 },
      },
      delete: {
        tags: ['Categorias'], summary: 'Deletar categoria', security: secured, parameters: [idParam],
        responses: { 204: R204, 401: R401, 404: R404 },
      },
    },
    '/v1/product/search': {
      get: {
        tags: ['Produtos'], summary: 'Listar produtos com filtros',
        parameters: [
          ...pagination,
          { name: 'fields', in: 'query', description: 'Campos a retornar, ex.: name,images,price', schema: { type: 'string' } },
          { name: 'match', in: 'query', description: 'Termo que combine com o nome ou a descrição', schema: { type: 'string' } },
          { name: 'category_ids', in: 'query', description: 'IDs de categorias separados por vírgula, ex.: 1,2', schema: { type: 'string' } },
          { name: 'price-range', in: 'query', description: 'Faixa de preço, ex.: 100-200', schema: { type: 'string' } },
          { name: 'option[45]', in: 'query', description: 'Filtra pelo valor da opção de ID 45, ex.: option[45]=GG,PP', schema: { type: 'string' } },
        ],
        responses: { 200: res('Lista paginada', ref('ProductList')), 400: R400 },
      },
    },
    '/v1/product': {
      post: {
        tags: ['Produtos'], summary: 'Criar produto', security: secured,
        requestBody: body(ref('ProductCreate')),
        responses: { 201: res('Produto criado', ref('Product')), 400: R400, 401: R401 },
      },
    },
    '/v1/product/{id}': {
      get: {
        tags: ['Produtos'], summary: 'Obter produto pelo ID', parameters: [idParam],
        responses: { 200: res('Produto encontrado', ref('Product')), 404: R404 },
      },
      put: {
        tags: ['Produtos'], summary: 'Atualizar produto', security: secured, parameters: [idParam],
        description:
          'Imagens: sem `id` = nova; `id` + `deleted: true` = apagar; `id` + `type` + `content` (base64) = trocar; `id` + URL = manter. ' +
          'Opções: sem `id` = nova; `id` + `deleted: true` = apagar; `id` + campos = atualizar.',
        requestBody: body(ref('ProductUpdate')),
        responses: { 204: R204, 400: R400, 401: R401, 404: R404 },
      },
      delete: {
        tags: ['Produtos'], summary: 'Deletar produto', security: secured, parameters: [idParam],
        responses: { 204: R204, 401: R401, 404: R404 },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: { type: 'object', properties: { message: { type: 'string', example: 'Descrição do erro' } } },
      Login: {
        type: 'object', required: ['email', 'password'],
        properties: { email: { type: 'string', example: 'user@mail.com' }, password: { type: 'string', example: '123@123' } },
      },
      Token: { type: 'object', properties: { token: { type: 'string' } } },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 }, firstname: { type: 'string', example: 'Maria' },
          surname: { type: 'string', example: 'Silva' }, email: { type: 'string', example: 'maria@mail.com' },
        },
      },
      UserCreate: {
        type: 'object', required: ['firstname', 'surname', 'email', 'password', 'confirmPassword'],
        properties: {
          firstname: { type: 'string', example: 'Maria' }, surname: { type: 'string', example: 'Silva' },
          email: { type: 'string', example: 'maria@mail.com' },
          password: { type: 'string', description: 'Mínimo de 6 caracteres', example: '123@123' },
          confirmPassword: { type: 'string', example: '123@123' },
        },
      },
      UserUpdate: {
        type: 'object',
        properties: { firstname: { type: 'string' }, surname: { type: 'string' }, email: { type: 'string' } },
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 }, name: { type: 'string', example: 'Shoes' },
          slug: { type: 'string', example: 'shoes' }, use_in_menu: { type: 'boolean', example: true },
        },
      },
      CategoryInput: {
        type: 'object', required: ['name', 'slug'],
        properties: {
          name: { type: 'string', example: 'Shoes' }, slug: { type: 'string', example: 'shoes' },
          use_in_menu: { type: 'boolean', example: true },
        },
      },
      CategoryList: {
        type: 'object',
        properties: {
          data: { type: 'array', items: ref('Category') }, total: { type: 'integer' },
          limit: { type: 'integer' }, page: { type: 'integer' },
        },
      },
      Option: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, title: { type: 'string', example: 'Tamanho' },
          shape: { type: 'string', enum: ['square', 'circle'] }, radius: { type: 'integer', example: 4 },
          type: { type: 'string', enum: ['text', 'color'] }, values: { type: 'array', items: { type: 'string' }, example: ['39', '40'] },
        },
      },
      OptionInput: {
        type: 'object', required: ['title', 'values'],
        properties: {
          title: { type: 'string', example: 'Tamanho' }, shape: { type: 'string', enum: ['square', 'circle'], default: 'square' },
          radius: { type: 'string', example: '4px', description: 'Aceita número ou texto como "4px"' },
          type: { type: 'string', enum: ['text', 'color'], default: 'text' },
          values: { type: 'array', items: { type: 'string' }, example: ['39', '40', '41'] },
        },
      },
      ImageInput: {
        type: 'object', required: ['type', 'content'],
        properties: { type: { type: 'string', example: 'image/png' }, content: { type: 'string', description: 'Imagem em base64' } },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, enabled: { type: 'boolean' }, name: { type: 'string' }, slug: { type: 'string' },
          use_in_menu: { type: 'boolean' }, stock: { type: 'integer' }, description: { type: 'string' },
          price: { type: 'number' }, price_with_discount: { type: 'number' },
          category_ids: { type: 'array', items: { type: 'integer' } },
          images: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, content: { type: 'string' } } } },
          options: { type: 'array', items: ref('Option') },
        },
      },
      ProductCreate: {
        type: 'object', required: ['name', 'slug', 'price', 'price_with_discount'],
        properties: {
          enabled: { type: 'boolean', example: true }, name: { type: 'string', example: 'Produto 01' },
          slug: { type: 'string', example: 'produto-01' }, use_in_menu: { type: 'boolean' },
          stock: { type: 'integer', example: 10 }, description: { type: 'string', example: 'Descrição do produto 01' },
          price: { type: 'number', example: 119.9 }, price_with_discount: { type: 'number', example: 99.9 },
          category_ids: { type: 'array', items: { type: 'integer' }, example: [1] },
          images: { type: 'array', items: ref('ImageInput') }, options: { type: 'array', items: ref('OptionInput') },
        },
      },
      ProductUpdate: {
        type: 'object',
        description: 'Todos os campos são opcionais; envie só o que quer alterar.',
        properties: {
          enabled: { type: 'boolean' }, name: { type: 'string' }, slug: { type: 'string' }, use_in_menu: { type: 'boolean' },
          stock: { type: 'integer' }, description: { type: 'string' }, price: { type: 'number' }, price_with_discount: { type: 'number' },
          category_ids: { type: 'array', items: { type: 'integer' } },
          images: { type: 'array', items: { type: 'object' } }, options: { type: 'array', items: { type: 'object' } },
        },
      },
      ProductList: {
        type: 'object',
        properties: {
          data: { type: 'array', items: ref('Product') }, total: { type: 'integer' },
          limit: { type: 'integer' }, page: { type: 'integer' },
        },
      },
    },
  },
};
