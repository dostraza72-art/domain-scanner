const axios = require('axios');
const fs = require('fs');

const WHOIS_API_KEY = process.env.WHOIS_API_KEY;
const keywords = ['999', '777', '666', '789', 'casino', 'betting', 'satta', 'khel'];
const tlds = ['com', 'top', 'win', 'bet'];

const today = new Date();
const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

const dateFrom = sevenDaysAgo.toISOString().split('T')[0];
const dateTo = today.toISOString().split('T')[0];

console.log(`\n🔍 Starting scan: ${dateFrom} to ${dateTo}`);

let allDomains = [];

async function scan() {
  for (let keyword of keywords) {
    for (let tld of tlds) {
      try {
        const response = await axios.get(
          'https://www.whoisxmlapi.com/api/v1/domains-search',
          {
            params: {
              keyword: keyword,
              tld: tld,
              registrationDateFrom: dateFrom,
              registrationDateTo: dateTo,
              apiKey: WHOIS_API_KEY
            }
          }
        );

        const count = response.data.domainsCount || 0;
        if (count > 0) {
          console.log(`✅ ${keyword}.${tld}: ${count} domains`);
          for (let domain of response.data.domains) {
            allDomains.push({
              keyword,
              domain: domain.domain,
              registrar: domain.registrar || 'Unknown',
              created: domain.createDate || 'Unknown'
            });
          }
        }
      } catch (error) {
        console.error(`❌ ${keyword}.${tld}`);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n✅ Found: ${allDomains.length} domains`);

  const csv = [
    'Keyword,Domain,Registrar,Created',
    ...allDomains.map(d => 
      `"${d.keyword}","${d.domain}","${d.registrar}","${d.created}"`
    )
  ].join('\n');

  const filename = `domains-${new Date().toISOString().split('T')[0]}.csv`;
  fs.writeFileSync(filename, csv);
  console.log(`💾 Saved: ${filename}`);
}

scan().catch(console.error);
