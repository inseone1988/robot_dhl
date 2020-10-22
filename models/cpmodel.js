const {DataTypes,Model} = require("sequelize");
const sequelize = require("../database/sequelize").CP;
const XLSX = require("xlsx");
const path = require("path");

class CP extends Model {

    static importExcel(){
        console.log("Importing excel");
       const workbook = XLSX.readFile(path.resolve(__dirname,"../CPdescarga.xls"));
       //console.log(workbook);
       if (workbook){
           workbook.SheetNames.forEach((value,index)=>{
               console.log(`Hojas : ${workbook.SheetNames.length}`);
               console.log(`Procesando : ${value}`);
               let cWorksheet = workbook.Sheets[value];
               let hasNext = true;
               let cRow = 2;
               let data = [];
               while(hasNext && cWorksheet){
                   console.log(`Hoja : ${value} Fila : ${cRow}`);
                   data.push({
                       codigo : cWorksheet[`A${cRow}`] ? cWorksheet[`A${cRow}`].v : "",
                       asentamiento : cWorksheet[`B${cRow}`] ? cWorksheet[`B${cRow}`].v : "",
                       tipoAsentamiento : cWorksheet[`C${cRow}`] ? cWorksheet[`C${cRow}`].v : "",
                       municipio : cWorksheet[`D${cRow}`] ? cWorksheet[`D${cRow}`].v : "",
                       estado : cWorksheet[`E${cRow}`] ? cWorksheet[`E${cRow}`].v : "",
                       ciudad : cWorksheet[`F${cRow}`] ? cWorksheet[`F${cRow}`].v : ""
                   });
                   hasNext = cWorksheet[`A${cRow + 1}`];
                   cRow += 1;
               }
               console.log(`Insertando ${data.length} records`);
               CP.bulkCreate(data).then((r)=>{
                   console.log(r);
               });
           })
       }
    }
}

Model.init({
    id :{
        type : DataTypes.BIGINT,
        autoIncrement : true,
        primaryKey : true,
        unique : true
    },
    codigo : DataTypes.INTEGER,
    asentamiento : DataTypes.STRING,
    tipoAsentamiento : DataTypes.STRING,
    municipio : DataTypes.STRING,
    estado : DataTypes.STRING,
    ciudad : DataTypes.STRING
},{
    sequelize,
    tableName : "codigos"
})

module.exports = CP;