const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, '../src/lib/api/generated.ts');
let c = fs.readFileSync(p, 'utf8');
const header = '// DO NOT EDIT — generated from ../api/openapi.json — run npm run generate:api-types to regenerate\n';
if (!c.startsWith('// DO NOT EDIT')) {
  fs.writeFileSync(p, header + c, 'utf8');
  console.log('Header prepended to generated.ts');
} else {
  console.log('Header already present');
}
