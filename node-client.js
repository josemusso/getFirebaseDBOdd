const fetch = require('node-fetch');
var fs = require('fs');
var R = require('ramda');
var firebase = require('firebase');

const config = {
    // aca va la config
};

firebase.initializeApp();

// FOTOS ENROLAMIENTO: arma diccionario con info de enrol
function getEnrollData() {

    var dictEnrol = {};
    var query = firebase.app().database().ref('persons_images');
    return query.once("value")
        .then(function(snapshot) {
            snapshot.forEach(function(childSnapshot) {              // ID PERSONA
                var listaFotos = [];
                var personId = childSnapshot.key;                   // "ada"
                childSnapshot.forEach(function(childSnapshot) {     // ID FOTO
                    var childData = childSnapshot.val();
                    listaFotos.push(childData["url"]);
                });
                dictEnrol[personId] = listaFotos;
            });
        })
        .then(_ => dictEnrol)
        .catch((error) => {
            console.log("Error getting data:", error);
        });
}

// FOTOS RECONOCIMIENTO: arma diccionario con info de reco
function getRecoData() {

    var dictReco = {};
    var query2 = firebase.app().database().ref('visitors/precon-aeropuerto/');
    return query2.once("value")
        .then(function(snapshot) {
            snapshot.forEach(function(childSnapshot) {              // CU ES UNA FOTO
                var childData = childSnapshot.val();
                var personId = childSnapshot.child('recognitions/0/personId').val();
                if (childData['status'] === 'VALIDATED') {      // TIENE QUE ESTAR VALIDADO
                    if (!(personId in dictReco)){                 // CASO NOMBRE NO EXISTE EN DICT
                        var listaFotos = [];
                        listaFotos.push(childData['url']);
                        dictReco[personId] = listaFotos;
                    }
                    else {
                        dictReco[personId].push(childData['url'])
                    }
                }
            });
        })
        .then(_ => dictReco)
        .catch((error) => {
            console.log("Error getting data:", error);
        });
}

// funcion  devuelve promesa con arreglo con valores getEnrollData() y getRecoData()
const getData = () => Promise.all([getEnrollData(), getRecoData()]);


// funcion descargar imagen
// OJO: hay que pasarle una lista con los argumentos
const downloadImg = ([nroFoto, personId, url, dataType]) => {
    var path = './'+dataType+'/'+personId+'/';
    var filename = personId+nroFoto+'.jpg';
    return fetch(url)
        .then(res => {
            const dest = fs.createWriteStream(path+filename);
            res.body.pipe(dest);
        });
};

const downloadImgs = ([personId, urls, dataType]) => {
    let ps = [];
    // console.log(typeof urls[0]);
    for (i = 0; i < urls.length; i++) {
        var url = urls[i];
        // console.log(url);
        if (!(url === undefined)) {
            ps.push(downloadImg([i, personId, url, dataType]))
        }
    }
    return Promise.all(ps)
};

// funcion para crear directorio de todas las fotos
const createDir = ([personId, dataType]) =>  {
    var path = './'+dataType+'/';
    if (!fs.existsSync(path)){
        fs.mkdirSync(path);
    }
    var path2 = './'+dataType+'/'+personId+'/';
    if (!fs.existsSync(path2)){
        fs.mkdirSync(path2);
    }
};

const createPersonDir = (person, dataType) => {
    return new Promise((resolve, reject) => {
        // DESCARGAR TODAS FOTOS ENROLL
        createDir([person.personId, dataType]);
        if (dataType === 'enroll'){
            resolve([person.personId, person.urlEnroll, dataType]);
        }
        else {
            resolve([person.personId, person.url, dataType]);
        }
    })
};

// crear lista a partir del diccionario con objeto persona {personId, url}
const getBatch = (dict) => Object.keys(dict).map((personId) => {return {personId, url: dict[personId]}});

// funcion para ejecutar una a una las promesas que descargan las fotos de cada usuario
const sequencePromises = list => list.reduce((chain, current) => chain.then(current), Promise.resolve())

// programa principal
const program = () => {
    console.log('armando diccionarios...');
    return getData().then(([enroll, reco])=>{

        var batches = getBatch(reco);
        var batchesFull = batches.map((person) => { person.urlEnroll = enroll[person.personId]; return person});
        return batchesFull
    })
        .then( (persons) => {
            return sequencePromises(persons.map(person => _ => Promise.all([
                createPersonDir(person, 'enroll').then(downloadImgs),
                createPersonDir(person, 'reco').then(downloadImgs)
            ])))
            }
        )
        .then(
            console.log
        );
};

// ejecutar programa principal
program();

// exportaciones para debugging
module.exports.getRecoData = getRecoData;
module.exports.getEnrollData = getEnrollData;
module.exports.someF = async () => 1;
module.exports.otherF = () => Promise.resolve(1);
module.exports.getData = getData;
module.exports.downloadImg = downloadImg;
module.exports.createDir = createDir;
module.exports.createPersonDir = createPersonDir;
module.exports.downloadImgs = downloadImgs;
module.exports.program = program;
module.exports.sequencePromises = sequencePromises;

