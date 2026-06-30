const axios = require('axios');
const fs = require('fs');

const WHOIS_API_KEY = process.env.WHOIS_API_KEY || 'at_YZnIfhVW0RMkTsmPHO4yBYcI4ZHw6';

console.log(`✅ Using API Key: ${WHOIS_API_KEY.substring(0, 15)}...`);

const today = new Date();
const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

const dateFrom = sevenDaysAgo.toISOString().split('T')[0];
const dateTo = today.toISOString().split('T')[0];

console.log(`\n📅 Searching for domains registered between ${dateFrom} and ${dateTo}\n`);

async function searchDomain(keyword, tld) {
  try {
    const url = `https://www.whoisxmlapi.com/api/v1/domains-search?keyword=${encodeURIComponent(keyword)}&tld=${tld}&registrationDateFrom=${dateFrom}&registrationDateTo=${dateTo}&apiKey=${WHOIS_API_KEY}`;
    
    console.log(`Querying: ${keyword}.${tld}...`);
    
    const response = await axios.get(url, { timeout: 30000 });
    
    if (response.status === 200) {
      const count = response.data.domainsCount || 0;
      
      if (count > 0) {
        console.log(`✅ FOUND ${count} domains with "${keyword}.${tld}"`);
        console.log(`   Sample: ${response.data.domains[0].domain}\n`);
        return response.data.domains;
      } else {
        console.log(`○ No domains found\n`);
        return [];
      }
    }
  } catch (error) {
    const status = error.response?.status;
    const msg = error.response?.data?.error || error.message;
    
    if (status === 401 || status === 403) {
      console.error(`❌ AUTH ERROR: Check your API key!`);
      console.error(`   ${msg}\n`);
    } else if (status === 404) {
      console.log(`○ 404 - No data available\n`);
    } else {
      console.error(`❌ Error: ${status} - ${msg}\n`);
    }
    return [];
  }
}

async function main() {
  const keywords = ['book', 'game', 'app', 'casino'];
  const tld = 'com';
  let allResults = [];
  
  for (let keyword of keywords) {
    const results = await searchDomain(keyword, tld);
    allResults = allResults.concat(results);
    await new Promise(r => setTimeout(r, 1500));
  }
  
  console.log(`\n✅ COMPLETE - Found ${allResults.length} total domains`);
  
  if (allResults.length > 0) {
    const csv = [
      'Domain,Registrar,Created',
      ...allResults.map(d => `"${d.domain}","${d.registrar || 'Unknown'}","${d.createDate || 'Unknown'}"`)
    ].join('\n');
    
    fs.writeFileSync(`domains-${dateTo}.csv`, csv);
    console.log(`💾 Saved to: domains-${dateTo}.csv`);
  }
}

main().catch(console.error);
