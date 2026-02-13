const fs = require('fs');
const path = require('path');

/**
 * This script creates a symbolic link from the dist folder to the SiYuan plugin directory
 * Usage: node scripts/make_dev_link.js <siyuan_workspace_path>
 */

function makeDevLink() {
    const workspacePath = process.argv[2] || process.env.VITE_SIYUAN_WORKSPACE_PATH;
    
    if (!workspacePath) {
        console.error('Error: Please provide SiYuan workspace path');
        console.log('Usage: node scripts/make_dev_link.js <path>');
        console.log('Or set VITE_SIYUAN_WORKSPACE_PATH environment variable');
        process.exit(1);
    }

    const pluginDir = path.join(workspacePath, 'data', 'plugins', 'siyuan-ai-assistant');
    const distDir = path.join(__dirname, '..', 'dist');

    // Create plugin directory if it doesn't exist
    const pluginsDir = path.dirname(pluginDir);
    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir, { recursive: true });
    }

    // Remove existing link or directory
    if (fs.existsSync(pluginDir)) {
        const stats = fs.lstatSync(pluginDir);
        if (stats.isSymbolicLink()) {
            fs.unlinkSync(pluginDir);
        } else if (stats.isDirectory()) {
            fs.rmSync(pluginDir, { recursive: true });
        }
    }

    // Create symbolic link
    try {
        fs.symlinkSync(distDir, pluginDir, 'junction');
        console.log(`✓ Created symbolic link:`);
        console.log(`  ${distDir}`);
        console.log(`  -> ${pluginDir}`);
        console.log('\nYou can now develop the plugin with hot reload.');
    } catch (error) {
        console.error('Error creating symbolic link:', error.message);
        console.log('\nOn Windows, you may need to run as Administrator.');
        process.exit(1);
    }
}

makeDevLink();
