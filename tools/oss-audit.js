'use strict';

const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const lockPath=path.join(root,'package-lock.json');
const review=/^(GPL|LGPL|AGPL|MPL|SSPL)|source.available|proprietary|commercial/i;
const allowed=new Set(['MIT','ISC','BSD-2-Clause','BSD-3-Clause','Apache-2.0','0BSD','Unlicense','CC0-1.0','OFL-1.1']);
const dependencies={...pkg.dependencies,...pkg.optionalDependencies,...pkg.devDependencies};
if(Object.keys(dependencies).length&&!fs.existsSync(lockPath))throw new Error('Dependency lockfile required for SBOM');
const lock=fs.existsSync(lockPath)?JSON.parse(fs.readFileSync(lockPath,'utf8')):null;
const packages=[];
for(const [location,item] of Object.entries(lock?.packages||{})){
  if(!location)continue;
  const name=item.name||location.replace(/^node_modules\//,'').split('/node_modules/').at(-1);
  const licence=item.license||null;
  if(!licence)throw new Error('Missing licence metadata: '+name);
  if(review.test(licence)||!allowed.has(licence))throw new Error('Dependency requires licence review: '+name+' '+licence);
  packages.push({SPDXID:'SPDXRef-'+name.replace(/[^A-Za-z0-9.-]/g,'-')+'-'+item.version,
    name,versionInfo:item.version,licenseConcluded:licence,licenseDeclared:licence,downloadLocation:item.resolved||'NOASSERTION',
    filesAnalyzed:false,checksums:item.integrity?[{algorithm:'SHA256',checksumValue:crypto.createHash('sha256').update(item.integrity).digest('hex')}]:[]});
}
packages.sort((a,b)=>a.SPDXID.localeCompare(b.SPDXID));
const sbom={spdxVersion:'SPDX-2.3',dataLicense:'CC0-1.0',SPDXID:'SPDXRef-DOCUMENT',
  name:pkg.name+'-'+pkg.version,documentNamespace:'https://werkz-digital.eu/spdx/'+pkg.name+'/'+pkg.version,
  creationInfo:{created:'2026-10-01T00:00:00Z',creators:['Organization: Werk Z']},
  packages:[{SPDXID:'SPDXRef-Root',name:pkg.name,versionInfo:pkg.version,licenseConcluded:'NOASSERTION',
    licenseDeclared:'NOASSERTION',downloadLocation:'NOASSERTION',filesAnalyzed:false},...packages],
  relationships:packages.map(item=>({spdxElementId:'SPDXRef-Root',relatedSpdxElement:item.SPDXID,relationshipType:'DEPENDS_ON'}))};
const json=JSON.stringify(sbom,null,2)+'\n';
if(process.argv.includes('--check')){
  const stored=fs.readFileSync(path.join(root,'sbom.spdx.json'),'utf8');
  if(stored!==json)throw new Error('SBOM is stale: run npm run sbom and review the result');
  process.stdout.write('oss-audit: '+packages.length+' locked dependencies; SBOM matches\n');
}else if(process.argv.includes('--write')){
  fs.writeFileSync(path.join(root,'sbom.spdx.json'),json);process.stdout.write('sbom.spdx.json updated\n');
}else process.stdout.write(json);
