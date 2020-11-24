const conn = require("../database/sequelize");
const fetch = require("node-fetch");
const {URLSearchParams} = require("url");


exports.userPermissions = async (idasociado) => {
    let query = `SELECT idasociado, activo, seguro, excedente, recoleccion FROM Asociados WHERE idasociado = ${idasociado}`;
    let permissions = await conn.EDB.query(query);
    return permissions[0][0];
}

exports.getDisponibles = async (idAsociado, tipoguia, peso) => {
    let query = `SELECT idtipoguia, peso, sum(cantidad) AS total,( SELECT count(idhistorial) FROM Historialdhl WHERE idasociado = ${idAsociado} AND idtipoguia = Asig.idtipoguia AND pesoguia = Asig.peso AND idhijo IS NULL AND statusenvio != 5) + ( SELECT COALESCE(SUM(SubA.cantidad),0) FROM SubAsignaciones SubA WHERE SubA.idasociado = Asig.idasociado AND SubA.peso = Asig.peso AND SubA.idtipoguia = Asig.idtipoguia )AS usadas FROM Asignaciones Asig WHERE idasociado = ${idAsociado} AND venta > 0 AND (idtipoguia = 31 or idtipoguia = 32) GROUP BY idtipoguia, peso HAVING (total-usadas) > 0 `;
    let result = await conn.EDB.query(query);
    let disp = 0;
    // console.log(result[0]);
    result[0].forEach((value, index) => {
        if (value.idtipoguia === Number(tipoguia) && value.peso === Number(peso)) {
            let r = (Number(value.total) - Number(value.usadas));
            disp = r > 0 ? r : 0;
        }
    });
    console.log(`Tipo guia : ${tipoguia} , peso ${peso},Guias disponibles ${disp}`);
    return disp > 0;
}

exports.validateCobertura = async (idasociado, zipfrom, zipto) => {
    let cobertura = await fetch(`https://sistema.globalpaq.mx/api/v2/public/cobertura-dhl?cp_origen=${zipfrom}&cp_destino=${zipto}`);
    cobertura = await cobertura.json();
    if (cobertura.data.message === "Cobertura Extendida") {
        let saldo = await conn.EDB.query(`SELECT enviosLocal.getSaldoPrepago(${idasociado}) AS saldo`);
        //Prod
        // let saldo = await conn.EDB.query(`SELECT enviosenviosLocal.getSaldoPrepago(${idasociado}) AS saldo`);
        let articulo = await conn.EDB.query("SELECT * FROM enviosLocal.articulo WHERE idarticulo = 1744");
        // prod
        // let articulo = await  conn.EDB.query("SELECT * FROM enviosLocal.articulo WHERE idarticulo = 1744");
        saldo = saldo[0][0];
        articulo = articulo[0][0];
        let enoughFunds = saldo.saldo > Number(articulo.precio_0);
        if (!enoughFunds) return [false, false, "No hay fondos suficientes para generar una guia con zona extendida"];
        let opRes = await conn.EDB.query(`INSERT INTO enviosLocal.saldo_prepago(idasociado,idarticulo,tipo,cantidad,monto,paqueteria) VALUES(${idasociado},${articulo.idarticulo},'CARGO',1,${articulo.precio_0},'DHL')`);
        //Prod
        //let opRes = await conn.EDB.query(`INSERT INTO enviosLocal.saldo_prepago(idasociado,idarticulo,tipo,monto,paqueteria) VALUES(${idasociado},${articulo.idarticulo},'CARGO',${articulo.precio_0},'DHL')`);
        return [true, opRes[0], null];
    }
    return [true, false, null];
}

exports.validateAssurance = async (tipoguia, declaredvalue, idasociado, zona) => {
    const params = new URLSearchParams();
    params.append("ajax", true);
    params.append("tipo", tipoguia);
    params.append("valor", declaredvalue);
    params.append("idasociado", idasociado);
    let resp = await fetch(
        "https://sistema.globalpaq.mx/utils/calculaSeguro.php",
        {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: params
        }
    );
    let seguro = await resp.json();
    if (seguro.seguro > seguro.disponible) {
        if (zona) {
            await conn.LOCALDB.query(`UPDATE enviosLocal.saldo_prepago SET monto = 0 WHERE id = ${zona}`);
            //Prod
            //await conn.EDB.query(`UPDATE enviosLocal.saldo_prepago SET monto = 0 WHERE id = ${zona}`);
            return [false, "Fondos insuficientes para asegurar y generar zona extendida"];
        }
        return [false, "Fondos insuficientes para asegurar"];
    } else {
        let r = await conn.LOCALDB.query(`INSERT INTO enviosLocal.saldo_prepago(idasociado,idarticulo,tipo,cantidad,monto,paqueteria) VALUES(${idasociado},'128','CARGO',1,${seguro.seguro},'DHL')`);
        //Prod
        //let r = await conn.EDB.query(`INSERT INTO enviosLocal.saldo_prepago(idasociado,idarticulo,tipo,monto,paqueteria) VALUES(${idasociado},'128','CARGO',${seguro.seguro},'DHL')`);
        let prepagoSeguroId = r[0];
        return [true, prepagoSeguroId, `Se desconto: $${seguro.seguro} de seguro. Saldo restante: $${seguro.monto}`];
    }
}

exports.rollbackChanges = async (coberturaid, seguroid) => {
    console.log("Rolling back changes");
    if (seguroid || coberturaid) {
        let cobChQ = `UPDATE enviosLocal.saldo_prepago SET monto = 0 WHERE id IN(${!isNaN(seguroid) ? !isNaN(coberturaid) ? coberturaid + "," + seguroid : seguroid : coberturaid})`;
        await conn.LOCALDB.query(cobChQ);
    }
}

exports.updateCargo = async (tracking,coberturaid,seguroid)=>{
    if (seguroid || coberturaid) {
        let cobChQ = `UPDATE enviosLocal.saldo_prepago SET guia = ${tracking} WHERE id IN(${!isNaN(seguroid) ? !isNaN(coberturaid) ? coberturaid + "," + seguroid : seguroid : coberturaid})`;
        await conn.LOCALDB.query(cobChQ);
    }
}

exports.getCity = async (type,data)=>{
    let f = `${type}_cp`;
    let col = `${type}_colonia`;
    let cit = `${type}_ciudad`;
    let dts = data[cit] !== 0 && data[cit] !== "" ? data[col] + "-" + data[cit] : data[col];
    let cities = await conn.EDB.query(`SELECT CONCAT(cdl.colonia,IF(cdl.ciudad = "","","-"),cdl.ciudad) AS ciudad FROM colonias_dhl cdl WHERE cdl.cp = ${data[f]}`);
    // let cities = await conn.EDB.query(`SELECT CONCAT(colonia.colonia,"-",ciudad.ciudad) AS ciudad FROM codigo INNER JOIN colonia ON codigo.idcodigo = colonia.idcodigo INNER JOIN ciudad ON codigo.idciudad = ciudad.idciudad WHERE codigo.codigo = ${data[f]}`);
    let found = false;
    if(cities[0].length){
        cities[0].forEach(element=>{
            if (element.ciudad.includes(dts)) found = true;
        })
    }
    return found ? dts : data[col];
}