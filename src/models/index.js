// Cria a conexão com o banco e junta todos os models, definindo as relações entre eles.
const { Sequelize } = require('sequelize');
const configs = require('../config/config');

const env = process.env.NODE_ENV || 'development';
const { database, username, password, ...options } = configs[env];

const sequelize = new Sequelize(database, username, password, options);

const User = require('./user')(sequelize);
const Category = require('./category')(sequelize);
const Product = require('./product')(sequelize);
const ProductImage = require('./productImage')(sequelize);
const ProductOption = require('./productOption')(sequelize);
const ProductCategory = require('./productCategory')(sequelize);

// Relações: um produto tem várias imagens, várias opções e várias categorias.
Product.hasMany(ProductImage, { as: 'images', foreignKey: 'product_id', onDelete: 'CASCADE' });
ProductImage.belongsTo(Product, { foreignKey: 'product_id' });

Product.hasMany(ProductOption, { as: 'options', foreignKey: 'product_id', onDelete: 'CASCADE' });
ProductOption.belongsTo(Product, { foreignKey: 'product_id' });

Product.belongsToMany(Category, { through: ProductCategory, as: 'categories', foreignKey: 'product_id', otherKey: 'category_id' });
Category.belongsToMany(Product, { through: ProductCategory, as: 'products', foreignKey: 'category_id', otherKey: 'product_id' });

module.exports = { sequelize, User, Category, Product, ProductImage, ProductOption, ProductCategory };
