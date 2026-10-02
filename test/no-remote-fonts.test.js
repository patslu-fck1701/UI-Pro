'use strict';

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

test('WerkZ Time prototype pages do not load remote Google Fonts at runtime',()=>{
  for(const name of ['werkz-zeit.html','werkz-zeit-tag.html','werkz-zeit-einsatz.html']){
    const content=fs.readFileSync(path.resolve(__dirname,'../packages/time-tracking/pages',name),'utf8');
    assert.equal(content.includes('fonts.googleapis.com'),false,name+' must not load Google Fonts');
    assert.equal(content.includes('fonts.gstatic.com'),false,name+' must not preconnect to Google Fonts');
  }
});
