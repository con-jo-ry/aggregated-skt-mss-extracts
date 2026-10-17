import fs from 'fs';
import path from 'path';
import jsdom from 'jsdom';
import Sanscript from './sanscript.mjs';
import EwtsConverter from './EwtsConverter.mjs';

const input_dir = 'tst/';
const output_file = 'tst.csv';

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

const entities = new Map([
    ['#pcs','௳'],
    ['#pcl','௳'],
    ['#ra_r_kal','_ā'],
    ['#kompu','_e'],
    ['#nna=m','nnam'],
    ['#ya=m','yam'],
    ['#tēti','௳'],
    ['#mācam','௴'],
    ['#varuṣam','௵'],
    ['#patru','௶'],
    ['#eduppu','௷'],
    ['#mēṟpaṭi','௸'],
    ['#rupai','௹'],
    ['#niluvai','௺'],
    ['#munthiri','𑿀'],
    ['#araikkaani','𑿁'],
    ['#kaani','𑿂'],
    ['#kaal_viisam','𑿃'],
    ['#arai_maa','𑿄'],
    ['#arai_viisam','𑿅'],
    ['#mukkaani','𑿆'],
    ['#mukkaal_viisam','𑿇'],
    ['#maa','𑿈'],
    ['#viisam','𑿉'],
    ['#viisam_alt','𑿊'],
    ['#irumaa','𑿋'],
    ['#araikkaal','𑿌'],
    ['#mumaa','𑿍'],
    ['#muuviisam','𑿎'],
    ['#naangu_maa','𑿏'],
    ['#kaal','𑿐'],
    ['#arai','𑿑'],
    ['#arai_alt','𑿒'],
    ['#mukkaal','𑿓'],
    ['#kiizh','𑿔'],
    ['#nel','𑿕'],
    ['#cevitu','𑿖'],
    ['#aazhaakku','𑿗'],
    ['#uzhakku','𑿘'],
    ['#muuvuzhakku','𑿙'],
    ['#kuruni','𑿚'],
    ['#pathakku','𑿛'],
    ['#mukkuruni','𑿜'],
    ['#kaacu','𑿝'],
    ['#panam','𑿞'],
    ['#pon','𑿟'],
    ['#varaakan','𑿠'],
    ['#paaram','𑿡'],
    ['#kuzhi','𑿢'],
    ['#veli','𑿣'],
    ['#nansey','𑿤'],
    ['#punsey','𑿥'],
    ['#nilam','𑿦'],
    ['#uppalam','𑿧'],
    ['#varavu','𑿨'],
    ['#enn','𑿩'],
    ['#naalathu','𑿪'],
    ['#silvaanam','𑿫'],
    ['#poga','𑿬'],
    ['#āka','𑿭'],
    ['#vasam','𑿮'],
    ['#muthal','𑿯'],
    ['#muthaliya','𑿰'],
    ['#vakaiyaraa','𑿱'],
    ['#end_of_text','𑿿'],
    ['#pattu','௰'],
    ['#nūṟu','௱'],
    ['#āyiram','௲'],
    ['#newa-siddhi','𑑊'],
    ['#newa-gap-filler','𑑎'],
    ['#newa-old-gap-filler','𑑎'],
    ['#newa-comma','𑑍'],
    ['#newa-abbreviation','𑑏'],
    ['#sarada-ekam','𑇚'],
    ['#sarada-siddhi','𑇛'],
    ['#sarada-separator','𑇈'],
    ['#sarada-section-mark-1','𑇞'],
    ['#sarada-section-mark-2','𑇟'],
    ['#headmark','𑬀'],
    ['#headmark_with_headstroke','𑬁;'],
    ['#bhale','𑬂'],
    ['#bhale_hook','𑬃'],
    ['#bhale_five','𑬆'],
    ['#bhale_nine','𑬇'],
    ['#bhale_nine_reversed','𑬈'],
    ['#mindu','𑬉'],
    ['#jain_omkara','ꣽ'],
    ['#puspika','꣸'],
    ['#sirorekha','ꣻ'],
    ['#broken_danda','¦'],
    ['#danda_with_slash','।'],
    ['#latin_cross','✝'],
]);

const clean_tei_text = tag => {
  // convert <g ref="XX"/> tags to their proper entities
  for(const g of tag.querySelectorAll('g')) {
    const ref = g.getAttribute('ref');
    if(!ref) continue;
    const entity = entities.get(ref);
    if(entity)
      g.textContent = entity;
  }

  // remove spaces before @break="no" tags
  for(const breaktag of tag.querySelectorAll('pb[break="no"], cb[break="no"], lb[break="no"]')) {
    const prev = breaktag.parentNode.firstChild === breaktag ?
        breaktag.parentNode.previousSibling :
        breaktag.previousSibling;
    if(prev && prev.nodeType === 3)
      prev.data = prev.data.trimEnd();
  }

  const text = tag.textContent.replaceAll(/[\s\t\r\n]+/g,' ') // reduce spaces to one
                              .replaceAll(/(?<=\S)[_·]/g,'') // remove virāma markers
                              .replaceAll(/-(?=\S)/g,'') // remove sandhi/compound markers
                              .replaceAll('"','\"') // escape quotation marks
                              .toLowerCase() // DHARMA uses uppercase initial vowels
                              .trim();

  return transliterate(text);

};

const process_tst_manuscripts = () => {
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
  const segs = new Map([
    ['rubric','rubric'],
    ['incipit','incipit'],
    ['explicit','explicit'],
    ['finalRubric','completion-statement'],
    ['colophon','colophon']
  ]);

  const rows = [['ID No.','Title','Author',...extracts,'extract']];

  for(const f of flist) {
    const doc = loadFile(f);

    const ms_items = doc.querySelectorAll('msItem');
    if(ms_items.length === 0) continue;

    const shelfmark = doc.querySelector('msIdentifier')?.querySelector('idno[type="shelfmark"], idno');
    const id_no = shelfmark ? shelfmark.textContent : 'Unknown ID';

    for(const item of ms_items) {
      const row_data = [id_no];

      const title = item.querySelector('title');
      row_data.push(title ? clean_tei_text(title) : 'Unknown Title');

      const author = item.querySelector('author');
      row_data.push(author ? clean_tei_text(author) : 'Unknown Author');

      const item_id = item.getAttribute('xml:id');
      const texts = item_id ? [...doc.querySelectorAll(`text[corresp="#${item_id}"]`)] : [doc];
  
      // in case <msItem> has @xml:id but the <text> element has no @corresp attribute
      if(texts.length === 0) texts.push(doc);

      for(const type of extracts) {
        const tags = [...item.querySelectorAll(type)];
        for(const text of texts)
          tags.push(...text.querySelectorAll(`seg[function="${segs.get(type)}"]`));
        const aggregate = tags.map(t => clean_tei_text(t)).join(';');
        row_data.push(aggregate);
      }
      
      const excerpt = texts[0] === doc ? '' : texts.map(t => clean_tei_text(t)).join(';');
      row_data.push(excerpt);

      rows.push(row_data);
    }
  }

  const flat = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');

  fs.writeFileSync(output_file,flat);
  console.log(`wrote to ${output_file}.`);
};

process_tst_manuscripts();
