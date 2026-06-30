const axios = require('axios');
const fs = require('fs');

const WHOIS_API_KEY = process.env.WHOIS_API_KEY;

if (!WHOIS_API_KEY) {
  console.error('❌ ERROR: WHOIS_API_KEY not found!');
  process.exit(1);
}

console.log(`✅ API Key found: ${WHOIS_API_KEY.substring(0, 10)}...`);

const keywords = ['game', 'app', 'online', 'play', 'casino', 'betting'];
const tlds = ['com'];

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

  for (let keyword of keywords) {
    for (let tld of tlds) {
      scanned++;
      try {
        const url = `https://www.whoisxmlapi.com/api/v1/domains-search?keyword=${keyword}&tld=${tld}&registrationDateFrom=${dateFrom}&registrationDateTo=${dateTo}&apiKey=${WHOIS_API_KEY}`;
        
        console.log(`Querying: ${keyword}.${tld}...`);
        
        const response = await axios.get(url, {
          timeout: 20000
        });

        const count = response.data.domainsCount || 0;
        
        if (count > 0) {
          console.log(`✅ ${keyword}.${tld}: ${count} domains FOUND!`);
          
          for (let domain of response.data.domains) {
            allDomains.push({
              keyword: keyword,
              domain: domain.domain,
              registrar: domain.registrar || 'Unknown',
              created: domain.createDate || 'Unknown'
            });
          }
        } else {
          console.log(`○ ${keyword}.${tld}: No results (but API working)`);
        }

      } catch (error) {
        const status = error.response?.status || 'No status';
        const errorMsg = error.response?.data?.error || error.message;
        
        if (status === 403) {
          console.error(`❌ 403 FORBIDDEN - Check API key or quota!`);
          console.error(`   Error: ${errorMsg}`);
        } else if (status === 404) {
          console.log(`○ 404 - No data for ${keyword}.${tld}`);
        } else {
          console.error(`❌ ${keyword}.${tld}: ${status} - ${errorMsg}`);
        }
      }

      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n✅ SCAN COMPLETE`);
  console.log(`Total domains found: ${allDomains.length}\n`);

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
    console.log('⚠️  No domains found');
    console.log('Possible reasons:');
    console.log('  1. API key quota exhausted (500/month)');
    console.log('  2. API key is invalid');
    console.log('  3. No new domains with these keywords');
  }
}

scan().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
