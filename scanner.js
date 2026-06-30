const https = require('https');
const fs = require('fs');
const net = require('net');
const dns = require('dns').promises;

// ===== CUSTOMIZE THESE =====
const keywords = ['999', '777', '666'];
const tlds = ['com', 'top', 'bet'];
// ===========================

console.log(`\n🔍 DOMAIN SCANNER - Last 30 Days Registration`);
console.log(`📅 Date: ${new Date().toLocaleString()}`);
console.log(`🔑 Keywords: ${keywords.join(', ')}`);
console.log(`📍 TLDs: ${tlds.join(', ')}\n`);

let foundDomains = [];

// Get date 30 days ago
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

console.log(`Searching for domains registered between:`);
console.log(`  From: ${thirtyDaysAgo.toDateString()}`);
console.log(`  To: ${new Date().toDateString()}\n`);

// Query Certificate Transparency for domains with keyword
function queryCertTransparency(keyword, tld) {
  return new Promise((resolve) => {
    const url = `https://crt.sh/?q=%25${keyword}%25.${tld}&output=json`;
    
    https.get(url, { timeout: 20000 }, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        try {
          if (res.statusCode === 200 && data) {
            const results = JSON.parse(data);
            
            if (Array.isArray(results) && results.length > 0) {
              const domains = new Set();
              
              results.forEach(cert => {
                const domainName = cert.name_value || '';
                if (domainName) {
                  domainName.split('\n').forEach(d => {
                    const clean = d.trim().toLowerCase().replace('*.', '');
                    if (clean && clean.includes(keyword) && clean.endsWith(`.${tld}`)) {
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

    setTimeout(() => resolve([]), 20000);
  });
}

// Query WHOIS for registration date
function queryWhois(domain) {
  return new Promise((resolve) => {
    const whoisServer = 'whois.verisign-grs.com';
    
    try {
      const socket = net.createConnection(43, whoisServer);
      let data = '';
      
      socket.setTimeout(8000);
      
      socket.on('connect', () => {
        socket.write(`${domain}\r\n`);
      });
      
      socket.on('data', (chunk) => {
        data += chunk.toString();
      });
      
      socket.on('end', () => {
        socket.destroy();
        resolve(data);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve('');
      });
      
      socket.on('error', () => {
        resolve('');
      });
    } catch (error) {
      resolve('');
    }
  });
}

function extractRegistrationDate(whoisData) {
  if (!whoisData || whoisData.length === 0) return null;
  
  const patterns = [
    /Creation Date:\s*(\d{4}-\d{2}-\d{2})/i,
    /Created Date:\s*(\d{4}-\d{2}-\d{2})/i,
    /created:\s*(\d{4}-\d{2}-\d{2})/i,
    /Registered:\s*(\d{4}-\d{2}-\d{2})/i,
  ];
  
  for (let pattern of patterns) {
    const match = whoisData.match(pattern);
    if (match) {
      try {
        return new Date(match[1]);
      } catch (e) {
        return null;
      }
    }
  }
  
  return null;
}

function isWithinLast30Days(date) {
  if (!date) return false;
  const now = new Date();
  return date >= thirtyDaysAgo && date <= now;
}

// Verify domain is active via DNS
async function verifyDomain(domain) {
  try {
    await dns.resolve4(domain);
    return true;
  } catch {
    try {
      await dns.resolve6(domain);
      return true;
    } catch {
      return false;
    }
  }
}

async function scanDomain(domain) {
  try {
    // First verify it's active
    const isActive = await verifyDomain(domain);
    if (!isActive) {
      return null;
    }
    
    // Query WHOIS for registration date
    const whoisData = await queryWhois(domain);
    const registrationDate = extractRegistrationDate(whoisData);
    
    // Check if registered in last 30 days
    if (registrationDate && isWithinLast30Days(registrationDate)) {
      const keyword = keywords.find(kw => domain.includes(kw));
      const tld = tlds.find(t => domain.endsWith(`.${t}`));
      const daysOld = Math.floor((new Date() - registrationDate) / (1000 * 60 * 60 * 24));
      
      return {
        domain: domain,
        keyword: keyword,
        tld: tld,
        registered_date: registrationDate.toISOString().split('T')[0],
        days_old: daysOld,
        status: 'NEW REGISTRATION',
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    // Continue on error
  }
  
  return null;
}

async function main() {
  console.log(`Starting scan...\n`);
  
  let allCandidates = new Set();
  let processed = 0;
  const total = keywords.length * tlds.length;
  
  // Query CT for all keyword+tld combinations
  for (let keyword of keywords) {
    for (let tld of tlds) {
      processed++;
      process.stdout.write(`\r[${processed}/${total}] Querying ${keyword}.${tld}...`);
      
      const domains = await queryCertTransparency(keyword, tld);
      domains.forEach(d => allCandidates.add(d));
      
      await new Promise(r => setTimeout(r, 600));
    }
  }
  
  allCandidates = Array.from(allCandidates).sort();
  console.log(`\n\nFound ${allCandidates.length} candidate domains\n`);
  
  if (allCandidates.length === 0) {
    console.log(`⚠️ No domains found with keywords: ${keywords.join(', ')}`);
    console.log(`   TLDs: ${tlds.join(', ')}\n`);
    return;
  }
  
  console.log(`Verifying and checking registration dates...\n`);
  
  let checked = 0;
  for (let domain of allCandidates) {
    checked++;
    process.stdout.write(`\r[${checked}/${allCandidates.length}] ${domain}`);
    
    const result = await scanDomain(domain);
    if (result) {
      foundDomains.push(result);
      console.log(`\n   ✅ NEW - Registered ${result.days_old} days ago`);
    }
    
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n\n${'='.repeat(70)}`);
  console.log(`✅ SCAN COMPLETE`);
  console.log(`${'='.repeat(70)}\n`);

  console.log(`📊 RESULTS:`);
  console.log(`   Keywords Searched: ${keywords.join(', ')}`);
  console.log(`   TLDs: ${tlds.join(', ')}`);
  console.log(`   Timeframe: Last 30 days`);
  console.log(`   Candidate Domains: ${allCandidates.length}`);
  console.log(`   Newly Registered: ${foundDomains.length}\n`);

  if (foundDomains.length > 0) {
    console.log(`🎯 NEWLY REGISTERED DOMAINS (Last 30 Days):\n`);
    
    // Sort by newest first
    foundDomains.sort((a, b) => a.days_old - b.days_old);
    
    foundDomains.forEach((d, i) => {
      console.log(`${i+1}. ${d.domain}`);
      console.log(`   └─ Keyword: ${d.keyword} | TLD: .${d.tld} | Age: ${d.days_old} days | Registered: ${d.registered_date}\n`);
    });

    // Save to CSV
    const csv = [
      'Domain,Keyword,TLD,Registered_Date,Days_Old,Status,Timestamp',
      ...foundDomains.map(d => 
        `"${d.domain}","${d.keyword}","${d.tld}","${d.registered_date}","${d.days_old}","${d.status}","${d.timestamp}"`
      )
    ].join('\n');

    const filename = `domains-${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(filename, csv);
    console.log(`💾 Results saved to: ${filename}\n`);

    console.log(`\n🚨 ACTION: ${foundDomains.length} NEW GAMBLING DOMAINS FOUND!`);
    console.log(`   Write SEO content immediately`);
    console.log(`   Get ahead of competitors\n`);

  } else {
    console.log(`⚠️ No newly registered domains found`);
    console.log(`   Checked: ${allCandidates.length} candidate domains`);
    console.log(`   None were registered in the last 30 days\n`);
  }
}

main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
