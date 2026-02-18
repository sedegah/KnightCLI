import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dlevrkcfkzjuaalciblo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZXZya2Nma3pqdWFhbGNpYmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDU4MDA3MCwiZXhwIjoyMDg2MTU2MDcwfQ.UlhAKJtch5CP5JEuFIT2U-_8DvjwFNngKBiEXcjxzck";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const WORKER_MIGRATE_URL = "https://gnex-telegram-bot-dev.sedegahkimathi.workers.dev/migrate";

async function fetchSupabaseData(tableName = "users") {
  const { data, error } = await supabase.from(tableName).select("*");
  if (error) throw error;
  return data;
}

async function sendToWorker(data, tableName) {
  const res = await fetch(WORKER_MIGRATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table: tableName,
      data: data
    }),
  });

  const text = await res.text();
  console.log(`Status: ${res.status}, Response: ${text}`);
  
  if (!res.ok) {
    throw new Error(`Failed to send data: ${text}`);
  }
  
  return JSON.parse(text);
}

// Main migration function
async function main() {
  try {
    console.log("🚀 Starting migration from Supabase to KV...");
    
    // Get table name from command line args or default to "users"
    const tableName = process.argv[2] || "users";
    console.log(`📋 Migrating table: ${tableName}`);
    
    // Fetch data from Supabase
    const data = await fetchSupabaseData(tableName);
    console.log(`✅ Fetched ${data.length} records from Supabase`);
    
    if (data.length === 0) {
      console.log("ℹ️ No records to migrate");
      return;
    }
    
    // Optional: batch in chunks to avoid large payloads
    const batchSize = 100;
    let totalStored = 0;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(data.length / batchSize);
      
      console.log(`📦 Sending batch ${batchNum}/${totalBatches} (${batch.length} records)`);
      
      const result = await sendToWorker(batch, tableName);
      totalStored += result.total;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`🎉 Migration complete! Total records stored: ${totalStored}`);
    
    // Test one record
    if (data.length > 0) {
      const testId = data[0].id;
      console.log(`🔍 Testing record retrieval for ID: ${testId}`);
      
      const testResponse = await fetch(`${WORKER_MIGRATE_URL.replace('/migrate', '')}/kv-data/${testId}`);
      if (testResponse.ok) {
        const testData = await testResponse.json();
        console.log(`✅ Successfully retrieved test record:`, testData);
      } else {
        console.log(`❌ Failed to retrieve test record`);
      }
    }
    
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error);
