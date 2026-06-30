const axios = require('axios');
const fs = require('fs');

const WHOIS_API_KEY = process.env.WHOIS_API_KEY;

if (!WHOIS_API_KEY) {
  console.error('❌ ERROR: WHOIS_API_KEY not found!');
  process.exit(1);
}

console.log(`✅ API Key found: ${WHOIS_API_KEY.substring(0, 10)}...`);

const keywords = ['999', '777', '666', '789', 'casino', 'betting'];
const tlds = ['com', 'top', 'win', 'bet'];

const today = new Date();
const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

const dateFrom = sevenDaysAgo.toISOString().split('T')[0];
const dateTo = today.toISOString().split('T')[0];

console.log(`\n📅 Scanning: ${dateFrom} to ${dateTo}`);
console.log(`🔑 Keywords: ${keywords.join(', ')}`);
console.log(`📍 Extensions: ${tlds.join(', ')}\n`);

let allDomains = [];

async function scan() {
  let scanned = 0;
  let found = 0;

  for (let keyword of keywords) {
    for (let tld of tlds) {
      scanned++;
      try {
        const url = 'https://www.whoisxmlapi.com/api/v1/domains-search';
        
        const response = await axios.get(url, {
          params: {
            keyword: keyword,
            tld: tld,
            registrationDateFrom: dateFrom,
            registrationDateTo: dateTo,
            apiKey: WHOIS_API_KEY
          },
          timeout: 15000
        });

        const count = response.data.domainsCount || 0;
        
        if (count > 0) {
          console.log(`✅ ${keyword}.${tld}: ${count} domains`);
          found += count;
          
          for (let domain of response.data.domains) {
            allDomains.push({
              keyword: keyword,
              domain: domain.domain,
              registrar: domain.registrar || 'Unknown',
              created: domain.createDate || 'Unknown'
            });
          }
        } else {
          console.log(`○ ${keyword}.${tld}: No results`);
        }

      } catch (error) {
        const errorMsg = error.response?.data?.error || error.message;
        console.error(`❌ ${keyword}.${tld}: ${errorMsg}`);
      }

      await new Promise(r => setTimeout(r, 400));
    }
  }

  console.log(`\n✅ SCAN COMPLETE`);
  console.log(`Scanned: ${scanned} | Found: ${found}`);
  console.log(`Total domains: ${allDomains.length}\n`);

  if (allDomains.length > 0) {
    const csv = [
      'Keyword,Domain,Registrar,Created',
      ...allDomains.map(d => 
        `"${d.keyword}","${d.domain}","${d.registrar}","${d.created}"`
      )
    ].join('\n');

    const filename = `domains-${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(filename, csv);
    console.log(`💾 Saved: ${filename}`);
  } else {
    console.log('No domains found - try broader keywords');
  }
}

scan().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
