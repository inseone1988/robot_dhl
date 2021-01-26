const Request = require("../models/request");
const {envios:DB} = require("../config/sequelize");
const {Op} = require("sequelize");
const broadcaster = require("../classes/broadcaster");
exports.handler = (socket) => {
    console.log("Client connected");
    socket.on("join-room", room => {
        socket.join(room);
        console.log("Client joined room " + room);
    })
    socket.on("get-pending-requests", data => {
        Request.findAll({
            where: {
                status: {
                    [Op.notLike]: "FINALIZADO"
                }
            }
        }).then(async results => {
            if (results){
                for (let i = 0; i < results.length; i++) {
                    // console.log(result);
                    let info = await DB.query(`SELECT a.correo , a.nombre , ai.telefono , u.nombre AS asesor FROM envios.Asociados a LEFT JOIN enviosLocal.asociado a2 ON a.idasociado = a2.idasociado LEFT JOIN enviosLocal.usuario u ON a2.idusuarioatc = u.idusuario LEFT JOIN envios.AsociadoInfo ai ON a.idasociado = ai.idasociado WHERE a.idasociado = ${results[i].asociadoid}`);
                    results[i] = {...info[0][0],...results[i].dataValues}
                }
                broadcaster.sockets.to('asesors').emit("pending-request-response", results);
            }
        })
    })
    socket.on('callrequest', async data => {

        Request.create({
            asociadoid: data.idasociado,
            asesorid: data.idasesor,
            phone : data.phone
        }).then(async request => {
            if (request){
                let info = await DB.query(`SELECT a.correo , a.nombre , ai.telefono , u.nombre AS asesor FROM envios.Asociados a LEFT JOIN enviosLocal.asociado a2 ON a.idasociado = a2.idasociado LEFT JOIN enviosLocal.usuario u ON a2.idusuarioatc = u.idusuario LEFT JOIN envios.AsociadoInfo ai ON a.idasociado = ai.idasociado WHERE a.idasociado = ${request.asociadoid}`);
                broadcaster.sockets.to('asesors').emit("callrequest", {...request.dataValues,...info[0][0]});
            }

        })
    })
    socket.on('task-accept', data => {
        console.log(data);
        Request.findOne({
            where: {
                id: data["task-id"]
            }
        }).then(async request => {
            if (request){
                request.accepted = true;
                request.atendio = data["asesor"];
                request.status = "EN CURSO";
                request.response_at = Date.now();
                await request.save();
                // await request.reload();
                let info = await DB.query(`SELECT a.correo , a.nombre , ai.telefono , u.nombre AS asesor FROM envios.Asociados a LEFT JOIN enviosLocal.asociado a2 ON a.idasociado = a2.idasociado LEFT JOIN enviosLocal.usuario u ON a2.idusuarioatc = u.idusuario LEFT JOIN envios.AsociadoInfo ai ON a.idasociado = ai.idasociado WHERE a.idasociado = ${request.asociadoid}`);
                broadcaster.sockets.to('asesors').emit("task-accept-response", {success: true, payload: {...request.dataValues,...info[0][0]}});
            }

        })
    })
    socket.on("finalize-task", data => {
        console.log(data);
        Request.findOne({
            where: {
                id: data["task-id"]
            }
        }).then(async request => {
            request.status = "FINALIZADO";
            request.finished_at = Date.now();
            await request.save();
            broadcaster.sockets.to("asesors").emit("task-finalized", {
                success: true, payload: {
                    "task-id":request.id
                }
            })
        })
    })
    return socket;
}