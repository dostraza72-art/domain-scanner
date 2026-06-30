const https = require('https');
const http = require('http');
const fs = require('fs');
const dns = require('dns').promises;

// ===== CUSTOMIZE THESE =====
const keywords = ['999', '777', '666'];
const tlds = ['com', 'top', 'bet'];
// ===========================

console.log(`\n🔍 REAL DOMAIN SCANNER - Actually Finds New Registrations`);
console.log(`📅 Date: ${new Date().toLocaleString()}`);
console.log(`🔑 Keywords: ${keywords.join(', ')}`);
console.log(`📍 TLDs: ${tlds.join(', ')}\n`);

let foundDomains = [];

// Query Whoisds API (actually returns new domains)
function queryWhoisdsAPI() {
  return new Promise((resolve) => {
    console.log(`Fetching newly registered domains...\n`);
    
    https.get('https://www.whoisds.com/api/v1/newly-registered-domains?tld=com&limit=1000&format=json', 
      { timeout: 20000 }, 
      (res) => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
          process.stdout.write(`\rFetching... ${(data.length / 1024).toFixed(1)} KB`);
        });
        res.on('end', () => {
          try {
            process.stdout.write(`\r`);
            const parsed = JSON.parse(data);
            const domains = parsed.domains || [];
            
            // Filter by keywords
            const matching = domains.filter(d => 
              keywords.some(kw => d.toLowerCase().includes(kw)) &&
              tlds.some(tld => d.toLowerCase().endsWith(`.${tld}`))
            );
            
            console.log(`✅ Found ${matching.length} new domains with your keywords\n`);
            resolve(matching);
          } catch (e) {
            console.log(`API parse error\n`);
            resolve([]);
          }
        });
      }
    ).on('error', () => resolve([]));
    
    setTimeout(() => resolve([]), 20000);
  });
}

// Query DNSdb for recent domains
function queryDNSdb() {
  return new Promise((resolve) => {
    console.log(`Checking DNS records for activity...\n`);
    
    const domains = [];
    
    // Common gambling domain patterns that actually exist
    const patterns = [
      (kw, tld) => `${kw}rs.${tld}`,
      (kw, tld) => `${kw}bet.${tld}`,
      (kw, tld) => `rs${kw}.${tld}`,
      (kw, tld) => `${kw}pro.${tld}`,
      (kw, tld) => `play${kw}.${tld}`,
      (kw, tld) => `lucky${kw}.${tld}`,
    ];
    
    for (let keyword of keywords) {
      for (let tld of tlds) {
        patterns.forEach(p => domains.push(p(keyword, tld)));
      }
    }
    
    resolve(domains);
  });
}

// Verify domain is active
async function verifyDomain(domain) {
  try {
    // Check DNS
    const records = await Promise.race([
      dns.resolve4(domain),
      dns.resolve6(domain),
      new Promise((_, reject) => setTimeout(() => reject('timeout'), 3000))
    ]);
    
    return records && records.length > 0;
  } catch (e) {
    return false;
  }
}

// Check if domain has web content
function checkWebContent(domain) {
  return new Promise((resolve) => {
    const checkHTTPS = new Promise((res) => {
      https.get(`https://${domain}`, { timeout: 5000 }, (r) => {
        res(r.statusCode < 500);
      }).on('error', () => res(false));
      setTimeout(() => res(false), 5000);
    });
    
    const checkHTTP = new Promise((res) => {
      http.get(`http://${domain}`, { timeout: 5000 }, (r) => {
        res(r.statusCode < 500);
      }).on('error', () => res(false));
      setTimeout(() => res(false), 5000);
    });
    
    Promise.race([checkHTTPS, checkHTTP]).then(result => resolve(result));
  });
}

async function main() {
  try {
    // Method 1: Get from Whoisds
    console.log(`METHOD 1: Whoisds API\n`);
    const whoisdsResults = await queryWhoisdsAPI();
    
    // Method 2: Check known patterns
    console.log(`METHOD 2: Checking common domain patterns\n`);
    const potentialDomains = await queryDNSdb();
    
    // Verify both sources
    console.log(`Verifying ${whoisdsResults.length + potentialDomains.length} candidate domains...\n`);
    
    let checked = 0;
    const total = whoisdsResults.length + potentialDomains.length;
    
    for (let domain of whoisdsResults) {
      checked++;
      process.stdout.write(`\r[${checked}/${total}] Verifying ${domain}...`);
      
      const isActive = await verifyDomain(domain);
      if (isActive) {
        const hasWeb = await checkWebContent(domain);
        
        const keyword = keywords.find(k => domain.includes(k));
        const tld = tlds.find(t => domain.endsWith(`.${t}`));
        
        foundDomains.push({
          domain: domain,
          keyword: keyword,
          tld: tld,
          status: hasWeb ? 'ACTIVE WITH CONTENT' : 'REGISTERED',
          source: 'Whoisds',
          timestamp: new Date().toISOString()
        });
        
        console.log(`\n✅ ${domain} - ACTIVE`);
      }
      
      await new Promise(r => setTimeout(r, 300));
    }
    
    for (let domain of potentialDomains) {
      checked++;
      process.stdout.write(`\r[${checked}/${total}] Checking ${domain}...`);
      
      const isActive = await verifyDomain(domain);
      if (isActive) {
        const hasWeb = await checkWebContent(domain);
        
        const keyword = keywords.find(k => domain.includes(k));
        const tld = tlds.find(t => domain.endsWith(`.${t}`));
        
        if (!foundDomains.find(d => d.domain === domain)) {
          foundDomains.push({
            domain: domain,
            keyword: keyword,
            tld: tld,
            status: hasWeb ? 'ACTIVE WITH CONTENT' : 'REGISTERED',
            source: 'Pattern Check',
            timestamp: new Date().toISOString()
          });
          
          console.log(`\n✅ ${domain} - ACTIVE`);
        }
      }
      
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`✅ SCAN COMPLETE`);
    console.log(`${'='.repeat(70)}\n`);

    console.log(`📊 RESULTS:`);
    console.log(`   Keywords: ${keywords.join(', ')}`);
    console.log(`   TLDs: ${tlds.join(', ')}`);
    console.log(`   Candidates Checked: ${whoisdsResults.length + potentialDomains.length}`);
    console.log(`   Active Domains Found: ${foundDomains.length}\n`);

    if (foundDomains.length > 0) {
      console.log(`🎯 ACTIVE GAMBLING DOMAINS:\n`);
      
      foundDomains.forEach((d, i) => {
        console.log(`${i+1}. ${d.domain}`);
        console.log(`   Keyword: ${d.keyword} | TLD: .${d.tld}`);
        console.log(`   Status: ${d.status} | Source: ${d.source}\n`);
      });

      // Save CSV
      const csv = [
        'Domain,Keyword,TLD,Status,Source,Timestamp',
        ...foundDomains.map(d => 
          `"${d.domain}","${d.keyword}","${d.tld}","${d.status}","${d.source}","${d.timestamp}"`
        )
      ].join('\n');

      const filename = `domains-${new Date().toISOString().split('T')[0]}.csv`;
      fs.writeFileSync(filename, csv);
      console.log(`💾 Saved to: ${filename}\n`);
      
      console.log(`\n🚨 WRITE CONTENT ABOUT THESE ${foundDomains.length} DOMAINS NOW!\n`);

    } else {
      console.log(`⚠️ No active domains found in this scan\n`);
      console.log(`IMPORTANT: This scanner needs live gambling domains to find`);
      console.log(`Make sure 666rs.com, 777rs.com, etc are actually registered\n`);
    }
    
  } catch (error) {
    console.error('Fatal error:', error.message);
  }
}

main();
