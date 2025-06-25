#!/usr/bin/env node

/**
 * Database Reset Script for Deployment
 * Resets the database to have only salar@letsinsure.org as admin
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetDatabase() {
  try {
    console.log('🚀 Starting database reset for deployment...');
    
    // Read the SQL file
    const sqlFile = path.join(__dirname, '..', 'reset_database_for_deployment.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('📝 Executing database reset SQL...');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.includes('SELECT') && (statement.includes('message') || statement.includes('table_name'))) {
        // These are display queries, execute and show results
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });
        if (error) {
          console.error('❌ Error executing statement:', error);
        } else if (data) {
          console.log('📊 Results:', data);
        }
      } else {
        // Regular SQL statement
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        if (error) {
          console.error('❌ Error executing statement:', error);
          console.error('   Statement:', statement.substring(0, 100) + '...');
        }
      }
    }
    
    // Verify the reset by checking the admin user
    console.log('\n🔍 Verifying database reset...');
    
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('*');
    
    if (employeesError) {
      console.error('❌ Error checking employees:', employeesError);
    } else {
      console.log('👥 Employees in database:', employees.length);
      employees.forEach(emp => {
        console.log(`   - ${emp.name} (${emp.email}) - ${emp.role} - ${emp.status}`);
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
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`   ${table}: Error - ${error.message}`);
      } else {
        console.log(`   ${table}: ${count} records`);
      }
    }
    
    console.log('\n✅ Database reset completed successfully!');
    console.log('🎯 Ready for deployment with only salar@letsinsure.org as admin');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
}

// Alternative approach using direct SQL execution
async function resetDatabaseDirect() {
  try {
    console.log('🚀 Starting database reset for deployment...');
    
    // Clear all data except salar@letsinsure.org
    const clearDataQueries = [
      'DELETE FROM chat_messages',
      'DELETE FROM conversation_states', 
      'DELETE FROM bonus_events',
      'DELETE FROM employee_bonuses',
      'DELETE FROM high_value_policy_notifications',
      'DELETE FROM overtime_requests',
      'DELETE FROM requests',
      'DELETE FROM daily_summaries',
      'DELETE FROM client_reviews',
      'DELETE FROM policy_sales',
      'DELETE FROM time_logs',
      'DELETE FROM password_resets',
      "DELETE FROM employees WHERE email != 'salar@letsinsure.org'"
    ];
    
    console.log('🗑️ Clearing existing data...');
    for (const query of clearDataQueries) {
      const { error } = await supabase.rpc('exec_sql', { sql_query: query });
      if (error) {
        console.error(`❌ Error executing: ${query}`, error);
      } else {
        console.log(`✅ Executed: ${query}`);
      }
    }
    
    // Update or create salar admin user
    console.log('👤 Setting up admin user...');
    
    const { data: existingAdmin, error: checkError } = await supabase
      .from('employees')
      .select('*')
      .eq('email', 'salar@letsinsure.org')
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking for admin user:', checkError);
      return;
    }
    
    if (existingAdmin) {
      // Update existing admin
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          name: 'Salar Admin',
          department: 'Administration',
          position: 'Administrator',
          status: 'active',
          role: 'admin',
          hourly_rate: 50.00,
          max_hours_before_overtime: 40
        })
        .eq('email', 'salar@letsinsure.org');
      
      if (updateError) {
        console.error('❌ Error updating admin user:', updateError);
      } else {
        console.log('✅ Updated existing admin user');
      }
    } else {
      // Create new admin
      const { error: createError } = await supabase
        .from('employees')
        .insert({
          clerk_user_id: 'admin_salar_lets_insure',
          name: 'Salar Admin',
          email: 'salar@letsinsure.org',
          department: 'Administration',
          position: 'Administrator',
          status: 'active',
          role: 'admin',
          hourly_rate: 50.00,
          max_hours_before_overtime: 40
        });
      
      if (createError) {
        console.error('❌ Error creating admin user:', createError);
      } else {
        console.log('✅ Created new admin user');
      }
    }
    
    // Verify final state
    console.log('\n🔍 Verifying database reset...');
    
    const { data: finalEmployees, error: finalError } = await supabase
      .from('employees')
      .select('*');
    
    if (finalError) {
      console.error('❌ Error checking final state:', finalError);
    } else {
      console.log('👥 Final employees in database:', finalEmployees.length);
      finalEmployees.forEach(emp => {
        console.log(`   - ${emp.name} (${emp.email}) - ${emp.role} - ${emp.status}`);
      });
    }
    
    console.log('\n✅ Database reset completed successfully!');
    console.log('🎯 Ready for deployment with only salar@letsinsure.org as admin');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
}

// Run the reset
if (require.main === module) {
  resetDatabaseDirect();
}

module.exports = { resetDatabase, resetDatabaseDirect }; 