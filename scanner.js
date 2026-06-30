const https = require('https');
const fs = require('fs');

// ===== CUSTOMIZE THESE =====
const keywords = ['999', '777', '666', '789', 'satta', 'khel', 'casino', 'betting', 'lucky', 'play', 'cash', 'earn'];
const tlds = ['com', 'top', 'win', 'bet', 'app', 'online'];
// ===========================

console.log(`\n🔍 NEW DOMAIN DETECTOR (Using Certificate Transparency Logs)`);
console.log(`📅 Date: ${new Date().toLocaleString()}`);
console.log(`🔑 Keywords: ${keywords.join(', ')}`);
console.log(`📍 TLDs: ${tlds.join(', ')}\n`);

let foundDomains = [];

// Query Crt.sh (Free Certificate Transparency API)
async function queryCertTransparency(keyword, tld) {
  return new Promise((resolve) => {
    const domain = `${keyword}.${tld}`;
    const url = `https://crt.sh/?q=%25${keyword}%25.${tld}&output=json`;

    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        try {
          if (res.statusCode === 200 && data) {
            const results = JSON.parse(data);
            
            if (Array.isArray(results) && results.length > 0) {
              const domains = new Set();
              
              results.forEach(cert => {
                const domainName = cert.name_value || cert.common_name || '';
                if (domainName) {
                  domainName.split('\n').forEach(d => {
                    const clean = d.trim().toLowerCase().replace('*.', '');
                    if (clean && clean.includes(keyword)) {
                      domains.add(clean);
                    }
                  });
                }
              });

              resolve(Array.from(domains));
            } else {
              resolve([]);
            }
          } else {
            resolve([]);
          }
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));

    setTimeout(() => resolve([]), 10000);
  });
}

async function main() {
  console.log(`Searching Certificate Transparency logs for new domains...\n`);
  
  let processed = 0;
  const total = keywords.length * tlds.length;

  for (let keyword of keywords) {
    for (let tld of tlds) {
      processed++;
      process.stdout.write(`\r[${processed}/${total}] Scanning ${keyword}.${tld}...`);
      
      try {
        const domains = await queryCertTransparency(keyword, tld);
        
        domains.forEach(domain => {
          // Check if domain matches our criteria
          if (keywords.some(kw => domain.includes(kw)) && 
              tlds.some(t => domain.endsWith(`.${t}`))) {
            
            if (!foundDomains.find(d => d.domain === domain)) {
              foundDomains.push({
                domain: domain,
                keyword: keyword,
                tld: tld,
                found_via: 'Certificate Transparency',
                timestamp: new Date().toISOString()
              });
            }
          }
        });
      } catch (error) {
        console.error(`Error scanning ${keyword}.${tld}`);
      }

      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n\n${'='.repeat(70)}`);
  console.log(`✅ SCAN COMPLETE`);
  console.log(`${'='.repeat(70)}\n`);

  // Remove duplicates
  foundDomains = [...new Map(foundDomains.map(d => [d.domain, d])).values()];

  console.log(`📊 RESULTS:`);
  console.log(`   Total Keywords Scanned: ${keywords.length}`);
  console.log(`   Total TLDs Scanned: ${tlds.length}`);
  console.log(`   NEW Domains Found: ${foundDomains.length}\n`);

  if (foundDomains.length > 0) {
    console.log(`🎯 NEW DOMAINS WITH YOUR KEYWORDS:\n`);
    
    foundDomains.forEach((d, i) => {
      console.log(`${i+1}. ${d.domain}`);
      console.log(`   Keyword Match: ${d.keyword}`);
      console.log(`   TLD: .${d.tld}`);
      console.log(`   Found: ${d.timestamp}\n`);
    });

    // Save to CSV
    const csv = [
      'Domain,Keyword,TLD,Found_Via,Timestamp',
      ...foundDomains.map(d => 
        `"${d.domain}","${d.keyword}","${d.tld}","${d.found_via}","${d.timestamp}"`
      )
    ].join('\n');

    const filename = `new-domains-${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(filename, csv);
    console.log(`💾 Saved to: ${filename}\n`);

    // Alert message
    console.log(`\n🚨 ACTION: Write blog posts about these NEW domains!`);
    console.log(`   They just got SSL certificates (days/hours old)`);
    console.log(`   Get ahead of competitors!\n`);

  } else {
    console.log(`⚠️ No new domains found with your keywords`);
    console.log(`Tips to find more:`);
    console.log(
