const {Sequelize} = require("sequelize");

exports.envios = new Sequelize("envios","macro_node","g~8R0yq3",{
    host : "localhost",
    dialect : "mysql"
})