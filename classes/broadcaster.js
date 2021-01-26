var instance;

class Broadcaster {

    constructor(sockets) {
        this.sockets = sockets;
    }

    update(data){
        this.sockets.emit("call-request-sync",data);
    }

    static init(sockets){
        instance = new Broadcaster(sockets);
        return instance;
    }

    static getInstance(){
        console.log(instance)
        return instance;
    }
}

module.exports = {
    sockets : null
};