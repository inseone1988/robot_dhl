// const CPDB = require("../database/sequelize").CP;
const {Op} = require("sequelize");
const CP = require("../models/cpmodel");
const CPDB = require("../database/sequelize").CP;
// (async()=>{
//     CPDB.sync({
//         // force : true
//     })
//         .then(()=>{
//             CP.importExcel();
//         })
// })()

exports.getCPData = (req,res,next)=>{
    let cp = req.params.cp;
    if (cp.length === 5 && !isNaN(cp)){
        CP.findAll({
            where : {
                codigo : cp
            }
        }).then(r=>{
            console.log(r);
            res.send({success : true, payload : r});
        }).catch(e=>{
            res.send({
                success : false,
                message : e.message
            });
        });
    }else {
        res.send({success : false, message : "El codigo postal debe ser a 5 digitos"});
    }
}
