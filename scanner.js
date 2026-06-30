const dns = require('dns').promises;
const fs = require('fs');

// ===== CUSTOMIZE THESE =====
const keywords = ['999', '777', '666', '789', 'satta', 'khel', 'casino', 'betting'];
const tlds = ['com', 'top', 'win', 'bet'];
// ===========================

console.log(`\n🔍 CUSTOM DOMAIN SCANNER (FREE - NO API NEEDED)`);
console.log(`📅 Date: ${new Date().toLocaleString()}`);
console.log(`🔑 Keywords: ${keywords.join(', ')}`);
console.log(`📍 Extensions: ${tlds.join(', ')}\n`);
console.log(`Scanning ${keywords.length * tlds.length} domains...\n`);

let foundDomains = [];
let scannedCount = 0;
let activeCount = 0;

async function checkDomain(domain) {
  try {
    // Try IPv4 resolution
    const result = await dns.resolve4(domain);
    return result.length > 0;
  } catch (error) {
    // Try IPv6 as backup
    try {
      const result = await dns.resolve6(domain);
      return result.length > 0;
    } catch {
      return false;
    }
  }
}

async function scanDomain(keyword, tld) {
  const domain = `${keyword}.${tld}`;
  scannedCount++;
  
  try {
    const isActive = await checkDomain(domain);
    
    if (isActive) {
      console.log(`✅ ${domain} - ACTIVE`);
      activeCount++;
      foundDomains.push({
        keyword: keyword,
        domain: domain,
        tld: tld,
        status: 'ACTIVE',
        checked_at: new Date().toISOString()
      });
    } else {
      console.log(`○ ${domain} - Inactive`);
    }
  } catch (error) {
    console.log(`? ${domain} - Error checking`);
  }
  
  await new Promise(resolve => setTimeout(resolve, 300));
}

async function main() {
  console.log(`Starting scan of ${keywords.length} keywords x ${tlds.length} TLDs\n`);
  
  for (let keyword of keywords) {
    for (let tld of tlds) {
      await scanDomain(keyword, tld);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ SCAN COMPLETE`);
  console.log(`${'='.repeat(60)}\n`);
  
  console.log(`📊 RESULTS:`);
  console.log(`   Total Scanned: ${scannedCount}`);
  console.log(`   Active Domains: ${activeCount}`);
  console.log(`   Percentage: ${((activeCount/scannedCount)*100).toFixed(1)}%\n`);

  if (foundDomains.length > 0) {
    console.log(`📋 ACTIVE DOMAINS FOUND:\n`);
    foundDomains.forEach((d, i) => {
      console.log(`${i+1}. ${d.domain}`);
      console.log(`   Keyword: ${d.keyword}`);
      console.log(`   TLD: .${d.tld}`);
      console.log(`   Status: ${d.status}`);
      console.log(`   Checked: ${d.checked_at}\n`);
    });

    // Save to CSV
    const csv = [
      'Keyword,Domain,TLD,Status,Checked_At',
      ...foundDomains.map(d => 
        `"${d.keyword}","${d.domain}","${d.tld}","${d.status}","${d.checked_at}"`
      )
    ].join('\n');

    const filename = `domains-${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(filename, csv);
    console.log(`💾 Results saved to: ${filename}\n`);
  } else {
    console.log(`⚠️  No active domains found`);
    console.log(`Try:`);
    console.log(`   - Adding more keywords`);
    console.log(`   - Changing TLDs`);
    console.log(`   - Running scan again in a few minutes\n`);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
