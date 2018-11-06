## Test cases before / after GROBID module

We have three possible cases when applying GROBID on an existing ISTEX object

### Case the ISTEX object has already GROBID bibliographical references

Input: [https://api.istex.fr/document/E179A0939FF2CFD393128BD846AD040AC69458C7/fulltext/pdf](https://api.istex.fr/document/E179A0939FF2CFD393128BD846AD040AC69458C7/fulltext/pdf)

We save the enrichment files and update the fulltext TEI with new GROBID bibliographical references:
- we save the enrichment GROBID fulltext (the output of GROBID with an added reference to ISTEX in the TEI header): 
[document/E179A0939FF2CFD393128BD846AD040AC69458C7/enrichment/istex-grobid-fulltext](enrichment-E179A0939FF2CFD393128BD846AD040AC69458C7.tei.xml)
- create an enrichment file for bibliographical references
[document/E179A0939FF2CFD393128BD846AD040AC69458C7/enrichment/refbibs](E179A0939FF2CFD393128BD846AD040AC69458C7.refBibs.tei.xml)
- update the existing fulltext TEI file with GROBID bibliographical references
[document/E179A0939FF2CFD393128BD846AD040AC69458C7/fulltext/tei](E179A0939FF2CFD393128BD846AD040AC69458C7.tei.xml)

### Case the ISTEX object has already publisher's bibliographical references

Input: [https://api.istex.fr/document/A869706C64774A5DBF0B9DDDA4F1F9478CE3F565/fulltext/pdf](https://api.istex.fr/document/A869706C64774A5DBF0B9DDDA4F1F9478CE3F565/fulltext/pdf)

We save the enrichment files but don't update the fulltext TEI with the new GROBID bibliographical references:
- we save the enrichment GROBID fulltext (the output of GROBID with an added reference to ISTEX in the TEI header):
[document/A869706C64774A5DBF0B9DDDA4F1F9478CE3F565/enrichment/istex-grobid-fulltext](enrichment-A869706C64774A5DBF0B9DDDA4F1F9478CE3F565.tei.xml) 
- create an enrichment file for bibliographical references
[document/A869706C64774A5DBF0B9DDDA4F1F9478CE3F565/enrichment/refbibs](A869706C64774A5DBF0B9DDDA4F1F9478CE3F565.refBibs.tei.xml)
- do not touch the existing fulltext TEI file with publisher's bibliographical references
[document/A869706C64774A5DBF0B9DDDA4F1F9478CE3F565/fultext/tei](A869706C64774A5DBF0B9DDDA4F1F9478CE3F565.tei.xml)

### Case the ISTEX object has no existing bibliographical references

Input: 

We save the enrichment files and update the fulltext TEI with new GROBID bibliographical references:
- we save the enrichment GROBID fulltext (the output of GROBID with an added reference to ISTEX in the TEI header): 
- create an enrichment file for bibliographical references
- update the existing fulltext TEI file by adding the new GROBID bibliographical references
