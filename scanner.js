const https = require('https');
const http = require('http');
const fs = require('fs');
const net = require('net');
const dns = require('dns').promises;

// ===== CUSTOMIZE THESE =====
const keywords = ['999', '777', '666'];
const tlds = ['com', 'top', 'bet'];
// ===========================

console.log(`\n🔍 DOMAIN SCANNER - Real-Time Registration Monitor`);
console.log(`📅 Date: ${new Date().toLocaleString()}`);
console.log(`🔑 Keywords: ${keywords.join(', ')}`);
console.log(`📍 TLDs: ${tlds.join(', ')}\n`);

let foundDomains = [];
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

// Method 1: Query Whoisds.com (New domain registrations)
function queryWhoisds() {
  return new Promise((resolve) => {
    console.log(`Querying Whoisds new registrations...\n`);
    
    const options = {
      hostname: 'whoisds.com',
      path: '/api/v1/newly-registered-domains?tld=com&limit=1000&format=json',
      method: 'GET',
      timeout: 30000
    };
    
    https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
        process.stdout.write(`\rDownloading... ${(data.length / 1024).toFixed(1)}KB`);
      });
      
      res.on('end', () => {
        try {
          process.stdout.write(`\r`);
          const results = JSON.parse(data);
          const domains = [];
          
          if (Array.isArray(results.data) || results.domains) {
            const domainList = results.data || results.domains || [];
            domainList.forEach(d => {
              const domain = typeof d === 'string' ? d : d.domain;
              keywords.forEach(kw => {
                if (domain && domain.includes(kw)) {
                  domains.push(domain);
                }
              });
            });
          }
          
          console.log(`Found ${domains.length} candidates from Whoisds\n`);
          resolve(domains);
        } catch (e) {
          console.log(`Whoisds API error\n`);
          resolve([]);
        }
      });
    }).on('error', () => {
      resolve([]);
    }).end();
    
    setTimeout(() => resolve([]), 30000);
  });
}

// Method 2: Generate potential domains and check if they exist + registration date
async function generateAndCheckDomains() {
  console.log(`Generating potential domain combinations...\n`);
  
  const prefixes = ['play', 'lucky', 'win', 'best', 'pro', 'live', 'online', 'real', 'super', 'mega', 'prime', 'elite', 'gold', 'royal'];
  const suffixes = ['rs', 'bet', 'pro', 'game', 'play', 'win', 'club', 'io', 'app', 'online', 'site', 'world'];
  
  let candidates = new Set();
  
  // Exact keywords
  for (let keyword of keywords) {
    for (let tld of tlds) {
      candidates.add(`${keyword}.${tld}`);
    }
  }
  
  // With prefixes
  for (let prefix of prefixes) {
    for (let keyword of keywords) {
      for (let tld of tlds) {
        candidates.add(`${prefix}${keyword}.${tld}`);
      }
    }
  }
  
  // With suffixes
  for (let keyword of keywords) {
    for (let suffix of suffixes) {
      for (let tld of tlds) {
        candidates.add(`${keyword}${suffix}.${tld}`);
      }
    }
  }
  
  const domainList = Array.from(candidates);
  console.log(`Generated ${domainList.length} candidate domains to check\n`);
  
  const found = [];
  let checked = 0;
  
  for (let domain of domainList) {
    checked++;
    process.stdout.write(`\r[${checked}/${domainList.length}] Checking ${domain}...`);
    
    try {
      // Check if domain resolves
      const result = await Promise.race([
        dns.resolve4(domain),
        dns.resolve6(domain)
      ]);
      
      if (result && result.length > 0) {
        // Domain exists - check WHOIS
        const whoisData = await queryWhois(domain);
        const regDate = extractDate(whoisData);
        
        if (regDate && isRecent(regDate)) {
          found.push({
            domain: domain,
            registered: regDate.toISOString().split('T')[0],
            days_old: Math.floor((new Date() - regDate) / (1000*60*60*24))
          });
          console.log(`\n✅ ${domain} - ${regDate.toISOString().split('T')[0]}`);
        }
      }
    } catch (error) {
      // Domain doesn't exist, continue
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  return found;
}

// Query WHOIS
function queryWhois(domain) {
  return new Promise((resolve) => {
    try {
      const socket = net.createConnection(43, 'whois.verisign-grs.com');
      let data = '';
      
      socket.setTimeout(5000);
      socket.on('connect', () => socket.write(`${domain}\r\n`));
      socket.on('data', chunk => data += chunk.toString());
      socket.on('end', () => resolve(data));
      socket.on('timeout', () => {
        socket.destroy();
        resolve('');
      });
      socket.on('error', () => resolve(''));
    } catch (e) {
      resolve('');
    }
  });
}

function extractDate(whoisData) {
  if (!whoisData) return null;
  
  const patterns = [
    /Creation Date:\s*(\d{4}-\d{2}-\d{2})/i,
    /Created Date:\s*(\d{4}-\d{2}-\d{2})/i,
    /Registered:\s*(\d{4}-\d{2}-\d{2})/i,
  ];
  
  for (let p of patterns) {
    const m = whoisData.match(p);
    if (m) {
      try {
        return new Date(m[1]);
      } catch (e) {}
    }
  }
  return null;
}

function isRecent(date) {
  return date >= thirtyDaysAgo && date <= new Date();
}

async function main() {
  try {
    // Try Whoisds first
    const whoisdsResults = await queryWhoisds();
    
    // Generate and check potential domains
    const generatedResults = await generateAndCheckDomains();
    
    // Combine and deduplicate
    const allResults = [
      ...whoisdsResults.map(d => ({
        domain: d,
        keyword: keywords.find(k => d.includes(k)),
        tld: tlds.find(t => d.endsWith(`.${t}`)),
        source: 'Whoisds'
      })),
      ...generatedResults.map(d => ({
        domain: d.domain,
        keyword: keywords.find(k => d.domain.includes(k)),
        tld: tlds.find(t => d.domain.endsWith(`.${t}`)),
        registered: d.registered,
        days_old: d.days_old,
        source: 'WHOIS Check'
      }))
    ];
    
    foundDomains = allResults.filter((d, i, a) => a.findIndex(x => x.domain === d.domain) === i);
    
    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`✅ SCAN COMPLETE`);
    console.log(`${'='.repeat(70)}\n`);
    
    console.log(`📊 RESULTS:`);
    console.log(`   Keywords: ${keywords.join(', ')}`);
    console.log(`   TLDs: ${tlds.join(', ')}`);
    console.log(`   Active Domains Found: ${foundDomains.length}\n`);
    
    if (foundDomains.length > 0) {
      console.log(`🎯 ACTIVE DOMAINS WITH YOUR KEYWORDS:\n`);
      
      foundDomains.forEach((d, i) => {
        console.log(`${i+1}. ${d.domain}`);
        console.log(`   Keyword: ${d.keyword}`);
        console.log(`   TLD: .${d.tld}`);
        if (d.days_old) console.log(`   Registered: ${d.registered} (${d.days_old} days ago)`);
        console.log(`   Found via: ${d.source}\n`);
      });
      
      const csv = [
        'Domain,Keyword,TLD,Days_Old,Source,Timestamp',
        ...foundDomains.map(d => 
          `"${d.domain}","${d.keyword}","${d.tld}","${d.days_old || 'N/A'}","${d.source}","${new Date().toISOString()}"`
        )
      ].join('\n');
      
      const filename = `domains-${new Date().toISOString().split('T')[0]}.csv`;
      fs.writeFileSync(filename, csv);
      console.log(`💾 Saved to: ${filename}\n`);
      
      console.log(`\n🚨 FOUND ${foundDomains.length} ACTIVE DOMAINS!`);
      console.log(`   Write content immediately!\n`);
    } else {
      console.log(`⚠️ No active domains found in this scan`);
      console.log(`   Run again tomorrow for new registrations\n`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
