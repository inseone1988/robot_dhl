const io = require('socket.io');

module.exports = {
    initSocket(server,options){
        return new io(server,options);
    }
};