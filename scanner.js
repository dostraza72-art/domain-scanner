const axios = require('axios');
const fs = require('fs');

const WHOIS_API_KEY = process.env.WHOIS_API_KEY || 'at_YZnIfhVW0RMkTsmPHO4yBYcI4ZHw6';

console.log(`✅ Using API Key: ${WHOIS_API_KEY.substring(0, 15)}...`);

const today = new Date();
const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

const dateFrom = sixtyDaysAgo.toISOString().split('T')[0];
const dateTo = today.toISOString().split('T')[0];

console.log(`\n📅 Searching: ${dateFrom} to ${dateTo} (60 days)\n`);

async function searchDomain(keyword, tld) {
  try {
    const url = `https://www.whoisxmlapi.com/api/v1/domains-search?keyword=${encodeURIComponent(keyword)}&tld=${tld}&registrationDateFrom=${dateFrom}&registrationDateTo=${dateTo}&apiKey=${WHOIS_API_KEY}`;
    
    const response = await axios.get(url, { timeout: 30000 });
    const count = response.data.domainsCount || 0;
    
    if (count > 0) {
      console.log(`✅ ${keyword}.${tld}: ${count} domains`);
      return response.data.domains;
    } else {
      console.log(`○ ${keyword}.${tld}: No results`);
      return [];
    }
  } catch (error) {
    console.error(`❌ ${keyword}.${tld}: ${error.response?.status || error.message}`);
    return [];
  }
}

async function main() {
  const keywords = ['999', '777', '666', '789', 'satta', 'khel', 'casino', 'betting'];
  const tlds = ['com', 'top', 'win', 'bet'];
  let allResults = [];
  
  for (let keyword of keywords) {
    for (let tld of tlds) {
      const results = await searchDomain(keyword, tld);
      allResults = allResults.concat(results);
      await new Promise(r => setTimeout(r, 800));
    }
  }
  
  console.log(`\n✅ COMPLETE - Found ${allResults.length} domains\n`);
  
  if (allResults.length > 0) {
    const csv = [
      'Domain,Registrar,Created',
      ...allResults.map(d => `"${d.domain}","${d.registrar || 'Unknown'}","${d.createDate || 'Unknown'}"`)
    ].join('\n');
    
    fs.writeFileSync(`domains-${dateTo}.csv`, csv);
    console.log(`💾 Saved: domains-${dateTo}.csv`);
  } else {
    console.log('⚠️ No domains found with current keywords.');
    console.log('Try: broader keywords, longer time period, or different extensions');
  }
}

main().catch(console.error);
