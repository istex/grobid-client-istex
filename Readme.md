# ISTEX node.js client for GROBID REST services

This node.js module can be used to process in an efficient concurrent manner a set of PDF identified by their ISTEX ID by the [GROBID](https://github.com/kermitt2/grobid) service, producing ISTEX enrichments on the file system. This client is adapted to process a very large amount of PDF (e.g. several millions) _outside_ the ISTEX ingestion pipeline - so there is no dependency with the ISTEX platform libraries. 

## Build and run

You need first to install and start the *grobid* service, latest stable version, see the [documentation](http://grobid.readthedocs.io/). By default the server will run on the address `http://localhost:8070`. You can change the server address by modifying the config file `config.json`.

Install the present module:

> npm install

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

## Output

Results will be written in the output directory (`-out`), using the ISTEX ID for creating a sub-hierarchy following the ISTEX resource policy. 

If we use the full text service, the resulting full text TEI (including the bibiographical references) and the bibliographical references will be written as enrichments, in addition the TEI fulltext dedicated to ES indexing will be updated with the new bibliographical references produced by GROBID. 

```
.                       // path indicated by the parameter -out
├── F                        
│   └── 6
│       └── 9
│           └── F69BC0D8FA56B7610E60D1BA94AF9266BD9E7B5E
│               └── enrichment
│                   └── istex-grobid-fulltext
│                       └── F69BC0D8FA56B7610E60D1BA94AF9266BD9E7B5E.tei.xml // fulltext produced by GROBID
│                   └── refbibs
│                       └── F69BC0D8FA56B7610E60D1BA94AF9266BD9E7B5E.references.tei.xml // ref bib produced by GROBID
│               └── fulltext
│                   └── F69BC0D8FA56B7610E60D1BA94AF9266BD9E7B5E.tei.xml // update of fulltext TEI with new ref. bib. produced by GROBID
│
```

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
