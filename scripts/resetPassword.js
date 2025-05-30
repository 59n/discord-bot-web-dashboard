const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');

async function resetAdminPassword() {
    try {
        // Load users
        const data = await fs.readFile(path.join(__dirname, '../data/users.json'), 'utf8');
        const users = JSON.parse(data);
        
        // Find admin user
        const adminUser = users.find(u => u.username === 'admin');
        if (!adminUser) {
            console.log('Admin user not found');
            return;
        }
        
        // Hash new password
        const newPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        // Update admin password
        adminUser.password = hashedPassword;
        
        // Save back to file
        await fs.writeFile(
            path.join(__dirname, '../data/users.json'),
            JSON.stringify(users, null, 2)
        );
        
        console.log('✅ Admin password reset to: admin123');
        console.log('New hash:', hashedPassword);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

resetAdminPassword();
