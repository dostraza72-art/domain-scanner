const https = require('https');
const http = require('http');
const fs = require('fs');
const net = require('net');
const dns = require('dns').promises;

console.log(`\n🔍 .BET DOMAIN MONITOR - Last 24 Hours`);
console.log(`📅 Date: ${new Date().toLocaleString()}`);
console.log(`📍 Extension: .bet`);
console.log(`⏰ Timeframe: Last 24 hours\n`);

let foundDomains = [];
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

// Method 1: Query Afilias WHOIS server (manages .bet TLD)
function queryBetWhois() {
  return new Promise((resolve) => {
    console.log(`Querying .BET WHOIS server for recent registrations...\n`);
    
    const socket = net.createConnection(43, 'whois.afilias-grs.net');
    let data = '';
    
    socket.setTimeout(10000);
    
    socket.on('connect', () => {
      // Query for recent registrations
      socket.write(`*.bet\r\n`);
    });
    
    socket.on('data', (chunk) => {
      data += chunk.toString();
    });
    
    socket.on('end', () => {
      resolve(data);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve('');
    });
    
    socket.on('error', () => {
      resolve('');
    });
  });
}

// Method 2: Use Domaintools API (free tier has limits)
function queryDomaintoolsNewDomains() {
  return new Promise((resolve) => {
    console.log(`Querying Domaintools new domains feed...\n`);
    
    https.get('https://research.domaintools.com/api/v1/domains/search?query=tld:.bet', 
      { timeout: 15000 }, 
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.results || []);
          } catch (e) {
            resolve([]);
          }
        });
      }
    ).on('error', () => resolve([]));
    
    setTimeout(() => resolve([]), 15000);
  });
}

// Method 3: Check zone file dumps and registrar feeds
function queryZoneFileData() {
  return new Promise((resolve) => {
    console.log(`Checking zone file registrations...\n`);
    
    // Query public zone file APIs
    const urls = [
      'https://zonemaster.iis.se/api/v4/domains.json?tld=bet',
      'https://www.whoisds.com/api/v1/newly-registered-domains?tld=bet&limit=10000&format=json'
    ];
    
    let results = [];
    let completed = 0;
    
    urls.forEach(url => {
      https.get(url, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const domains = parsed.domains || parsed.data || [];
            results = results.concat(domains);
          } catch (e) {}
          
          completed++;
          if (completed === urls.length) {
            resolve(results);
          }
        });
      }).on('error', () => {
        completed++;
        if (completed === urls.length) {
          resolve(results);
        }
      });
    });
    
    setTimeout(() => resolve(results), 15000);
  });
}

// Extract registration date from WHOIS
function extractRegistrationDate(whoisData) {
  if (!whoisData) return null;
  
  const patterns = [
    /Creation Date:\s*(\d{4}-\d{2}-\d{2})/i,
    /Created Date:\s*(\d{4}-\d{2}-\d{2})/i,
    /Registered:\s*(\d{4}-\d{2}-\d{2})/i,
    /created on:\s*(\d{4}-\d{2}-\d{2})/i,
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

// Query specific domain WHOIS
function queryDomainWhois(domain) {
  return new Promise((resolve) => {
    try {
      const socket = net.createConnection(43, 'whois.afilias-grs.net');
      let data = '';
      
      socket.setTimeout(5000);
      
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

// Verify domain is active
async function verifyDomain(domain) {
  try {
    const result = await Promise.race([
      dns.resolve4(domain),
      dns.resolve6(domain),
      new Promise((_, reject) => setTimeout(() => reject('timeout'), 3000))
    ]);
    
    return result && result.length > 0;
  } catch (e) {
    return false;
  }
}

async function main() {
  try {
    console.log(`Starting scan for all .BET domains registered in last 24 hours...\n`);
    
    // Get candidates from multiple sources
    const whoisResults = await queryBetWhois();
    const domaintoolsResults = await queryDomaintoolsNewDomains();
    const zoneFileResults = await queryZoneFileData();
    
    // Combine and deduplicate
    let allCandidates = new Set();
    
    [whoisResults, domaintoolsResults, zoneFileResults].forEach(results => {
      if (Array.isArray(results)) {
        results.forEach(domain => {
          const d = typeof domain === 'string' ? domain : domain.domain || domain.name;
          if (d && d.toLowerCase().endsWith('.bet')) {
            allCandidates.add(d.toLowerCase());
          }
        });
      }
    });
    
    const candidates = Array.from(allCandidates);
    console.log(`\nFound ${candidates.length} candidate .BET domains\n`);
    console.log(`Verifying registration dates...\n`);
    
    let verified = 0;
    
    for (let domain of candidates) {
      verified++;
      process.stdout.write(`\r[${verified}/${candidates.length}] Checking ${domain}...`);
      
      try {
        // Check if active
        const isActive = await verifyDomain(domain);
        
        if (isActive) {
          // Get registration date
          const whoisData = await queryDomainWhois(domain);
          const regDate = extractRegistrationDate(whoisData);
          
          if (regDate && regDate >= yesterday) {
            const hoursOld = Math.floor((new Date() - regDate) / (1000 * 60 * 60));
            
            foundDomains.push({
              domain: domain,
              registered_date: regDate.toISOString().split('T')[0],
              registered_time: regDate.toISOString().split('T')[1].substring(0, 5),
              hours_old: hoursOld,
              status: 'NEW REGISTRATION',
              timestamp: new Date().toISOString()
            });
            
            console.log(`\n✅ ${domain} - Registered ${hoursOld} hours ago`);
          }
        }
      } catch (error) {
        // Continue on error
      }
      
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`✅ SCAN COMPLETE`);
    console.log(`${'='.repeat(70)}\n`);

    console.log(`📊 RESULTS:`);
    console.log(`   Extension: .bet`);
    console.log(`   Timeframe: Last 24 hours`);
    console.log(`   Total Candidates: ${candidates.length}`);
    console.log(`   Active & Newly Registered: ${foundDomains.length}\n`);

    if (foundDomains.length > 0) {
      console.log(`🎯 ALL .BET DOMAINS REGISTERED IN LAST 24 HOURS:\n`);
      
      // Sort by newest first
      foundDomains.sort((a, b) => a.hours_old - b.hours_old);
      
      foundDomains.forEach((d, i) => {
        console.log(`${i+1}. ${d.domain}`);
        console.log(`   Registered: ${d.registered_date} ${d.registered_time}`);
        console.log(`   Age: ${d.hours_old} hours old\n`);
      });

      // Save to CSV
      const csv = [
        'Domain,TLD,Registered_Date,Registered_Time,Hours_Old,Status,Timestamp',
        ...foundDomains.map(d => 
          `"${d.domain}",".bet","${d.registered_date}","${d.registered_time}","${d.hours_old}","${d.status}","${d.timestamp}"`
        )
      ].join('\n');

      const filename = `bet-domains-${new Date().toISOString().split('T')[0]}.csv`;
      fs.writeFileSync(filename, csv);
      console.log(`💾 Saved to: ${filename}\n`);

      console.log(`\n🚨 ${foundDomains.length} NEW .BET DOMAINS FOUND!`);
      console.log(`   These are brand new registrations`);
      console.log(`   Likely gambling/betting sites\n`);

    } else {
      console.log(`⚠️ No new .BET domains found in last 24 hours`);
      console.log(`   Try running again in a few hours\n`);
    }
    
  } catch (error) {
    console.error('Fatal error:', error.message);
  }
}

main();
