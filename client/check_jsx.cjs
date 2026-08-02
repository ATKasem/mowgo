const fs = require('fs');
const files = ['src/pages/Clients.jsx', 'src/pages/Invoices.jsx', 'src/pages/Home.jsx', 'src/pages/Settings.jsx', 'src/pages/Today.jsx', 'src/pages/Landing.jsx', 'src/App.jsx', 'src/components/Layout.jsx', 'src/components/JobCard.jsx', 'src/components/NewJobForm.jsx'];
for (const f of files) {
  try {
    const content = fs.readFileSync(f, 'utf8');
    const openDivs = (content.match(/<div/g) || []).length;
    const closeDivs = (content.match(/<\/div>/g) || []).length;
    const openSpans = (content.match(/<span/g) || []).length;
    const closeSpans = (content.match(/<\/span>/g) || []).length;
    if (openDivs !== closeDivs) console.log(f + ': div mismatch ' + openDivs + ' open vs ' + closeDivs + ' close');
    if (openSpans !== closeSpans) console.log(f + ': span mismatch ' + openSpans + ' open vs ' + closeSpans + ' close');
  } catch(e) { console.log(f + ': ' + e.message); }
}
console.log('Done');
