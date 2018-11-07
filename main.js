'use strict';

/* Module Require */
const mkdirp = require('mkdirp'),
    request = require('request'),
    FormData = require('form-data'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    https = require ('https'),
    zlib = require('zlib'),
//    sleep = require('sleep'),
    readline = require('readline');

// the URL of the GROBID service (to be changed if necessary)
//const GROBID_URL = "http://localhost:8070/api/";

// for making console output less boring
const green = '\x1b[32m';
const red = '\x1b[31m';
const orange = '\x1b[33m';
const white = '\x1b[37m';
const blue = `\x1b[34m`;
const score = '\x1b[7m';
const bright = "\x1b[1m";
const reset = '\x1b[0m';

/**
 * Download the PDF associated to an Istex 
 */
function downloadIstexPDF(options, istexId, callback) {
    var dest = options.temp_path + "/" + istexId + '.pdf';
    var file = fs.createWriteStream(dest);
    var pdf_url = 'https://api.istex.fr/document/' + istexId + '/fulltext/pdf';
    var request = https.get(pdf_url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            file.close(callGROBID(options, istexId, callback));  
            // close() is async, call grobid after close completes.
        });
    }).on('error', function(err) { // Handle errors
        fs.unlink(dest, function(err2) { if (err2) { 
                return console.log('error removing downloaded PDF file'); 
            } 
        }); 
        // delete the file async
        if (callback) 
            callback(err.message);
    });
}

const timer = ms => new Promise(res => setTimeout(res, ms));

function callGROBID(options, istexId, callback) {
    console.log("---\nProcessing: " + istexId);
    var file = options.temp_path + "/" + istexId + ".pdf";

    // check that the file exists (conservative but necessary check)
    if (!fs.existsSync(file)) {
        console.log('temporary PDF file does not exist: ', file);
        return false;
    }

    var form = new FormData();
    form.append("input", fs.createReadStream(file));
    form.append("consolidateHeader", "0");
    form.append("consolidateCitations", "0");
    form.append("teiCoordinates", "biblStruct");
    form.append("teiCoordinates", "ref");
    form.append("teiCoordinates", "figure");
    form.append("teiCoordinates", "formula");
    var grobid_url = "http://" + options.grobid_host;
    if (options.grobid_port) 
        grobid_url += ':' + options.grobid_port
    grobid_url += '/api/'; 
    form.submit(grobid_url+options.action, function(err, res, body) {
        if (err) {
            console.log(err);
            //if (callback) 
            //    return callback(err.message);
            return false;
        }

        if (!res) {
            console.log("GROBID service appears unavailable");
            //if (callback) 
            //    return callback(err.message);
            return false;
        } else {
            res.setEncoding('utf8');
        }

        if (res.statusCode == 503) {
            // service unavailable, normally it means all the threads for GROBID on the server are currently used 
            // so we sleep a bit before retrying the process
            //sleep.sleep(options.sleep_time); 
            //return callGROBID(options, file, callback);
            timer(3000).then(_=>callGROBID(options, istexId, callback));
            //return true; 
        } else if (res.statusCode == 204) {
            // success but no content, no need to read further the response and write an empty file
            fs.unlink(file, function(err2) { if (err2) { 
                    return console.log('error removing downloaded PDF file'); 
                } 
            }); 
        } else if (res.statusCode != 200) {
            console.log(red, "Call to GROBID service for " + istexId + " failed with error " + 
                res.statusCode + ", " + res.statusMessage, reset);
            fs.unlink(file, function(err2) { if (err2) { 
                    return console.log('error removing downloaded PDF file'); 
                } 
            });
            if (callback) 
                callback(res.statusMessage); 
            //return false;
        }

        if (res.statusCode == 200) {
            var body = "";
            res.on("data", function (chunk) {
                body += chunk;
            });
            
            // first write the TEI reponse 
            var resourcePath = options.outPath+"/"+
                                istexId[0]+"/"+
                                istexId[1]+"/"+
                                istexId[2]+"/"+
                                istexId+"/";

            var teiFullTextFilePath = resourcePath + 'enrichment/istex-grobid-fulltext/';
            var teiRefBibsFilePath = resourcePath + 'enrichment/refBibs/';
            var fullTextPath = resourcePath + 'fulltext/';

            res.on("end", function () {
                mkdirp(teiFullTextFilePath, function(err, made) {
                    // I/O error
                    if (err) {
                        fs.unlink(file, function(err2) { if (err2) { 
                                return console.log('error removing downloaded PDF file'); 
                            } 
                        }); 
                        callback(err);
                    } else {
                        var writeOptions = { encoding: 'utf8' };
                        var wstream = fs.createWriteStream(teiFullTextFilePath + istexId + ".tei.xml.gz", writeOptions);
                        wstream.on('finish', function (err) {
                            if (err) { 
                                console.log(err);
                            } 
                            console.log(white, "TEI response written under: " + teiFullTextFilePath, reset); 
                            fs.unlink(file, function(err2) { if (err2) { 
                                    return console.log('error removing downloaded PDF file'); 
                                } 
                            }); 
                            // above, delete the file async
                            callback();
                        });

                        var compressStream = zlib.createGzip();
                        compressStream.pipe(wstream);

                        // we need to complete the header by adding some ISTEX header policy
                        body = body.replace("</titleStmt>", 
                            "\t<respStmt>\n\t\t\t\t\t<resp>Produced by GROBID</resp>\n\t\t\t\t\t<name resp=\"ISTEX-API\">ISTEX-API (INIST-CNRS)</name>\n\t\t\t\t</respStmt>\n\t\t\t</titleStmt>");

                        compressStream.write(body);
                        compressStream.end();
                    }
                });
            });
        } else if (res.statusCode == 204) {
            // empty content, nothing to write
            callback();
        }
    });
}

/**
 * Process a PDF file by calling the entity-fishing service and enrich with the resulting
 * JSON
 * @param {object} options object containing all the information necessary to manage the paths:
 *  - {object} inPath input directory where to find the PDF files
 *  - {object} outPath output directory where to write the results
 *  - {string} profile the profile indicating which filter to use with the entity-fishing service, e.g. "species"
 * @return {undefined} Return undefined
 */
function processGROBID(options) {
    var q = async.queue(function (istexId, callback) {
        //callGROBID(options, file, callback);
        downloadIstexPDF(options, istexId, callback);
    }, options.concurrency);

    q.drain = function() {
        console.log(red, "\nall tasks completed!", reset);
        end();
    }

    const rl = readline.createInterface({
        input: fs.createReadStream(options.inPath),
        crlfDelay: Infinity
    });
         
    rl.on('line', (line) => {
        //console.log(`ISTEX ID from file: ${line}`);

        // check if the file has already been processed 
        var istexId = line;
        var resourcePath = options.outPath+"/"+
                                istexId[0]+"/"+
                                istexId[1]+"/"+
                                istexId[2]+"/"+
                                istexId+"/";
        var teiFullTextFilePath = resourcePath + 'enrichment/istex-grobid-fulltext/' + istexId + ".tei.xml.gz"
        if (!fs.existsSync(teiFullTextFilePath) || options.force) {
            q.push(line, function (err) {  
                if (err) { 
                    return console.log('error in adding tasks to queue'); 
                }  
                console.log(orange, 'task is completed', reset);  
            });
        }
    });
}

/**
 * Init the main object with paths passed with the command line
 */
function init() {
    var options = new Object();

    // start with the config file
    const config = require('./config.json');
    options.grobid_host = config.grobid_host;
    options.grobid_port = config.grobid_port;
    options.sleep_time = config.sleep_time;
    options.temp_path = config.temp_path;
    options.force = false;

    // default service is full text processing
    options.action = "processFulltextDocument";
    options.concurrency = 10; // number of concurrent call to GROBID, default is 10
    var attribute; // name of the passed parameter
    // get the path to the PDF to be processed
    for (var i = 2, len = process.argv.length; i < len; i++) {
        if (process.argv[i-1] == "-in") {
            options.inPath = process.argv[i];
        } else if (process.argv[i-1] == "-out") {
            options.outPath = process.argv[i];
        } else if (process.argv[i-1] == "-n") {
            options.concurrency = parseInt(process.argv[i], 10);
        } else if (process.argv[i] == "-force") {
            options.force = true;
        } else if (!process.argv[i].startsWith("-")) {
            options.action = process.argv[i];
        } 
    }

    console.log("\nGROBID service: ", red, options.action+"\n", reset);

    if (!options.inPath) {
        console.log("Input path is not defines");
        return;
    }

    // check the input path
    fs.lstat(options.inPath, (err, stats) => {
        if (err)
            console.log(err);
        if (stats.isDirectory())
            console.log("Input path must be a file, not a directory");
        if (!stats.isFile()) 
            console.log("Input path must be a valid file");
    });

    // check the output path
    if (options.outPath) {
        fs.lstat(options.outPath, (err, stats) => {
            if (err)
                console.log(err);
            if (stats.isFile()) 
                console.log("Output path must be a directory, not a file");
            if (!stats.isDirectory())
                console.log("Output path is not a valid directory");
        });
    }
    return options;
}

function end() {
    var this_is_the_end = new Date() - start
    console.info('Execution time: %dms', this_is_the_end)
}

var start;

function main() {
    var options = init();
    start = new Date()
    processGROBID(options);
}

main();
