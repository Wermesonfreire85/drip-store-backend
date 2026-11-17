// Popula o banco com dados de exemplo (categorias, produtos e um usuário de teste).
// Uso: npm run seed  (rode depois das migrations). Pode rodar mais de uma vez sem duplicar.
require('dotenv').config({ quiet: true });
const bcrypt = require('bcrypt');
const { sequelize, User, Category, Product, ProductOption } = require('../models');

const categories = [
  { name: 'Camisetas', slug: 'camisetas', use_in_menu: true },
  { name: 'Calças', slug: 'calcas', use_in_menu: true },
  { name: 'Bonés', slug: 'bones', use_in_menu: true },
  { name: 'Headphones', slug: 'headphones', use_in_menu: true },
  { name: 'Tênis', slug: 'tenis', use_in_menu: true },
];

const shoeSizes = ['39', '40', '41', '42', '43'];
const jeansSizes = ['38', '40', '42', '44', '46'];

const products = [
  { name: 'K-Swiss V8 - Masculino', slug: 'k-swiss-v8-masculino', price: 200, price_with_discount: 100, stock: 20, category: 'tenis', sizes: shoeSizes },
  { name: 'Tênis Nike Revolution 6 Next Nature Masculino', slug: 'tenis-nike-revolution-6', price: 219, price_with_discount: 0, stock: 15, category: 'tenis', sizes: shoeSizes },
  { name: 'Headphone Over-Ear Bluetooth Prata', slug: 'headphone-over-ear-prata', price: 349.9, price_with_discount: 279.9, stock: 30, category: 'headphones', sizes: [] },
  { name: 'Boné Trucker Preto com Bandeira', slug: 'bone-trucker-preto', price: 89.9, price_with_discount: 0, stock: 50, category: 'bones', sizes: ['Único'] },
  { name: 'Calça Jeans Skinny Azul Masculina', slug: 'calca-jeans-skinny', price: 169.9, price_with_discount: 0, stock: 25, category: 'calcas', sizes: jeansSizes },
  { name: 'Calça Jeans Baggy Azul Claro Masculina', slug: 'calca-jeans-baggy', price: 219.9, price_with_discount: 189.9, stock: 18, category: 'calcas', sizes: jeansSizes },
  { name: 'Camisa de Linho Manga Curta Off-White', slug: 'camisa-linho-off-white', price: 129.9, price_with_discount: 0, stock: 40, category: 'camisetas', sizes: ['P', 'M', 'G', 'GG'] },
];

async function seed() {
  const bySlug = {};
  for (const data of categories) {
    const [category] = await Category.findOrCreate({ where: { slug: data.slug }, defaults: data });
    bySlug[data.slug] = category;
  }

  for (const { category, sizes, ...data } of products) {
    const [product, created] = await Product.findOrCreate({
      where: { slug: data.slug },
      defaults: { ...data, enabled: true, description: 'Produto de exemplo. Troque pela descrição real.' },
    });
    if (!created) continue;
    await product.setCategories([bySlug[category].id]);
    if (sizes.length) await ProductOption.create({ product_id: product.id, title: 'Tamanho', shape: 'square', radius: 4, type: 'text', values: sizes.join(',') });
  }

  // Usuário de teste (apenas para desenvolvimento): admin@digitalstore.com / 123456
  await User.findOrCreate({
    where: { email: 'admin@digitalstore.com' },
    defaults: { firstname: 'Admin', surname: 'Digital Store', password: await bcrypt.hash('123456', 10) },
  });

  console.log('Seed concluído: categorias, produtos e usuário de teste (admin@digitalstore.com / 123456)');
}

seed()
  .catch((error) => { console.error('Erro no seed:', error.message); process.exitCode = 1; })
  .finally(() => sequelize.close());
