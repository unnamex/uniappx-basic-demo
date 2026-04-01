const fs = require('fs'); const path = require('path'); const exts = ['.uvue', '.uts'];
function find(d) {
  fs.readdirSync(d).forEach(f => {
    const fp = path.join(d, f);
    if (f === 'node_modules' || f === '.git' || f === 'unpackage') return;
    const st = fs.statSync(fp);
    if (st.isDirectory()) find(fp);
    else if (exts.find(e => fp.endsWith(e))) {
      const c = fs.readFileSync(fp, 'utf8');
      if (c.includes('catch')) {
        // fix catch((e: any) =>) or catch((err: any) =>)
        let t = c.replace(/\.catch\s*\(\s*\(\s*(\w+)\s*:\s*any\s*\)\s*=>/g, '.catch(($1: any | null) =>');
        // also fix Promise constructor
        t = t.replace(/reject:\s*\(\s*(\w+)\s*:\s*any\s*\)\s*=>/g, 'reject: ($1: any | null) =>');
        if (t !== c) {
          fs.writeFileSync(fp, t, 'utf8');
          console.log('Fixed catch in', fp);
        }
      }
    }
  });
}
find('.');
