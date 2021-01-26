const {Model,DataTypes} = require("sequelize");
const sequelize = require('../config/sequelize').envios;
class Request extends Model{

}

Request.init({
    id : {
        type : DataTypes.BIGINT,
        primaryKey : true,
        autoIncrement : true
    },
    asociadoid : DataTypes.BIGINT,
    phone : DataTypes.INTEGER,
    asesorid: DataTypes.BIGINT,
    atendio: DataTypes.BIGINT,
    requested_at: {
        type : DataTypes.DATE,
        defaultValue : DataTypes.NOW
    },
    response_at:DataTypes.DATE,
    finished_at:DataTypes.DATE,
    accepted : {
        type : DataTypes.BOOLEAN,
        defaultValue : false
    },
    status : {
        type : DataTypes.STRING,
        defaultValue : "PENDIENTE"
    }
},{
    sequelize
})

module.exports = Request;