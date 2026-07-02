const fs = require('fs');
const content = fs.readFileSync('F:/workProject/avpbc-pop/services/dataPackage.uts', 'utf-8');
const lines = content.split('\n');
let depth = 0;
let inComment = false;
for(let i=820; i<940; i++) {
  const line = lines[i];
  let j = 0;
  while (j < line.length) {
    if (!inComment) {
      if (line.substr(j, 2) === '//') break;
      if (line.substr(j, 2) === '/*') { inComment = true; j += 2; continue; }
      if (line[j] === '\'') {
        j++;
        while(j < line.length && line[j] !== '\'') { if (line[j] === '\\') j++; j++; }
      } else if (line[j] === '\"') {
        j++;
        while(j < line.length && line[j] !== '\"') { if (line[j] === '\\') j++; j++; }
      } else if (line[j] === '\`') {
        j++;
        while(j < line.length && line[j] !== '\`') { if (line[j] === '\\') j++; j++; }
      } else if (line[j] === '{') {
        depth++;
      } else if (line[j] === '}') {
        depth--;
      }
    } else {
      if (line.substr(j, 2) === '*/') { inComment = false; j += 2; continue; }
    }
    j++;
  }
  if (i >= 825) console.log(i+1, depth, line.trim());
}
