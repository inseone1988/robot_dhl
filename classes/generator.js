const puppeteer = require("puppeteer");
const expect = require("expect-puppeteer");
const logger = require("logger");
const path = require("path");
const fs = require("fs");
const EDB = require("../database/sequelize").EDB;
const {QueryTypes} = require("sequelize");
const queries = require("../classes/queries");
const {Accounts} = require("../models/account");

const LOGIN_URL = 'https://mydhl.express.dhl/mx/es/auth/login.html';
const ENVIOS_URL = 'https://mydhl.express.dhl/mx/es/shipment-import.html#/';
const SHIPMENT_UPLOAD_URL = "https://mydhl.express.dhl/mx/es/shipment-import.html#/";
const MANAGE_SHIPMENTS_URL = "https://mydhl.express.dhl/mx/es/manage-shipments.html";
const SCREENSHOT_DIR = '../screenshots/';
const USERNAME = 'tarifas-c-42@globalpaq.com';
const PASSWORD = 'GhIs-C42gL.jm';

class Generator {

    static p = {
        numOfWorkers: 0,
        maxNumOfWorkers: 15,
        taskIndex : 0,
        pool: [],
        //watcherId : undefined,
        async add(generator) {
            this.pool.push(generator);
            return new Promise(done => {
                const handleResult = index => result => {
                    if (result && result.stack && result.message){
                        this.pool[index].onError(result);
                    }
                    this.pool[index] = result;
                    Generator.p.numOfWorkers--;
                    getNextTask();
                    return this.pool[index];
                };
                const getNextTask = () => {
                    if (Generator.p.numOfWorkers < Generator.p.maxNumOfWorkers && Generator.p.taskIndex < Generator.p.pool.length) {
                        Generator.p.pool[Generator.p.taskIndex].process().then(handleResult(Generator.p.taskIndex)).catch(handleResult(Generator.p.taskIndex));
                        Generator.p.taskIndex++;
                        Generator.p.numOfWorkers++;
                        getNextTask();
                    } else if (Generator.p.numOfWorkers === 0 && Generator.p.taskIndex === Generator.p.pool.length) {
                        done(Generator.p.pool);
                    }
                };
                getNextTask();
            });
        }
    }

    constructor(data, file) {
        this.data = data;
        this.log = logger.createLogger(path.resolve(__dirname, file).replace("csv", "log"));
        this.filepath = file;
    }

    emitProgress(opts) {

    }

    async init() {
        this.account = await Accounts.getAccount();
        this.log.log('Initializing puppeteer');
        console.log("Lanzando pupeteer");
        this.browser = await puppeteer.launch({
            headless: true
        });
        console.log("Creando pestaña de inicio de sesion");
        this.log.log('Creating browser page tab');
        this.page = await this.browser.newPage();
        console.log("Navengando a la pagina de inicio de sesion");
        this.log.log(`Navigating to ${LOGIN_URL}`);
        await this.page.goto(LOGIN_URL, {
            waitUntil: 'networkidle2'
        })
        console.log("Cerrando la pestaña por default");
        this.log.log("Closing default browser page");
        this.browser.pages().then(pages => {
            pages[0].close();
        });
        await this.page.setDefaultNavigationTimeout(10000);
        await this.page.setDefaultTimeout(10000);
    }

    async login() {
        this.log.log(`Trying to login with ${this.account.username} credentials`);
        await expect(this.page).toFill('input[type="email"][name="username"]', this.account.username, {
            delay: 25
        });
        console.log("Llenado contraseña");
        this.log.log("Filling password");
        await expect(this.page).toFill('input[type="password"][name="password"]', this.account.password, {
            delay: 25
        });
        this.log.log("Submiting form");
        await this.page.waitForSelector('button[aqa-id="loginButton"]');
        await this.page.click('button[aqa-id="loginButton"]');
        await this.page.waitForNavigation();

        this.log.log('Login Exitoso');
        return true;
    }

    async generateByFileNavigate() {
        console.log("Navegando a la pagina de subida");
        this.log.log("Navigating to shipment upload");
        await this.page.goto(SHIPMENT_UPLOAD_URL, {
            waitUntil: 'networkidle2'
        });
        this.log.log('Loading shipment file');
        console.log("Subiendo archivo");
        // await this.page.waitForNavigation({waitUntil : 'networkidle0'});
        // await this.page.click('input[aqa-id="importType_existing"]');
        await expect(this.page).toClick('input[aqa-id="importType_existing"]');
        console.log("existingSchemesSelect");
        await this.page.click('select[aqa-id="existingSchemesSelect"]');
        await this.page.waitForTimeout(500);
        await expect(this.page).toSelect('select[aqa-id="existingSchemesSelect"]', "globalbot");
        await this.page.waitForSelector("select[aqa-id='accountsSelect']");
        await expect(this.page).toSelect("select[aqa-id='accountsSelect']", "C");
        // await this.page.select('[name="existingSchemesSelect"]',"273821");
        await this.page.waitForTimeout(500);
        await expect(this.page).toClick('span', {text: "encabezados de columna"});
        // await expect(this.page).toClick('span',{text : "Seleccione archivo"});
        let inputUploadHandler = await this.page.$('input[aqa-id="uploadButton"]');
        await inputUploadHandler.uploadFile(this.filepath);
        await this.page.waitForSelector("button[aqa-id='processUpload']");
        await expect(this.page).toClick("button",{text : "Subir"});
        // await this.page.click('button[aqa-id="processUpload"]');
        await this.page.waitForTimeout(500);
        await expect(this.page).toClick("button[aqa-id='processButton']");
        // await expect(this.page).toClick("button[aqa-id='processButton']",{text: "Proceso de envíos"});
        // await this.page.waitForSelector("button[aqa-id='processButton']");
        await expect(this.page).toClick('button[aqa-id="processButton"]');
        // await this.page.click('button[aqa-id="processButton"]');
        await this.page.waitForNavigation();
        await this.page.waitForSelector("div[aqa-id='successProcessingResult']");
        this.log.log('Document successfully loaded');
    }

    async getGeneratedTrackingGuide() {
        console.log("Intentando recuperar la guia generada");
        this.log.log('Redirecting to manage shipments page');
        await this.page.goto(MANAGE_SHIPMENTS_URL);
        this.log.log('Trying to recover generated tracking file');
        await this.page.waitForSelector("table.data-table");
        let r = await this.page.evaluate((data) => {
            let result = [];
            let nNodes = document.querySelectorAll("tr.data-table__item");
            let node;
            for (let i = 0; i < nNodes.length; i++) {
                if (nNodes[i].innerText.includes(data.uid)) {
                    node = nNodes[i];
                    break;
                }
            }
            if (node) {
                let jnode = $(node);
                let tracking = jnode.find("a.ng-binding[aqa-id='airWayBill']").text();
                let identifier = jnode.attr("data-item-key");
                result.push(tracking);
                result.push(`https://mydhl.express.dhl/api/shipment/${identifier}/zipped-document?docs=LABEL&docs=ARCHIVE&copies=1&copies=1`)
                $(node).find("a.ng-binding[aqa-id='printLabelsButton']").attr("id", data.uid);
            }
            return result;
        }, this.data)
        if (r.length) {
            this.data.generated = r;
            this.log.log(`File located getting info`);
            this.log.log(`Generated tracking number ${r[0]}`);
            // await this.page.click("a#v7H8iL");
            // await this.page.waitForSelector(".modal")
            await this.page._client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: path.resolve(__dirname, '../guides_tmp')
            });
            try {
                this.log.log(`Downloading file`);
                await this.page.goto(r[1], {waitUntil: "networkidle2"});
            } catch (e) {

            }
            await this.page.waitForTimeout(2000);
            this.log.log(`Moving to final storage`);
            this.processFile(r[0]);
        }
        //Force to print labels
        await expect(this.page).toClick("a",{text : "Imprimir etiquetas"});
        //await this.page.waitForNavigation();
        await this.page.waitForTimeout(2000);
        await expect(this.page).toClick("button[aqa-id='shipment_print_selected_documents_button']");
        await this.page.waitForTimeout(2000);
    }

    processFile(rElement) {
        const filenames = fs.readdirSync(path.resolve(__dirname, '../guides_tmp'));
        let file = "";
        for (const index in filenames) {
            if (filenames[index].includes(rElement)) {
                file = path.resolve(__dirname, `../guides_tmp/${filenames[index]}`);
                break;
            }
        }
        console.log(file);
        if (file !== "") {
            let nPath = `${path.resolve(__dirname, `../guides/${this.data.uid}_${rElement}.pdf`)}`;
            fs.renameSync(file, nPath);
            this.data.filepath = nPath;
            console.log(nPath);
        }
    }

    async finish() {
        let dirq1 = `INSERT INTO Direcciones_dhl(idasociado,nombre,compania,direccion,direccion1,ciudad,estado,cp,telefono,referencia1,referencia2,email,idtipoguia,tipo) VALUES (${this.data.client_id},'${this.data.shipper_nombre}','${this.data.shipper_compania}','${this.data.shipper_calle}','${this.data.shipper_colonia}','${this.data.shipper_ciudad}','${this.data.shipper_estado}','${this.data.shipper_cp}','${this.data.shipper_telefono}', '${this.data.shipper_calle2}', '${this.data.shipper_calle3}', '${this.data.shipper_email}','${this.data.client_tipoguia}','1') ON DUPLICATE KEY UPDATE compania = '${this.data.shipper_compania}', direccion = '${this.data.shipper_calle}', direccion1 = '${this.data.shipper_colonia}', ciudad = '${this.data.shipper_ciudad}', estado = '${this.data.shipper_estado}', cp = '${this.data.shipper_cp}', telefono = '${this.data.shipper_telefono}', referencia1 = '${this.data.shipper_calle2}', referencia2 = '${this.data.shipper_calle3}', email = '${this.data.shipper_email}', idtipoguia = '${this.data.client_tipoguia}', tipo = '1'`;
        // let dirq1 = `INSERT INTO Direcciones_dhl(idasociado,nombre,compania,direccion,direccion1,ciudad,estado,cp,telefono,referencia1,referencia2,email,idtipoguia) VALUES (${this.data.client_id},'${this.data.shipper_nombre}','${this.data.shipper_compania}','${this.data.shipper_calle}','${this.data.shipper_colonia}','${this.data.shipper_ciudad}','${this.data.shipper_estado}','${this.data.shipper_cp}','${this.data.shipper_telefono}', '${this.data.shipper_calle2}', '${this.data.shipper_calle3}', '${this.data.shipper_email}','${this.data.client_tipoguia}') ON DUPLICATE KEY UPDATE compania = '${this.data.shipper_compania}', direccion = '${this.data.shipper_calle}', direccion1 = '${this.data.shipper_calle2}', ciudad = '${this.data.shipper_ciudad}', estado = '${this.data.shipper_estado}', cp = '${this.data.shipper_cp}', telefono = '${this.data.shipper_telefono}', referencia1 = '${this.data.shipper_calle2}', referencia2 = '${this.data.shipper_calle3}', email = '${this.data.shipper_email}', idtipoguia = '${this.data.client_tipoguia}'`;
        let dirq2 = `INSERT INTO Direcciones_dhl(idasociado,nombre,compania,direccion,direccion1,ciudad,estado,cp,telefono,referencia1,referencia2,email,idtipoguia) VALUES (${this.data.client_id},'${this.data.recipient_nombre}','${this.data.recipient_compania}','${this.data.recipient_calle}','${this.data.recipient_colonia}','${this.data.recipient_ciudad}','${this.data.recipient_estado}','${this.data.recipient_cp}','${this.data.recipient_telefono}', '${this.data.recipient_calle2}', '${this.data.recipient_calle3}', '${this.data.recipient_email}','${this.data.client_tipoguia}') ON DUPLICATE KEY UPDATE compania = '${this.data.recipient_compania}', direccion = '${this.data.recipient_calle}', direccion1 = '${this.data.recipient_colonia}', ciudad = '${this.data.recipient_ciudad}', estado = '${this.data.recipient_estado}', cp = '${this.data.recipient_cp}', telefono = '${this.data.recipient_telefono}', referencia1 = '${this.data.recipient_calle2}', referencia2 = '${this.data.recipient_calle3}', email = '${this.data.recipient_email}', idtipoguia = '${this.data.client_tipoguia}'`;
        EDB.query(dirq1, {type: QueryTypes.INSERT}).then(r => {
            console.log(r);
            this.data.remitentid = r[0];
            this.emitProgress({message: "Guardando datos", per: 10, evento: "adicionales"});
            return EDB.query(dirq2);
        }).then(r => {
            console.log(r);
            this.data.destid = r[0];
            this.emitProgress({message: "Guardando datos. Espere...", perc: 5, evento: "adicionales"});
            //console.log(this.data);
            let histq = `INSERT INTO Historialdhl (idasociado, id_remitente, id_destinatario, idtipoguia, tracking, rutapdf, pesoguia, largo, alto, ancho, valordeclarado, pesodeclarado, idhijo) VALUES (${this.data.client_id}, ${this.data.remitentid}, ${this.data.destid}, ${this.data.client_tipoguia}, '${this.data.generated[0]}', '${this.data.filepath}', ${this.data.client_valor_peso}, ${this.data.package_largo}, ${this.data.package_alto}, ${this.data.package_ancho}, ${this.data.declaredValue}, ${this.data.package_peso}, '${this.data.client_hijo}')`;
            return EDB.query(histq, {type: QueryTypes.INSERT});
        }).then(async (r) => {
            await queries.updateCargo(this.data.generated[0],this.data.cobertura[1], this.data.seguro ? this.data.seguro[1] : false);
            this.emitProgress({
                message: "Guia generada correctamente",
                url: this.data.filepath,
                tracking: this.data.generated[0],
                evento: "finalizar",
                per: 5
            })
        });
    }

    async process() {
        await this.init();
        this.emitProgress({message: "Inicializando ...", per: 20, evento: "envio"});
        await this.login();
        this.emitProgress({message: "Generando guia ...", per: 20, evento: "envio"});
        await this.generateByFileNavigate();
        this.emitProgress({message: "Verificando integridad ...", per: 20, evento: "envio"});
        await this.getGeneratedTrackingGuide();
        this.emitProgress({message: "Finalizando proceso, porfavor espere ...", per: 20, evento: "envio"});
        await this.finish();
        await Accounts.subSession(this.account.id);
        return this.browser.close();
        //     .then(() => {
        //     console.log("Inicializando")
        //
        //     return this.login();
        // }).then(() => {
        //     this.emitProgress({message: "Generando guia ...", per: 20, evento: "envio"});
        //     return this.generateByFileNavigate();
        // }).then(() => {
        //     this.emitProgress({message: "Verificando integridad ...", per: 20, evento: "envio"});
        //     return this.getGeneratedTrackingGuide();
        // }).then(() => {
        //     console.log("Finalizando");
        //     this.emitProgress({message: "Finalizando proceso, porfavor espere ...", per: 20, evento: "envio"});
        //     return this.finish();
        // }).then(() => {
        //     // Generator.p.numOfWorkers -= 1;
        //     // Generator.p.stopWatcher();
        //     return this.browser.close();
        // }).catch(e => {
        //     this.emitProgress({message: "Ha ocurrido un error", per: 0, evento: "salir"});
        //     console.log("An error has ocurred");
        //     console.log(e);
        //     // Generator.p.numOfWorkers -= 1;
        //     // Generator.p.stopWatcher();
        //     this.onError(e);
        // })
    }

    async onError(e) {
        let ctx = this;
        if (this.data.rollBackChanges) await this.data.rollBackChanges();
        this.log.error(e);
        let spath = path.resolve(__dirname, SCREENSHOT_DIR + `${this.data.uid}_${Date.now()}.png`);
        this.page.screenshot({path: spath})
            .then(async () => {
                await Accounts.subSession(ctx.account.id);
                await this.browser.close();
            });
        this.log.log('Screenshot : ' + spath);
        this.emitProgress({message:`Ha ocurrido un error <span style="font-style: italic;color: gainsboro">${e.message}</span>`,porc:15,evento:"salir"});
    }
}

module.exports = Generator;