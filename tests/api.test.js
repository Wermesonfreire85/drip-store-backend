// Testes automáticos da API (Jest + Supertest). Rode com:  npm test
// Eles usam um banco SEPARADO (DB_NAME_TEST), que é apagado e recriado a cada execução.
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'drip-uploads-'));

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');

// Uma imagem PNG de 1x1 pixel, em base64, para testar o upload.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

let token;
let userId;
let shoesId;

beforeAll(async () => {
  await sequelize.sync({ force: true }); // recria as tabelas vazias
});

afterAll(async () => {
  await sequelize.close();
  fs.rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('Usuários e login (JWT)', () => {
  const payload = { firstname: 'Maria', surname: 'Silva', email: 'maria@mail.com', password: '123@123', confirmPassword: '123@123' };

  test('POST /v1/user cadastra e devolve 201 sem expor a senha', async () => {
    const res = await request(app).post('/v1/user').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(Number), firstname: 'Maria', surname: 'Silva', email: 'maria@mail.com' });
    userId = res.body.id;
  });

  test('POST /v1/user com senhas diferentes devolve 400', async () => {
    const res = await request(app).post('/v1/user').send({ ...payload, email: 'outro@mail.com', confirmPassword: 'xxxxxx' });
    expect(res.status).toBe(400);
  });

  test('POST /v1/user com e-mail repetido devolve 400', async () => {
    expect((await request(app).post('/v1/user').send(payload)).status).toBe(400);
  });

  test('POST /v1/user com e-mail inválido devolve 400', async () => {
    const res = await request(app).post('/v1/user').send({ ...payload, email: 'sem-arroba' });
    expect(res.status).toBe(400);
  });

  test('a senha é salva criptografada no banco', async () => {
    const user = await User.findByPk(userId);
    expect(user.password).not.toBe('123@123');
    expect(user.password.startsWith('$2')).toBe(true); // formato do bcrypt
  });

  test('POST /v1/user/token com senha errada devolve 400', async () => {
    const res = await request(app).post('/v1/user/token').send({ email: 'maria@mail.com', password: 'errada' });
    expect(res.status).toBe(400);
  });

  test('POST /v1/user/token com dados corretos devolve 200 e o token', async () => {
    const res = await request(app).post('/v1/user/token').send({ email: 'maria@mail.com', password: '123@123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    token = res.body.token;
  });

  test('GET /v1/user/:id devolve 200 e 404 quando não existe', async () => {
    expect((await request(app).get(`/v1/user/${userId}`)).status).toBe(200);
    expect((await request(app).get('/v1/user/9999')).status).toBe(404);
  });

  test('PUT /v1/user/:id sem token devolve 401; com token devolve 204', async () => {
    expect((await request(app).put(`/v1/user/${userId}`).send({ firstname: 'Ana' })).status).toBe(401);
    expect((await request(app).put(`/v1/user/${userId}`).set({ Authorization: 'Bearer token-falso' }).send({ firstname: 'Ana' })).status).toBe(401);
    const res = await request(app).put(`/v1/user/${userId}`).set(auth()).send({ firstname: 'Ana' });
    expect(res.status).toBe(204);
    expect((await request(app).get(`/v1/user/${userId}`)).body.firstname).toBe('Ana');
  });

  test('PUT /v1/user/:id com dados inválidos devolve 400 e id inexistente devolve 404', async () => {
    expect((await request(app).put(`/v1/user/${userId}`).set(auth()).send({ email: 'ruim' })).status).toBe(400);
    expect((await request(app).put('/v1/user/9999').set(auth()).send({ firstname: 'X' })).status).toBe(404);
  });
});

describe('Categorias', () => {
  let offersId;

  test('POST /v1/category sem token devolve 401', async () => {
    expect((await request(app).post('/v1/category').send({ name: 'Shoes', slug: 'shoes' })).status).toBe(401);
  });

  test('POST /v1/category cria com 201', async () => {
    const shoes = await request(app).post('/v1/category').set(auth()).send({ name: 'Shoes', slug: 'shoes', use_in_menu: true });
    expect(shoes.status).toBe(201);
    expect(shoes.body).toEqual({ id: expect.any(Number), name: 'Shoes', slug: 'shoes', use_in_menu: true });
    shoesId = shoes.body.id;
    const offers = await request(app).post('/v1/category').set(auth()).send({ name: 'Offers', slug: 'offers' });
    offersId = offers.body.id;
    expect(offers.body.use_in_menu).toBe(false); // padrão é false
  });

  test('POST /v1/category com slug repetido ou dados inválidos devolve 400', async () => {
    expect((await request(app).post('/v1/category').set(auth()).send({ name: 'Outra', slug: 'shoes' })).status).toBe(400);
    expect((await request(app).post('/v1/category').set(auth()).send({ name: 'Sem slug' })).status).toBe(400);
    expect((await request(app).post('/v1/category').set(auth()).send({ name: 'Slug ruim', slug: 'Slug Ruim' })).status).toBe(400);
  });

  test('GET /v1/category/search lista com paginação, filtro e campos', async () => {
    const all = await request(app).get('/v1/category/search?limit=-1');
    expect(all.status).toBe(200);
    expect(all.body).toMatchObject({ total: 2, limit: -1, page: 1 });
    expect(all.body.data).toHaveLength(2);

    const page = await request(app).get('/v1/category/search?limit=1&page=2');
    expect(page.body.data).toHaveLength(1);
    expect(page.body.data[0].slug).toBe('offers');

    const menu = await request(app).get('/v1/category/search?use_in_menu=true&fields=name,slug');
    expect(menu.body.data).toEqual([{ name: 'Shoes', slug: 'shoes' }]);
  });

  test('GET /v1/category/search com parâmetros inválidos devolve 400', async () => {
    expect((await request(app).get('/v1/category/search?limit=abc')).status).toBe(400);
    expect((await request(app).get('/v1/category/search?page=0')).status).toBe(400);
    expect((await request(app).get('/v1/category/search?fields=senha')).status).toBe(400);
    expect((await request(app).get('/v1/category/search?use_in_menu=talvez')).status).toBe(400);
  });

  test('GET /v1/category/:id devolve 200 e 404', async () => {
    expect((await request(app).get(`/v1/category/${shoesId}`)).status).toBe(200);
    expect((await request(app).get('/v1/category/9999')).status).toBe(404);
  });

  test('PUT /v1/category/:id devolve 401, 204, 400 e 404', async () => {
    expect((await request(app).put(`/v1/category/${offersId}`).send({ name: 'X' })).status).toBe(401);
    expect((await request(app).put(`/v1/category/${offersId}`).set(auth()).send({ name: 'Ofertas', slug: 'ofertas', use_in_menu: true })).status).toBe(204);
    expect((await request(app).get(`/v1/category/${offersId}`)).body.slug).toBe('ofertas');
    expect((await request(app).put(`/v1/category/${offersId}`).set(auth()).send({ slug: 'shoes' })).status).toBe(400);
    expect((await request(app).put('/v1/category/9999').set(auth()).send({ name: 'X' })).status).toBe(404);
  });

  test('DELETE /v1/category/:id devolve 401, 204 e 404', async () => {
    expect((await request(app).delete(`/v1/category/${offersId}`)).status).toBe(401);
    expect((await request(app).delete(`/v1/category/${offersId}`).set(auth())).status).toBe(204);
    expect((await request(app).delete(`/v1/category/${offersId}`).set(auth())).status).toBe(404);
  });
});

describe('Produtos', () => {
  let product;

  const newProduct = () => ({
    enabled: true,
    name: 'Tênis Teste',
    slug: 'tenis-teste',
    stock: 10,
    description: 'Um tênis para testar',
    price: 119.9,
    price_with_discount: 99.9,
    category_ids: [shoesId],
    images: [{ type: 'image/png', content: PNG_BASE64 }, { type: 'image/png', content: PNG_BASE64 }],
    options: [
      { title: 'Tamanho', shape: 'square', radius: '4px', type: 'text', values: ['39', '40', '41'] },
      { title: 'Cor', shape: 'circle', type: 'color', values: ['#000', '#333'] },
    ],
  });

  test('POST /v1/product sem token devolve 401', async () => {
    expect((await request(app).post('/v1/product').send(newProduct())).status).toBe(401);
  });

  test('POST /v1/product cria com 201 e devolve imagens, opções e categorias', async () => {
    const res = await request(app).post('/v1/product').set(auth()).send(newProduct());
    expect(res.status).toBe(201);
    product = res.body;
    expect(product).toMatchObject({ name: 'Tênis Teste', slug: 'tenis-teste', price: 119.9, price_with_discount: 99.9, stock: 10, enabled: true });
    expect(product.category_ids).toEqual([shoesId]);
    expect(product.images).toHaveLength(2);
    expect(product.options).toHaveLength(2);
    expect(product.options[0]).toMatchObject({ title: 'Tamanho', shape: 'square', radius: 4, type: 'text', values: ['39', '40', '41'] });
  });

  test('as imagens do produto ficam acessíveis pelo link retornado', async () => {
    const url = new URL(product.images[0].content);
    const res = await request(app).get(url.pathname);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
  });

  test('POST /v1/product com dados inválidos devolve 400', async () => {
    const send = (patch) => request(app).post('/v1/product').set(auth()).send({ ...newProduct(), slug: 'outro', ...patch });
    expect((await send({ name: undefined })).status).toBe(400);
    expect((await send({ price: 'caro' })).status).toBe(400);
    expect((await send({ price_with_discount: undefined })).status).toBe(400);
    expect((await send({ category_ids: [9999] })).status).toBe(400);
    expect((await send({ images: [{ type: 'application/pdf', content: 'abc' }] })).status).toBe(400);
    expect((await send({ options: [{ title: 'Sem valores' }] })).status).toBe(400);
    expect((await send({ slug: 'tenis-teste' })).status).toBe(400); // slug repetido
  });

  test('GET /v1/product/:id devolve 200 e 404', async () => {
    const res = await request(app).get(`/v1/product/${product.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(product.id);
    expect((await request(app).get('/v1/product/9999')).status).toBe(404);
  });

  test('GET /v1/product/search aplica match, category_ids, price-range, option e fields', async () => {
    // Segundo produto, sem categoria, para provar que os filtros separam os resultados.
    await request(app).post('/v1/product').set(auth()).send({
      name: 'Camiseta Azul', slug: 'camiseta-azul', price: 50, price_with_discount: 0, description: 'Algodão',
      options: [{ title: 'Tamanho', values: ['P', 'M', 'GG'] }],
    });

    const names = (res) => res.body.data.map((p) => p.name);

    const all = await request(app).get('/v1/product/search?limit=-1');
    expect(all.body.total).toBe(2);

    expect(names(await request(app).get(`/v1/product/search?match=${encodeURIComponent('Tênis')}`))).toEqual(['Tênis Teste']);
    expect(names(await request(app).get('/v1/product/search?match=Algod'))).toEqual(['Camiseta Azul']); // procura na descrição
    expect(names(await request(app).get(`/v1/product/search?category_ids=${shoesId}`))).toEqual(['Tênis Teste']);
    expect(names(await request(app).get('/v1/product/search?price-range=100-200'))).toEqual(['Tênis Teste']);
    expect(names(await request(app).get('/v1/product/search?price-range=10-60'))).toEqual(['Camiseta Azul']);

    const sizeOption = product.options[0].id;
    expect(names(await request(app).get(`/v1/product/search?option[${sizeOption}]=40,99`))).toEqual(['Tênis Teste']);
    expect((await request(app).get(`/v1/product/search?option[${sizeOption}]=XXL`)).body.total).toBe(0);

    const fields = await request(app).get('/v1/product/search?fields=name,price&limit=1&page=2');
    expect(fields.body).toMatchObject({ total: 2, limit: 1, page: 2 });
    expect(fields.body.data).toEqual([{ name: 'Camiseta Azul', price: 50 }]);
  });

  test('GET /v1/product/search com parâmetros inválidos devolve 400', async () => {
    expect((await request(app).get('/v1/product/search?price-range=abc')).status).toBe(400);
    expect((await request(app).get('/v1/product/search?category_ids=a,b')).status).toBe(400);
    expect((await request(app).get('/v1/product/search?limit=-5')).status).toBe(400);
    expect((await request(app).get('/v1/product/search?fields=segredo')).status).toBe(400);
    expect((await request(app).get('/v1/product/search?option[abc]=GG')).status).toBe(400);
  });

  test('PUT /v1/product/:id atualiza campos, imagens e opções (204)', async () => {
    const [keep, remove] = product.images;
    const [sizeOption, colorOption] = product.options;

    const res = await request(app).put(`/v1/product/${product.id}`).set(auth()).send({
      name: 'Tênis Teste Atualizado',
      price: 49.9,
      price_with_discount: 0,
      stock: 20,
      images: [
        { type: 'image/png', content: PNG_BASE64 }, // nova
        { id: remove.id, deleted: true }, // apagar
        { id: keep.id, content: keep.content }, // manter (URL)
      ],
      options: [
        { id: colorOption.id, deleted: true }, // apagar
        { id: sizeOption.id, radius: '10px', values: ['42/43', '44/45'] }, // atualizar
        { title: 'Tipo', shape: 'square', type: 'text', values: ['100% algodão', '65% algodão'] }, // nova
      ],
    });
    expect(res.status).toBe(204);

    const updated = (await request(app).get(`/v1/product/${product.id}`)).body;
    expect(updated).toMatchObject({ name: 'Tênis Teste Atualizado', price: 49.9, price_with_discount: 0, stock: 20 });
    expect(updated.images).toHaveLength(2);
    expect(updated.images.map((i) => i.id)).toContain(keep.id);
    expect(updated.images.map((i) => i.id)).not.toContain(remove.id);
    expect(updated.options).toHaveLength(2);
    expect(updated.options[0]).toMatchObject({ id: sizeOption.id, radius: 10, values: ['42/43', '44/45'] });
    expect(updated.options[1]).toMatchObject({ title: 'Tipo', values: ['100% algodão', '65% algodão'] });
  });

  test('PUT /v1/product/:id devolve 401, 400 e 404 nos casos de erro', async () => {
    expect((await request(app).put(`/v1/product/${product.id}`).send({ name: 'X' })).status).toBe(401);
    expect((await request(app).put(`/v1/product/${product.id}`).set(auth()).send({ price: -1 })).status).toBe(400);
    expect((await request(app).put(`/v1/product/${product.id}`).set(auth()).send({ images: [{ id: 9999, deleted: true }] })).status).toBe(400);
    expect((await request(app).put('/v1/product/9999').set(auth()).send({ name: 'X' })).status).toBe(404);
  });

  test('DELETE /v1/product/:id devolve 401, 204 e 404, e apaga as imagens do disco', async () => {
    expect((await request(app).delete(`/v1/product/${product.id}`)).status).toBe(401);
    expect((await request(app).delete(`/v1/product/${product.id}`).set(auth())).status).toBe(204);
    expect((await request(app).get(`/v1/product/${product.id}`)).status).toBe(404);
    expect((await request(app).delete(`/v1/product/${product.id}`).set(auth())).status).toBe(404);
    expect(fs.existsSync(path.join(process.env.UPLOADS_DIR, `product-${product.id}`))).toBe(false);
  });
});

describe('Geral', () => {
  test('rota inexistente devolve 404 em JSON', async () => {
    const res = await request(app).get('/v1/nada');
    expect(res.status).toBe(404);
    expect(res.body.message).toBeDefined();
  });

  test('JSON com sintaxe errada devolve 400', async () => {
    const res = await request(app).post('/v1/user').set('Content-Type', 'application/json').send('{ quebrado');
    expect(res.status).toBe(400);
  });

  test('DELETE /v1/user/:id devolve 401, 204 e 404', async () => {
    expect((await request(app).delete(`/v1/user/${userId}`)).status).toBe(401);
    expect((await request(app).delete(`/v1/user/${userId}`).set(auth())).status).toBe(204);
    expect((await request(app).get(`/v1/user/${userId}`)).status).toBe(404);
  });

  test('a documentação Swagger está no ar', async () => {
    expect((await request(app).get('/api-docs/')).status).toBe(200);
  });
});
