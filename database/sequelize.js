const {Sequelize} = require("sequelize");
const path = require("path");

// exports.EDB = new Sequelize('envios', 'macro_node', 'g~8R0yq3', {
//     host: 'sistema.globalpaq.mx',
//     dialect: 'mariadb'
// });
//
// exports.LOCALDB = new Sequelize('local', 'macro_node', 'g~8R0yq3', {
//     host: 'sistema.globalpaq.mx',
//     dialect: 'mariadb'
// })

// exports.CP = new Sequelize('codigos', 'macro_node', 'g~8R0yq3', {
//     dialect: "mysql",
//     host: 'localhost'
// });
//Dev
exports.EDB = new Sequelize('envios','devserver','devserver',{
    host : 'localhost',
    dialect : 'mysql'
});

exports.LOCALDB = new Sequelize('enviosLocal','devserver','devserver',{
    host : 'localhost',
    dialect : 'mysql'
})
//
exports.CP = new Sequelize({
    dialect : "sqlite",
    storage : path.resolve(__dirname,"../cp.db")
});