const jose = require("jose");
const createError = require("http-errors");
const key = "izvZZpUxEZALVIfYP0nd";
// const key = "izvZZpUxEZALVIfYP0n5";
const {hasDisponibles,validate,sanitize,formatInput,sheetData,createFile,trimInput} = require("../controllers/mydhlgenerate");
const queries = require("../classes/queries");
const Generator = require("../classes/generator");

exports.authenticate = (req, res, next) => {
    console.log("This always executes");
    const jwt = req.headers.authorization;
    if (!jwt) {
        return next(createError(403, "Token invalido"));
    }
    try {
        jose.JWT.verify(jwt, key);
    } catch (e) {
        return next(createError(403, "Token invalido"));
    }
    let data = jose.JWT.decode(jwt, key);
    let now = (Date.now() / 1000);
    // if (data.exp < now) {
    //     return next(createError(400, "El token expiro"));
    // }
    next();
}

exports.generateGuide = async (req, res, next) => {
    let gData = req.body;
    gData.permissions = await queries.userPermissions(gData.client_id);
    trimInput(gData);
    let v = await validate(gData);
    if (!v){
        formatInput(gData);
        let filename = createFile(gData);
        console.log(filename);
        let generator = new Generator(gData,filename);
        generator.onError = (e)=>{
            return next(createError(400,e.message));
        }
        Generator.p.add(generator)
            .then(r=>{
                res.send({success : true, payload : {tracking : generator.data.generated[0]}}).end();
            }).catch(e=>{
                return next(createError(400,e.message));
        })
    }else{
        return next(createError(400,v));
    }
}