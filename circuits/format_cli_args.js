const fs = require('fs');
const { execSync } = require('child_process');

function runConvert(filetype, filepath) {
    const cargoPath = '/mnt/c/Users/USER/.gemini/antigravity-ide/scratch/stellar-rwa-marketplace/soroban-examples/privacy-pools/cli/circom2soroban/Cargo.toml';
    const cmd = `cargo run --quiet --manifest-path=${cargoPath} -- ${filetype} ${filepath}`;
    const output = execSync(cmd).toString();
    const hexMatch = output.match(/Hex encoding:\s*\n([0-9a-fA-F]+)/);
    if (!hexMatch) {
        throw new Error(`Failed to find hex encoding in output of ${filetype} conversion`);
    }
    return hexMatch[1];
}

try {
    const vkHex = runConvert('vk', '/mnt/c/Users/USER/.gemini/antigravity-ide/scratch/stellar-rwa-marketplace/circuits/verification_key.json');
    const proofHex = runConvert('proof', '/mnt/c/Users/USER/.gemini/antigravity-ide/scratch/stellar-rwa-marketplace/circuits/proof.json');

    // Parse Proof
    const a = proofHex.substring(0, 192);
    const b = proofHex.substring(192, 192 + 384);
    const c = proofHex.substring(192 + 384, 192 + 384 + 192);

    const proofJson = { a, b, c };

    // Parse VK
    const alpha = vkHex.substring(0, 192);
    const beta = vkHex.substring(192, 192 + 384);
    const gamma = vkHex.substring(192 + 384, 192 + 384 + 384);
    const delta = vkHex.substring(192 + 384 + 384, 192 + 384 + 384 + 384);
    
    // Parse IC
    const icLenHex = vkHex.substring(192 + 384 + 384 + 384, 192 + 384 + 384 + 384 + 8);
    const icLen = parseInt(icLenHex, 16);
    
    const ic = [];
    let startIdx = 192 + 384 + 384 + 384 + 8;
    for (let i = 0; i < icLen; i++) {
        ic.push(vkHex.substring(startIdx, startIdx + 192));
        startIdx += 192;
    }

    const vkJson = { alpha, beta, delta, gamma, ic };

    fs.writeFileSync('/mnt/c/Users/USER/.gemini/antigravity-ide/scratch/stellar-rwa-marketplace/circuits/custom_proof_args.json', JSON.stringify(proofJson, null, 2));
    fs.writeFileSync('/mnt/c/Users/USER/.gemini/antigravity-ide/scratch/stellar-rwa-marketplace/circuits/custom_vk_args.json', JSON.stringify(vkJson, null, 2));

    console.log("Successfully formatted and wrote custom ZK CLI arguments!");
} catch (e) {
    console.error(e);
}
