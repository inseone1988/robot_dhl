const conn = require("../database/sequelize");
const XLSX = require("xlsx");
const {default: ShortUniqueId} = require('short-unique-id');
const uid = new ShortUniqueId();
const fs = require("fs");
const queries = require("../classes/queries");

const csvHeaders = [
    "Name (Ship FROM) (Required)",
    "Company (Ship FROM) (Required)",
    "Address 1 (Ship FROM) (Required)",
    "ZIP/Postal Code (Ship FROM)",
    "City (Ship FROM) (Required)",
    "Country Code (Ship FROM) (Required)",
    "Email Address (Ship FROM) (Required)",
    "Phone Country Code (Ship From) (Required)",
    "Phone Number (Ship FROM) (Required)",
    "Name (Ship TO) (Required)",
    "Company (Ship TO) (Required)",
    "Address 1 (Ship TO) (Required)",
    "ZIP/Postal Code (Ship TO)",
    "City (Ship TO) (Required)",
    "Country Code (Ship TO) (Required)",
    "Phone Country Code (Ship To) (Required)",
    "Phone Number (Ship TO) (Required)",
    "Email Address (Ship TO)",
    "Account Number (Shipper) (Required)",
    "Total Weight (Required)",
    "Product Code (3 Letter) (Required)",
    "Summary of Contents (Required)",
    "Shipment Type (Required) P = Package | D = Document",
    "Total Shipment Pieces (Required)",
    "Piece Length",
    "Piece Width",
    "Piece Height",
    "Shipment Date (YYYYMMDD)",
    "Moneda_Valor",
    "Valor_Declarado",
    "Address 2 (Ship FROM)",
    "Address 3 (Ship FROM)",
    "Address 2 (Ship TO)",
    "Address 3 (Ship TO)",
    "Valor del artículo",
    "Valor del artículo Moneda"
];
const moment = require("moment");
const path = require("path");
const Generator = require("../classes/generator");


async function hasDisponibles(data) {
    return await queries.getDisponibles(data.client_id, data.client_tipoguia, data.client_valor_peso);
}

function trimInput(data) {
    let i = Object.keys(data);
    for (let j = 0; j < i.length; j++) {
        if (typeof data[i[j]] === "string") data[i[j]] = data[i[j]].trim();
    }
}

async function validate(data) {
    if (data.shipper_telefono.length !== 10) return "El telefono del remitente debe ser a 10 digitos";
    if (data.recipient_telefono.length !== 10) return "El telefono del destinatario debe ser a 10 digitos";
    if (data.package_contenido.trim() === "") return "EL contenido del paquete es requerido";
    if (!await hasDisponibles(data)) return "No cuenta con este tipo de guia disponibles";
    if (Number(data.client_valor_peso) < Number(data.package_peso) && !data.permissions.excedente) return "El peso del paquete sobrepasa el peso amparado de la guia";
    let checkCobertura = await queries.validateCobertura(data.client_id, data.shipper_cp, data.recipient_cp);
    if (!data.permissions.seguro && Number(data.declaredValue) > 0) return "No cuenta con permiso de seguro";
    data.cobertura = checkCobertura;
    if (!checkCobertura[0]) return checkCobertura[2];
    if (Number(data.declaredValue) > 0) {
        let checkSeguro = await queries.validateAssurance(data.client_tipoguia, data.declaredValue, data.client_id, checkCobertura[1]);
        if (!checkSeguro[0]) return checkSeguro[1];
        data.seguro = checkSeguro[0];
    }
    data.rollBackChanges = () => {
        queries.rollbackChanges(data.cobertura[1], data.seguro ? data.seguro[1] : false);
    }
    return null;
}

function sanitize(input) {
    if (isNaN(input) && typeof input !== "object" && typeof input !== "function") {
        // console.log(input);
        input = input.toLowerCase();
        input = input.replace(/[^\w\s]/gi, "");
        return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    }
    return isNaN(input) ? input : Number(input);
}


function formatInput(data) {
    let indexes = Object.keys(data);
    data.uid = uid();
    indexes.forEach((value, index) => {
        //console.log(value);
        if (value !== "shipper_email"
            && value !== "recipient_email"
            && value !== "shipper_cp"
            && value !== "recipient_cp"
            && value !== "shipper_ciudad"
            && value !== "shipper_colonia"
            && value !== "recipient_ciudad"
            && value !== "recipient_colonia") data[value] = sanitize(data[value]);
        if (value === "package_contenido") data[value] = `${data.uid} ` + data[value];
    })
}

async function sheetData(data) {
    let d = [];
    d.push(csvHeaders);
    d.push([
        data.shipper_nombre !== 0 ? data.shipper_nombre : null,
        data.shipper_compania !== 0 ? data.shipper_compania : null,
        data.shipper_calle !== 0 ? data.shipper_calle : null,
        data.shipper_cp,
        await queries.getCity("shipper", data),
        // data.shipper_ciudad !== 0 && data.shipper_ciudad !== "" ? data.shipper_colonia + "-" + data.shipper_ciudad : data.shipper_colonia,
        "MX",
        data.shipper_email,
        "52",
        data.shipper_telefono,
        data.recipient_nombre !== 0 ? data.recipient_nombre : null,
        data.recipient_compania !== 0 ? data.recipient_compania : null,
        data.recipient_calle !== 0 ? data.recipient_calle : null,
        data.recipient_cp,
        await queries.getCity("recipient", data),
        // data.recipient_ciudad !== 0 && data.recipient_ciudad !== "" ? data.recipient_colonia + "-" + data.recipient_ciudad : data.recipient_colonia,
        "MX",
        "52",
        data.recipient_telefono,
        data.recipient_email,
        "14249662",
        data.package_peso,
        data.client_tipoguia === 31 ? "DES" : "DOM",
        data.package_contenido,
        "P",
        "1",
        data.package_largo,
        data.package_ancho,
        data.package_alto,
        moment().format("YMMDD"),
        data.declaredValue !== 0 ? "MXN" : null,
        data.declaredValue !== 0 ? data.declaredValue : null,
        data.shipper_calle2 !== 0 ? data.shipper_calle2 : null,
        data.shipper_calle3 !== 0 ? data.shipper_calle2 : null,
        data.recipient_calle2 !== 0 ? data.recipient_calle2 : null,
        data.recipient_calle3 !== 0 ? data.recipient_calle3 : null,
        data.declaredValue !== 0 ? data.declaredValue : null,
        "MXN"
    ]);
    return d;
}

async function createFile(data) {
    let filename = Date.now();
    let pathName = path.resolve(__dirname, `../requestfiles/${filename}.csv`);
    const wb = XLSX.utils.book_new();
    let worksheet = XLSX.utils.aoa_to_sheet(await sheetData(data));
    XLSX.utils.book_append_sheet(wb, worksheet, `${filename}`);
    XLSX.writeFile(wb, pathName);
    return pathName;
}

async function onGenerateRequest(data, socket) {
    data.permissions = await queries.userPermissions(data.client_id);
    let v = await validate(data);
    try {
        if (!v) {
            formatInput(data);
            let filename = await createFile(data);
            console.log(filename);
            await (async () => {
                let generator = new Generator(data, filename);
                generator.emitProgress = (opts) => {
                    console.log(opts);
                    socket.emit("enviarMensaje", {
                        message: opts.message,
                        porc: opts.per,
                        evento: opts.evento,
                        url: opts.url,
                        tracking: opts.tracking
                    });
                };
                Generator.p.add(generator).then(r => {
                    console.log(r);
                }).catch(e => {
                    console.log(e);
                    socket.emit("enviarMensaje", {
                        message: e,
                        porc: 15,
                        evento: "salir"
                    });
                });
            })();
        } else {
            if (data.rollBackChanges) await data.rollBackChanges();
            throw v;
        }
    } catch (e) {
        socket.emit("enviarMensaje", {
            message: e,
            porc: 15,
            evento: "salir"
        });
    }

}

function getGuide(req, res, next) {
    let trackingid = req.params.trackingid;
    const filenames = fs.readdirSync(path.resolve(__dirname, "../guides"));
    for (const index in filenames) {
        if (filenames[index].includes(trackingid)) {
            res.sendFile(path.resolve(__dirname, `../guides/${filenames[index]}`));
            break;
        }
    }
}

module.exports = {
    hasDisponibles,
    validate,
    sanitize,
    formatInput,
    sheetData,
    createFile,
    getGuide,
    trimInput,
    onGenerateRequest
};