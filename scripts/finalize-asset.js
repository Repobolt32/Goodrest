/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

// Target paths
const inputFile = 'C:\\Users\\iamku\\.gemini\\antigravity\\brain\\90012cc7-034f-4c70-ab96-1046abd82a73\\.system_generated\\steps\\332\\output.txt';
const outputFile = path.join(process.cwd(), 'public', 'hero-dish-isolated-pure.png');

try {
    // Read the DataURL from the output file
    const content = fs.readFileSync(inputFile, 'utf8');
    
    // Extract base64 part
    const base64Match = content.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
    
    if (base64Match && base64Match[1]) {
        const base64Data = base64Match[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Write the PNG file
        fs.writeFileSync(outputFile, buffer);
        console.log(`Success: Asset saved to ${outputFile}`);
    } else {
        console.error("Error: Could not find valid base64 data in the file.");
    }
} catch (err) {
    console.error("Error processing asset:", err.message);
}
