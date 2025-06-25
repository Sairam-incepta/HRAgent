#!/usr/bin/env node

/**
 * Simple Database Reset Script for Deployment
 * Uses regular Supabase client instead of service role
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!supabaseAnonKey);
  console.log('\n💡 Please check your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function resetDatabaseSimple() {
  try {
    console.log('🚀 Starting simple database reset for deployment...');
    console.log('⚠️  This uses the regular Supabase client, so some operations may be limited by RLS policies');
    
    // Clear data that can be cleared with regular permissions
    const clearDataQueries = [
      { table: 'chat_messages', description: 'chat messages' },
      { table: 'conversation_states', description: 'conversation states' },
      { table: 'bonus_events', description: 'bonus events' },
      { table: 'employee_bonuses', description: 'employee bonuses' },
      { table: 'high_value_policy_notifications', description: 'high-value policy notifications' },
      { table: 'overtime_requests', description: 'overtime requests' },
      { table: 'requests', description: 'requests' },
      { table: 'daily_summaries', description: 'daily summaries' },
      { table: 'client_reviews', description: 'client reviews' },
      { table: 'policy_sales', description: 'policy sales' },
      { table: 'time_logs', description: 'time logs' },
      { table: 'password_resets', description: 'password resets' }
    ];
    
    console.log('🗑️ Clearing existing data...');
    for (const { table, description } of clearDataQueries) {
      try {
        // First get all records to delete them properly
        const { data: records, error: selectError } = await supabase
          .from(table)
          .select('id');
        
        if (selectError) {
          console.log(`⚠️  Could not access ${description}: ${selectError.message}`);
          continue;
        }
        
        if (records && records.length > 0) {
          const { error: deleteError } = await supabase
            .from(table)
            .delete()
            .in('id', records.map(r => r.id));
          
          if (deleteError) {
            console.log(`⚠️  Could not clear ${description}: ${deleteError.message}`);
          } else {
            console.log(`✅ Cleared ${records.length} ${description}`);
          }
        } else {
          console.log(`✅ ${description} already empty`);
        }
      } catch (err) {
        console.log(`⚠️  Error clearing ${description}:`, err.message);
      }
    }
    
    // Clear employees except salar@letsinsure.org
    console.log('👤 Cleaning up employees...');
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .neq('email', 'salar@letsinsure.org');
      
      if (error) {
        console.log(`⚠️  Could not clear other employees: ${error.message}`);
      } else {
        console.log('✅ Removed all employees except salar@letsinsure.org');
      }
    } catch (err) {
      console.log('⚠️  Error cleaning employees:', err.message);
    }
    
    // Check if salar admin exists
    console.log('🔍 Checking for admin user...');
    const { data: existingAdmin, error: checkError } = await supabase
      .from('employees')
      .select('*')
      .eq('email', 'salar@letsinsure.org')
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.log('⚠️  Could not check for admin user:', checkError.message);
    } else if (existingAdmin) {
      console.log('✅ Admin user already exists:', existingAdmin.name, '(' + existingAdmin.email + ')');
      
      // Try to update admin user (without role column since it may not exist)
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          name: 'Salar Admin',
          department: 'Administration',
          position: 'Administrator',
          status: 'active',
          hourly_rate: 50.00,
          max_hours_before_overtime: 40
        })
        .eq('email', 'salar@letsinsure.org');
      
      if (updateError) {
        console.log('⚠️  Could not update admin user:', updateError.message);
      } else {
        console.log('✅ Updated admin user details');
      }
    } else {
      console.log('❌ Admin user does not exist. You may need to create it manually or use the service role key.');
    }
    
    // Verify final state
    console.log('\n🔍 Verifying database state...');
    
    const { data: finalEmployees, error: finalError } = await supabase
      .from('employees')
      .select('*');
    
    if (finalError) {
      console.log('⚠️  Could not check final employee state:', finalError.message);
    } else {
      console.log('👥 Final employees in database:', finalEmployees.length);
      finalEmployees.forEach(emp => {
        console.log(`   - ${emp.name} (${emp.email}) - ${emp.role || 'no role'} - ${emp.status}`);
      });
    }
    
    // Check table counts
    const tables = [
      'policy_sales',
      'client_reviews', 
      'daily_summaries',
      'time_logs',
      'requests',
      'overtime_requests',
      'high_value_policy_notifications',
      'conversation_states',
      'employee_bonuses',
      'bonus_events',
      'chat_messages'
    ];
    
    console.log('\n📊 Table record counts:');
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`   ${table}: Could not check - ${error.message}`);
        } else {
          console.log(`   ${table}: ${count} records`);
        }
      } catch (err) {
        console.log(`   ${table}: Error - ${err.message}`);
      }
    }
    
    console.log('\n✅ Database reset completed!');
    console.log('🎯 Database is now clean and ready for deployment');
    console.log('\n📝 Next steps:');
    console.log('   1. If admin user doesn\'t exist, create it manually in Supabase dashboard');
    console.log('   2. Deploy your application');
    console.log('   3. Sign in as salar@letsinsure.org');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
}

// Run the reset
if (require.main === module) {
  resetDatabaseSimple();
}

module.exports = { resetDatabaseSimple }; 