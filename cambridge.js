import fs from 'fs';
import path from 'path';
import jsdom from 'jsdom';
import Sanscript from './sanscript.mjs';
import EwtsConverter from './EwtsConverter.mjs';

const input_dir = 'cambridge/';
const output_file = 'cambridge.csv';

const loadFile = f => {
  const file = fs.readFileSync(f,{encoding: 'utf-8'});
  const dom = new jsdom.JSDOM('');
  const parser = new dom.window.DOMParser();
  return parser.parseFromString(file,'text/xml');
};

const detectScript = str => {
    const ranges = new Map([
        ['tamil', /[\u0b80-\u0bff]/u],
        ['devanagari', /[\u0900-\u097f]/u],
        ['bengali', /[\u0980-\u09ff]/u],
        ['telugu', /[\u0c00-\u0c7f]/u],
        ['malayalam',/[\u0d00-\u0d7f]/u],
        ['sarada',/[𑆃-𑆲]/u],
        ['grantha',/[𑌅-𑌹]/u],
        ['newa',/[𑐀-𑐴]/u],
        ['tibetan',/[ༀ-࿚]/u]
    ]);

    for(const [name,range] of ranges)
        if(range.test(str)) return name;

    return 'iast';
};

const transliterate = str => {
  const script = detectScript(str);

  if(script === 'iast') return str;

  let transliterated = str.toLowerCase();

  if(script === 'tibetan') {
    const ewts = new EwtsConverter({fix_spacing: true, pass_through: true,fix_sloppy: false});
    transliterated = ewts.to_ewts(transliterated
     .replaceAll('ༀ','om̐'))
     .replaceAll(/[rl]-[iI]/g,(m) => {
          switch (m) {
              case 'r-i':
                  return 'ṛ';
              case 'r-I':
                  return 'ṝ';
              case 'l-i': 
                  return 'l̥';
              default:
                  return 'l̥̄';
          }
       }).replaceAll(/([gṭḍbd])\+h/g,'$1h');
  }
  else
    transliterated = Sanscript.t(transliterated,script,'iast');

  return transliterated;
};

const clean_tei_text = tag => {

  // remove spaces before @break="no" tags
  for(const breaktag of tag.querySelectorAll('pb[break="no"], cb[break="no"], lb[break="no"]')) {
    const prev = breaktag.parentNode.firstChild === breaktag ?
        breaktag.parentNode.previousSibling :
        breaktag.previousSibling;
    if(prev && prev.nodeType === 3)
      prev.data = prev.data.trimEnd();
  }

  const text = tag.textContent.replaceAll(/[\s\t\r\n]+/g,' ') // reduce spaces to one
                              .replaceAll('"','\"') // escape quotation marks
                              .trim();

  return transliterate(text);

};

const process_cambridge_manuscripts = () => {
  let files;
  try {
      files = fs.readdirSync(input_dir);
  } catch (err) {
      console.log(err);
  }
  const flist = files.reduce((acc,cur) => {
    if(/^[^_].+\.xml$/.test(cur))
      acc.push(input_dir+cur);
    return acc;
  },[]);
  
  const extracts = ['rubric','incipit','explicit','finalRubric','colophon'];
  const rows = [['ID No.','Title','Author',...extracts]];

  for(const f of flist) {
    const doc = loadFile(f);

    const ms_items = doc.querySelectorAll('msItem');
    if(ms_items.length === 0) continue;

    const shelfmark = doc.querySelector('msIdentifier idno');
    const id_no = shelfmark ? shelfmark.textContent : 'Unknown ID';

    for(const item of ms_items) {
      const row_data = [id_no];

      const title = item.querySelector('title');
      row_data.push(title ? clean_tei_text(title) : 'Unknown Title');

      const author = item.querySelector('author');
      row_data.push(author ? clean_tei_text(author) : 'Unknown Author');

      for(const type of extracts) {
        const tags = [...item.querySelectorAll(type)];
        const aggregate = tags.map(t => clean_tei_text(t)).join(';');
        row_data.push(aggregate);
      }

      rows.push(row_data);
    }
  }

  const flat = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');

  fs.writeFileSync(output_file,flat);
  console.log(`wrote to ${output_file}.`);
};

process_cambridge_manuscripts();
