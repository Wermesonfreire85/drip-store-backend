const { DataTypes } = require('sequelize');

// Tabela "product_categories": liga produtos a categorias (um produto pode ter várias categorias).
module.exports = (sequelize) =>
  sequelize.define(
    'ProductCategory',
    {
      product_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
      category_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    },
    { tableName: 'product_categories', timestamps: false }
  );
