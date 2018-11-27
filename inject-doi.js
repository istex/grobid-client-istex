'use strict';

/* Module Require */
const request = require('request'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    http = require ('http'),
    readline = require('readline'),
    striptags = require('striptags'),
    zlib = require('zlib'),
    xpath = require('xpath'),
	dom = require('xmldom').DOMParser;
//    parseXml = require('@rgrove/parse-xml'),
//    jsonpath = require('jsonpath');

// for making console output less boring
const green = '\x1b[32m';
const red = '\x1b[31m';
const orange = '\x1b[33m';
const white = '\x1b[37m';
const blue = `\x1b[34m`;
const score = '\x1b[7m';
const bright = "\x1b[1m";
const reset = '\x1b[0m'; 

function matchDOI(options, istexId, callback) {
	// read the full text TEI produced by GROBID - if any

	var resourcePath = options.outPath+"/"+
                                istexId[0]+"/"+
                                istexId[1]+"/"+
                                istexId[2]+"/"+
                                istexId+"/";

    var teiFullTextFilePath = resourcePath + 'enrichment/istex-grobid-fulltext/' + istexId + ".tei.xml.gz";

    if (!fs.existsSync(teiFullTextFilePath)) {
    	console.log("file does not exist: " + teiFullTextFilePath)
    	if (callback)
 		   	callback();
	} else {
	    var rstream = fs.createReadStream(teiFullTextFilePath).pipe(zlib.createGunzip());
	    var body = ""
	    rstream.on('data', function(chunk) {
	    	body += chunk;
	    });
	    rstream.on('finish', function (err) {
		    if (err) { 
		    	console.log('error reading grobid tei file', err)
		        if (callback)
		        	callback();
		        return false;
		    } 

		    // finding first the bibliographical section, which is the only place where we will inject 
		    // DOIl/ark
		    var ind1 = body.indexOf("<listBibl>");
		    var ind2 = body.indexOf("</listBibl>");
		    if ( (ind1 != -1) && (ind2 != -1)) {
		        var refbibsSegment = body.substring(ind1, ind2+11);

				// finding the <biblStruct> is much faster with string matching than using an xml parser/sax
				ind1 = 0;
				ind2 = 0;
				// first match is special, because it starts at offset 0
				var start = true;

				while(start || ((ind1 != -1) && (ind2 != -1))) {
					var base1 = ind1;
					var base2 = ind2;
					if (start) {
						start = false;
				    } else {
				    	base1 += 1;
				    	base2 += 1;
				    }
				    ind1 = refbibsSegment.indexOf("<biblStruct", base1);
				    ind2 = refbibsSegment.indexOf("</biblStruct>", base2);
			    	if ( (ind1 != -1) && (ind2 != -1) ) {
			    		// here is the XML segment corresponding to an extracted citation
			    		var citationSegment = refbibsSegment.substring(ind1, ind2+13);

			    		// if DOI is already there, we simply use it to get the ark


			    		// otherwise we use the metadata and pseudo-raw citation string 
			    		// for getting the identifiers
			    		citationSegment = citationSegment.replace(/\/title>/g, '/title>. ');
			    		citationSegment = citationSegment.replace(/\/forename>/g, '/forename> ');
			    		citationSegment = citationSegment.replace(/\/surname>/g, '/surname> ');
			    		citationSegment = citationSegment.replace(/\/persName>/g, '/persName>, ');

			    		citationSegment = citationSegment.replace(/unit="volume">/g, 'unit="volume">, vol. ');
			    		citationSegment = citationSegment.replace(/unit="issue">/g, 'unit="issue">');
			    		citationSegment = citationSegment.replace(/unit="page">/g, 'unit="page">, p. ');
			    		//console.log('tei segment: ' + citationSegment);

			    		// we strip the xml tags to get a pseudo raw citation
			    		var raw = striptags(citationSegment);
			    		// xml entities
			    		raw = raw.replace(/&amp;/g, "&")
			    		raw = raw.replace(/&quot;/g, "\"")
			    		raw = raw.replace(/&lt;/g, "<")
			    		raw = raw.replace(/&gt;/g, ">")
						raw = raw.replace(/&apos;/g, ">")
			    		
			    		raw = raw.replace(/\n/g, " ");
			    		raw = raw.replace(/\s\s+/g, ' ');
			    		raw = raw.replace(/\s, /g, ', ');

			    		console.log('raw: ' + raw);

			    		console.log(citationSegment);
			    		const doc = new dom().parseFromString(citationSegment);
			    		//console.log(doc);
    					const select = xpath.useNamespaces({});

    					// try to get the title and first author last name
    					var title = select('//title[@level="a"]/text()', doc)[0];
    					if (!title)
	    					title = select('//title[@level="m"]/text()', doc)[0];
    					console.log(title);

    					var firstAuthor = select('//surname[0]', doc);

    					// try to get journal, volume, first page
    					var jtitle = select('//title[@level="j"]', doc);
    					var volume = select('//biblScope[@unit="volume"]', doc);
    					var firstPage = select('//biblScope[@unit="page"][@from]', doc);
    					console.log(jtitle);
    					console.log(volume);
    					console.log(firstPage);

						var service_host = options.glutton_host ; 
						if (options.glutton_port) {
							service_host += options.glutton_port;
						}
						var endpoints = [
							{ host: service_host, path: "service/lookup?biblio="+encodeURIComponent(raw) },
							{ host: service_host, path: "service/lookup?atitle="+encodeURIComponent(title)+
								"&firstAuthor="+encodeURIComponent(firstAuthor) },
							{ host: service_host, path: "service/lookup?jtitle="+encodeURIComponent(jtitle)+
								"&volume="+encodeURIComponent(volume) + "&firstPage="+encodeURIComponent(firstPage) }
						];

			    		// parallel calls
			    		async.parallel(endpoints, http.get, function(results) {
    						for (var response in results) {
    							if (response.status == 200) {

    							}
    						}
						});
			    	}
			    }
			}
		    callback();
		});
	}

}

/*function matchRawCitationString(raw) {
	var service_url = config.glutton_host ; 
	if (config.glutton_port) {
		service_url += config.glutton_port;
	}
	service_url += "/lookup?";
    var request = http.get(service_url, function(response) {
        console.log(response)
    }).on('error', function(err) { // Handle errors
        // delete the file async
        if (callback) 
            callback(err.message);
    });
}

function matchTitleAuthor(tite, firstAuthor) {

}

function matchJournalVolumePage(journal, volume, firstPage) {

}*/

function injectDOI(options) {
	var q = async.queue(function (istexId, callback) {
	  	matchDOI(options, istexId, callback);
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
        q.push(line, function (err) {  
            if (err) { 
                return console.log('error in adding tasks to queue'); 
            }  
            console.log(orange, 'task is completed', reset);  
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
    options.glutton_host = config.glutton_host;
    options.glutton_port = config.glutton_port;

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
    injectDOI(options);
}

main();