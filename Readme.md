# ISTEX node.js client for GROBID REST services

This node.js module can be used to process in an efficient concurrent manner a set of PDF identified by their ISTEX ID by the [GROBID](https://github.com/kermitt2/grobid) service, producing ISTEX enrichments on the file system. This client is adapted to process a very large amount of PDF (e.g. several millions) _outside_ the ISTEX ingestion pipeline - so there is no dependency with the ISTEX platform libraries. 

To save space, all the XML resources are produced as gzip files. 

## Build

You need first to install and start the *grobid* service, latest stable version, see the [documentation](http://grobid.readthedocs.io/). By default the server will run on the address `http://localhost:8070`. You can change the server address by modifying the config file `config.json`.

Install the present module:

> npm install


## Run the client

Usage (GROBID server must be up and running): 

> node main -in *PATH_TO_THE_LIST_OF_ISTEX_ID_TO_PROCESS* -out *WHERE_TO_PUT_THE_RESULTS*

Example:

> node main -in ~/tmp/selectedIstexIds.txt -out ~/tmp/out

The input provides the list of ISTEX ID to be processed, it is a text file with one ISTEX ID per line. 

Other parameters: 

* `n`: the number of concurrent call to GROBID, default is `10`

* the service to be called, default being `processFulltextDocument` (full processing of the document body), other possibilities are `processHeaderDocument` (only extracting and structuring the header) and `processReferences` (only extracting and structuring the bibliographical references). 

Example: 

> node main -in ~/tmp/selectedIstexIds.txt -out ~/tmp/out -n 20 processHeaderDocument

This command will extract the header of the PDF files corresponding to the ISTEX ID given in `~/tmp/selectedIstexIds.txt` with 20 concurrent calls to the GROBID server and write the results under `~/tmp/out`.

By default, if the resulting file is already present for an ISTEX ID, the file will **not** be re-processed. For forcing te processing of all the ISTEX PDF, even if a result is already present in the result directory, use the option `-force`. 

## Generating full resources for ISTEX 

To produce the ISTEX full text TEI resources for the existing ISTEX objects already loaded on the ISTEX plaform, the process is as follow:

- generate the list of ISTEX ID that are supported by GROBID full text processing, see section `Generate a list of Istex ID to be processed by grobid full text service` below

- start the GROBID service, and if needed update the config file `config.json` for the actual host and port of the service

- run the client with processFulltextDocument as GROBID service:

> node main -in ~/tmp/selectedIstexIds.txt -out ~/tmp/out -n 30 processFulltextDocument

This will produce the full text TEI in the directory structure appropriate to ISTEX, calling GROBID with the parameters corresponding to what is expected by ISTEX formats.

If the collection of documents is very large (several millions), better to increase usable memory for node.js:

> node --max-old-space-size=8192 --optimize-for-size --max-executable-size=8192  --max_old_space_size=8192 --optimize_for_size --max_executable_size=8192 main.js -in ~/tmp/selectedIstexIds.txt -out ~/tmp/out/ -n 30 processFulltextDocument 

- complete the output for ISTEX:

> node complete-output -in ~/tmp/selectedIstexIds.txt -out ~/tmp/out

This will update the TEI header of the full text enrichment, generate the bibrefs enrichment file and update the fulltext file with the newly generated bibliographical references. Be sure to use the same output (`~/tmp/out`) for having all the resources under the same hierarchy.

The ISTEX full text resources (all enrichment files and updated full text file) are available under `~/tmp/out`.

- match the extracted bibliographical references against CrossRef metadata using biblio-glutton and inject the DOI, ISTEX ID, PMID, PMC ID and ISTEX ark into the successfully matched bibliographical references: 

> node inject-doi -in ~/tmp/selectedIstexIds.txt -out ~/tmp/out

This will update the TEI full text enrichment files and the bibref enrichment files. Be sure to use the same output (`~/tmp/out`) for having all the resources under the same hierarchy.


## Output

Results will be written in the output directory (`-out`), using the ISTEX ID for creating a sub-hierarchy following the ISTEX resource policy. This is done in two times. The main method (`main.js`) called with the full text service will write first the fulltext produced by GROBID in the expected hierarchy. The complementary script `complete-output.js` will additionally write the bibliographical reference file, and download/update the fulltext TEI for the object. The second step is executed by the command:

> node complete-output -in *PATH_TO_THE_LIST_OF_ISTEX_ID_TO_PROCESS* -out *WHERE_TO_PUT_THE_RESULTS*

For instance, if the results have been initally produced based on the selected list of ISTEX ID `~/tmp/selectedIstexIds.txt` and outputed under `~/tmp/out` as above, the complementary result files are written by calling:

> node complete-output -in ~/tmp/selectedIstexIds.txt -out ~/tmp/out

If we use the full text service, the resulting full text TEI (including the bibiographical references) and the bibliographical references will be written as enrichments, in addition the TEI fulltext dedicated to ES indexing will be updated with the new bibliographical references produced by GROBID. 

```
. // path indicated by the parameter -out
├── F                        
│   └── 6
│       └── 9
│           └── F69BC0D8FA56B7610E60D1BA94AF9266BD9E7B5E
│               └── enrichment
│                   └── istex-grobid-fulltext
│                       └── F69BC0D8FA56B7610E60D1BA94AF9266BD9E7B5E.tei.xml // fulltext produced by GROBID (main.js)
│                   └── refbibs
│                       └── F69BC0D8FA56B7610E60D1BA94AF9266BD9E7B5E.refbibs.tei.xml // ref bib produced by GROBID (complete-output.js)
│               └── fulltext
│                   └── F69BC0D8FA56B7610E60D1BA94AF9266BD9E7B5E.tei.xml // update of fulltext TEI with new ref. bib. produced by GROBID (complete-output.js)
│
```

## Detailed description of output

The full text TEI file produce by GROBID is managed as an enrichment for an ISTEX object, and will be saved under `enrichment/istex-grobid-fulltext`. It should not be confused with the `fulltext` TEI file used by ISTEX as aggregation of all informations to be indexed. 

The GROBID bibliographical reference file will be produced even if a native publisher's XML file already provides them. In this case, both will be available for users, which can be helpful if some native bibiographical references are not entirely structured. 

GROBID produces a unique TEI file containing the complete structured body including all the parsed bibliographical references. When this file is received by the present module, the following actions will be applied:

- add in the TEI header of the GROBID TEI the provenance information following ISTEX policy, the GROBID fulltext file is ready and can be saved under the subdirectory `enrichment/istex-grobid-fulltext` as illustrated above. 

- copy of the full sub-XML part corresponding to the bilbliographical information (this is done by a substring operation to save time, full XML parsing and validation of the full text being time consuming) as a new XML document.

- for the new bibliographical reference TEI file only, we add the attributes `@change` and `@resp` for each bibliographical reference, following ISTEX data enrichment policy; the GROBID bibliographical file is read and can be saved under the subdirectory `refbibs` as illustrated above. The old refbibs files will be replace by this new one when updating the ISTEX file system.

- download of the current `fulltext` TEI file from the ISTEX platform.

- update the bibliographical reference section of this `fulltext` TEI file, if, and only if, the bibliographical references are not alreay provided via the publisher native XML. If GROBID bibilographical references are added, update the TEI header accordingly. 

- save the possibly updated `fulltext` TEI file under `fulltext` sub-directory as illustrated above. 

To be checked: nothing else to update? `jsonLine` resource description (`jsonLine.refBibsFound = true;`)? Or is it just for the ingestion module?


## Generate a list of Istex ID to be processed by grobid full text service

A script will use the ISTEX API for selecting a list of all ISTEX IDs to be processed by GROBID full text. The ISTEX objects are selected based on document type and publisher, so that we ensure that the corresponding PDF are supported by GROBID (PDF must be actual articles and not book review, conference report, editorial, etc.). 

Usage:

> node main istexid-selection > /tmp/selectedIstexIds.txt

The resulting list of selected ISTEX IDs gives one ISTEX ID per line, e.g.:

>  wc -l /tmp/selectedIstexIds.txt
> 11276201 /tmp/selectedIstexIds.txt


## Benchmarking

...

## Requirements

- async
- request
- form-data
- mkdirp
- sleep

## License

Distributed under [Apache 2.0 license](http://www.apache.org/licenses/LICENSE-2.0). 

Main author and contact: Patrice Lopez (<patrice.lopez@science-miner.com>)
