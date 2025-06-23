// Script to set admin role for a user
// Run this in your browser console on localhost:3000

async function setAdminRole() {
  try {
    console.log('🔧 Setting admin role...');
    
    // You'll need to replace 'YOUR_USER_ID' with your actual Clerk user ID
    const userId = 'YOUR_USER_ID'; // Replace this with your actual user ID
    
    const response = await fetch('/api/admin/set-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        role: 'admin'
      }),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Admin role set successfully!');
      console.log('🔄 Please refresh the page to see changes');
    } else {
      console.error('❌ Error:', result.error);
    }
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

// Uncomment the line below and replace YOUR_USER_ID with your actual user ID
// setAdminRole(); 