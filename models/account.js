const {Model,DataTypes,Op} = require("sequelize");
const sequelize = require("../database/sequelize").CP;

class Accounts extends Model{
    static async getAccount(){
        let account = await Accounts.findOne({
            where : {
                sessionCount : {
                    [Op.between] : [0,2]
                }
            },
            order : sequelize.fn('random')
        })
        if (account){
            account.sessionCount = (account.sessionCount + 1);
            return account.save();
        }
        return account;
    }

    static async subSession(userid){
        let account = await Accounts.findByPk(userid);
        if (account.sessionCount > 0) account.sessionCount = (account.sessionCount - 1);
        return account.save();
    }
}

Accounts.init({
    id : {
        type : DataTypes.INTEGER,
        primaryKey : true,
        autoIncrement :true
    },
    username : DataTypes.STRING,
    password : DataTypes.STRING,
    sessionCount : {
        type : DataTypes.INTEGER,
    }
},{
    sequelize,
    tableName : "account"
})

module.exports = {Accounts};