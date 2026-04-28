const fs = require('fs');
try {
    const raw = fs.readFileSync('test_rich_full_v6.srd', 'utf8');
    const data = JSON.parse(raw);
    console.log('Version:', data.meta?.version);
    console.log('Keys:', Object.keys(data));
    
    if (data.data && data.data.templates) {
        console.log('Templates:', Object.keys(data.data.templates).length);
        const firstTemplate = Object.values(data.data.templates)[0];
        console.log('First template:', Object.keys(firstTemplate));
    }
} catch (e) {
    console.error('Failed to parse:', e.message);
}
