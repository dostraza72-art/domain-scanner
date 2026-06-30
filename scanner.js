const https = require('https');
const fs = require('fs');

// ===== CUSTOMIZE THESE =====
const keywords = ['999', '777', '666'];
const tlds = ['com', 'top', 'bet'];
// ===========================

console.log(`\n🔍 NEW DOMAIN DETECTOR (Last 30 Days)`);
console.log(`📅 Date: ${new Date().toLocaleString()}`);
console.log(`🔑 Keywords: ${keywords.join(', ')}`);
console.log(`📍 TLDs: ${tlds.join(', ')}`);
console.log(`📅 Timeframe: Last 30 days\n`);

let foundDomains = [];

// Get date 30 days ago
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

console.log(`Searching for domains registered between ${thirtyDaysAgo.toDateString()} and ${new Date().toDateString()}\n`);

// Query WHOIS for registration date
function queryWhois(domain) {
  return new Promise((resolve) => {
    const whoisServer = 'whois.verisign-grs.com';
    const net = require('net');
    
    const socket = net.createConnection(43, whoisServer);
    let data = '';
    
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      socket.write(`${domain}\r\n`);
    });
    
    socket.on('data', (chunk) => {
      data += chunk.toString();
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });
    
    socket.on('error', () => {
      resolve(null);
    });
    
    socket.on('end', () => {
      resolve(data);
    });
  });
}

function extractRegistrationDate(whoisData) {
  if (!whoisData) return null;
  
  const patterns = [
    /Creation Date:\s*(\d{4}-\d{2}-\d{2})/i,
    /created:\s*(\d{4}-\d{2}-\d{2})/i,
    /Created on:\s*(\d{4}-\d{2}-\d{2})/i,
    /registered:\s*(\d{4}-\d{2}-\d{2})/i,
  ];
  
  for (let pattern of patterns) {
    const match = whoisData.match(pattern);
    if (match) {
      return new Date(match[1]);
    }
  }
  
  return null;
}

function isWithinLast30Days(date) {
  if (!date) return false;
  return date >= thirtyDaysAgo && date <= new Date();
}

async function checkDomain(domain) {
  try {
    const whoisData = await queryWhois(domain);
    
    if (whoisData) {
      const registrationDate = extractRegistrationDate(whoisData);
      
      if (registrationDate && isWithinLast30Days(registrationDate)) {
        return {
          registered: true,
          date: registrationDate,
          whois: whoisData
        };
      }
    }
  } catch (error) {
    // Continue on error
  }
  
  return null;
}

async function generateDomainCandidates() {
  const patterns = [
    (kw, tld) => `${kw}.${tld}`,
    (kw, tld) => `play${kw}.${tld}`,
    (kw, tld) => `${kw}pro.${tld}`,
    (kw, tld) => `lucky${kw}.${tld}`,
    (kw, tld) => `${kw}bet.${tld}`,
    (kw, tld) => `${kw}game.${tld}`,
    (kw, tld) => `${kw}casino.${tld}`,
    (kw, tld) => `${kw}online.${tld}`,
    (kw, tld) => `best${kw}.${tld}`,
    (kw, tld) => `win${kw}.${tld}`,
  ];
  
  const domains = new Set();
  
  for (let keyword of keywords) {
    for (let tld of tlds) {
      patterns.forEach(pattern => {
        try {
          const domain = pattern(keyword, tld);
          domains.add(domain);
        } catch (e) {}
      });
    }
  }
  
  return Array.from(domains);
}

async function main() {
  console.log(`Generating domain candidates...\n`);
  
  const candidates = await generateDomainCandidates();
  console.log(`Checking ${candidates.length} candidate domains for registration in last 30 days...\n`);
  
  let checked = 0;
  
  for (let domain of candidates) {
    checked++;
    process.stdout.write(`\r[${checked}/${candidates.length}] Checking ${domain}...`);
    
    const result = await checkDomain(domain);
    
    if (result && result.registered) {
      const keyword = keywords.find(kw => domain.includes(kw));
      const tld = tlds.find(t => domain.endsWith(`.${t}`));
      
      if (!foundDomains.find(d => d.domain === domain)) {
        foundDomains.push({
          domain: domain,
          keyword: keyword || 'unknown',
          tld: tld || 'unknown',
          registered_date: result.date.toISOString().split('T')[0],
          days_old: Math.floor((new Date() - result.date) / (1000 * 60 * 60 * 24)),
          status: 'NEWLY REGISTERED',
          timestamp: new Date().toISOString()
        });
        
        console.log(`\n✅ ${domain} - Registered ${Math.floor((new Date() - result.date) / (1000 * 60 * 60 * 24))} days ago`);
      }
    }
    
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n\n${'='.repeat(70)}`);
  console.log(`✅ SCAN COMPLETE`);
  console.log(`${'='.repeat(70)}\n`);

  console.log(`📊 RESULTS:`);
  console.log(`   Keywords: ${keywords.join(', ')}`);
  console.log(`   TLDs: ${tlds.join(', ')}`);
  console.log(`   Timeframe: Last 30 days`);
  console.log(`   Total Checked: ${checked}`);
  console.log(`   Newly Registered: ${foundDomains.length}\n`);

  if (foundDomains.length > 0) {
    console.log(`🎯 NEWLY REGISTERED DOMAINS (Last 30 Days):\n`);
    
    foundDomains.sort((a, b) => a.days_old - b.days_old);
    
    foundDomains.forEach((d, i) => {
      console.log(`${i+1}. ${d.domain}`);
      console.log(`   Keyword: ${d.keyword}`);
      console.log(`   TLD: .${d.tld}`);
      console.log(`   Registered: ${d.registered_date} (${d.days_old} days ago)`);
      console.log(`   Status: ${d.status}\n`);
    });

    // Save to CSV
    const csv = [
      'Domain,Keyword,TLD,Registered_Date,Days_Old,Status,Timestamp',
      ...foundDomains.map(d => 
        `"${d.domain}","${d.keyword}","${d.tld}","${d.registered_date}","${d.days_old}","${d.status}","${d.timestamp}"`
      )
    ].join('\n');

    const filename = `new-domains-${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(filename, csv);
    console.log(`💾 Saved to: ${filename}\n`);

    console.log(`\n🚨 ACTION: Write SEO articles about these FRESH domains!`);
    console.log(`   These are brand new registrations (0-30 days old)`);
    console.log(`   Get content live FAST before competitors!\n`);

  } else {
    console.log(`⚠️ No newly registered domains found in last 30 days`);
    console.log(`   Keywords: 999, 777, 666`);
    console.log(`   TLDs: .com, .top, .bet`);
    console.log(`   Try running scan again tomorrow\n`);
  }
}

main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
