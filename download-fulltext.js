'use strict';

/**
 * Small utility to download ISTEX fulltext from a list of identifier,
 * and store them following the ISTEX file resource policy
 */

/* Module Require */
const mkdirp = require('mkdirp'),
    request = require('request'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    https = require ('https'),
    readline = require('readline'),
    zlib = require('zlib');


// for making console output less boring
const green = '\x1b[32m';
const red = '\x1b[31m';
const orange = '\x1b[33m';
const white = '\x1b[37m';
const blue = `\x1b[34m`;
const score = '\x1b[7m';
const bright = "\x1b[1m";
const yellow = "\x1b[33m"
const reset = '\x1b[0m';


/**
 * Download the full text associated to an Istex ID
 */
function downloadIstexFullText(options, istexId, callback) {
    // download the current full text file via the API:
    // url is https://api.istex.fr/document/*ISTEX_ID*/fulltext/tei

    // first check if the file is not already there
    var resourcePath = options.outPath+"/"+
                                istexId[0]+"/"+
                                istexId[1]+"/"+
                                istexId[2]+"/"+
                                istexId+"/";

    var fullTextPath = resourcePath + 'fulltext/';
    var teiFullTextFilePath = resourcePath + 'fulltext/' + istexId + '.tei.xml.gz';
    if (fs.existsSync(teiFullTextFilePath)) {
        console.log(orange, "file does already exist: " + teiFullTextFilePath, reset);
        if (callback) 
            callback();
        return true;
    }

    var dest = options.temp_path + "/" + istexId + '.tei.xml';
    var file = fs.createWriteStream(dest);
    var tei_url = 'https://api.istex.fr/document/' + istexId + '/fulltext/tei?sid=grobid';
    console.log('downloading', tei_url, '...')
    
    var request = https.get(tei_url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            file.close(saveFullTextFile(options, istexId, callback));  
            // close() is async, call method after close completes
        });
        file.on('error', function(err) { 
            console.log('io error for writing downloaded fulltext file', err);
            if (callback) 
                callback();
            return false;
        });
    })

    request.on('error', function(err) {  
        console.log('request to fulltext file failed', err);
        if (callback) 
            callback();
        return false;
    });
}

function saveFullTextFile(options, istexId, callback) {

    // get the dowloaded full text
    var tempTeiFullTextFilePath = options.temp_path + "/" + istexId + '.tei.xml';
    if (!fs.existsSync(tempTeiFullTextFilePath)) {
        console.log(orange, "file does not exist: " + tempTeiFullTextFilePath, reset);
        if (callback) 
            callback();
        return false;
    }
    console.log('file has been downloaded:', tempTeiFullTextFilePath)

    // check if the file is empty
    var contents = fs.readFileSync(tempTeiFullTextFilePath).toString();
    if (contents.trim().length == 0) {
        console.log(orange, "file exist but is empty: " + tempTeiFullTextFilePath, reset);
        console.log('deleting tmp tei...')
        // clean the tmp tei fulltext
        fs.unlink(tempTeiFullTextFilePath, function(err2) { 
            if (err2) { 
                console.log('error removing downloaded temporary tei file'); 
            } 
        }); 
        if (callback) 
            callback();
        return false;
    }

    var rstream = fs.createReadStream(tempTeiFullTextFilePath);
    var tei = ""

    rstream.on('error', function(error) {
        console.log("cannot read file: " + tempTeiFullTextFilePath);
        if (callback) 
            callback();
        return false;
    })

    rstream.on('data', function(chunk) {
        tei += chunk;
    });

    rstream.on('close', function (err) {

        if (err) { 
            console.log('failed to complete tmp tei file reading', err);
            console.log('deleting tmp tei...')
            // clean the tmp tei fulltext
            fs.unlink(tempTeiFullTextFilePath, function(err2) { 
                if (err2) { 
                    console.log('error removing downloaded temporary tei file'); 
                } 
            }); 
            if (callback)
                callback();
            return false;
        } 

        var resourcePath = options.outPath+"/"+
                                istexId[0]+"/"+
                                istexId[1]+"/"+
                                istexId[2]+"/"+
                                istexId+"/";

        var fullTextPath = resourcePath + 'fulltext/';

        // write the fulltext
        mkdirp(fullTextPath, function(err, made) {

            // I/O error
            if (err) {
                // clean the tmp tei fulltext
                fs.unlink(tempTeiFullTextFilePath, function(err2) { 
                    if (err2) { 
                        console.log('error removing downloaded temporary tei file'); 
                    } 
                }); 
                if (callback)
                    callback();
                return false;
            }

            var writeOptions = { encoding: 'utf8' };
            var wstream = fs.createWriteStream(fullTextPath + istexId + ".tei.xml.gz", writeOptions);
            wstream.on('finish', function (err) {
                if (err) { 
                    console.log(err);
                } else
                    console.log(white, "fulltext written under: " + fullTextPath, reset); 

                console.log('deleting tmp tei...')
                // clean the tmp tei fulltext
                fs.unlink(tempTeiFullTextFilePath, function(err2) { 
                    if (err2) { 
                        console.log('error removing downloaded temporary tei file'); 
                    } 
                });
                if (callback) {
                    callback();
                } 
            });

            var compressStream = zlib.createGzip();
            compressStream.pipe(wstream);

            compressStream.write(tei);
            compressStream.end();
        });
    });
}


function processDownload(options) {
    var q = async.queue(function (istexId, callback) {
        downloadIstexFullText(options, istexId, callback);
    }, options.concurrency);

    q.drain = function() {
        console.log(green, "\nall tasks completed!", reset);
        end();
    }

    const rl = readline.createInterface({
        input: fs.createReadStream(options.inPath),
        crlfDelay: Infinity
    });

    rl.on('line', (line) => {
        q.push(line, function (err) {  
            if (err) { 
                return console.log('error in adding tasks to queue'); 
            }  
            console.log(blue, 'task is completed', reset);  
        });
    });
}

/**
 * Init the main object with paths passed with the command line
 */
function init() {
    var options = new Object();

    // start with the config file
    const config = require('./config.json');
    options.temp_path = config.temp_path;

    options.concurrency = 10; // number of concurrent call to the ISTEX API
    var attribute; // name of the passed parameter
    // get the path to the PDF to be processed
    for (var i = 2, len = process.argv.length; i < len; i++) {
        if (process.argv[i-1] == "-in") {
            options.inPath = process.argv[i];
        } else if (process.argv[i-1] == "-out") {
            options.outPath = process.argv[i];
        } else if (process.argv[i-1] == "-n") {
            options.concurrency = parseInt(process.argv[i], 10);
        }
    }

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
    processDownload(options);
}

main();