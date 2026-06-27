#![cfg(test)]
use crate::{verifier, RwaSettlementContract, RwaSettlementContractClient};
use soroban_sdk::{
    contractimport, Address as SorobanAddress, BytesN, Env, Vec, Bytes, U256,
};
use soroban_sdk::testutils::Address;

// Import the verifier contract WASM directly for the test client registration
contractimport!(
    file = "../../soroban-examples/groth16_verifier/target/wasm32v1-none/release/soroban_groth16_verifier_contract.wasm"
);

fn bytesn_from_hex<const N: usize>(env: &Env, hex_str: &str) -> BytesN<N> {
    let mut bytes = [0u8; N];
    for i in 0..N {
        let hex_byte = &hex_str[i * 2..i * 2 + 2];
        bytes[i] = u8::from_str_radix(hex_byte, 16).unwrap();
    }
    BytesN::from_array(env, &bytes)
}

#[test]
fn print_commitment() {
    let env = Env::default();
    let commitment: BytesN<32> = bytesn_from_hex(&env, "572516bc4e0bbaf9d5621b0a5a122e42ca09709f6d5216e84db9f39afb5fa532");
    let commitment_u256 = U256::from_be_bytes(&env, &Bytes::from_array(&env, &commitment.to_array()));
    let bytes = commitment_u256.to_be_bytes();
    let mut buf = [0u8; 32];
    bytes.copy_into_slice(&mut buf);
    extern crate std;
    std::println!("commitment_u256 bytes: {:?}", buf);
}

#[test]
fn test_successful_rwa_settlement() {
    let env = Env::default();
    env.mock_all_auths();

    // Register verifier contract
    let verifier_address = env.register(WASM, ());
    
    // Register RWA settlement contract
    let rwa_contract_address = env.register(RwaSettlementContract, ());
    let rwa_client = RwaSettlementContractClient::new(&env, &rwa_contract_address);

    // Set the verifier contract address
    rwa_client.set_verifier(&verifier_address);

    let issuer = SorobanAddress::generate(&env);
    let asset_id = 101;
    let face_value = 1000;

    // Mint the RWA asset
    rwa_client.mint_asset(&asset_id, &issuer, &face_value);

    // Verify initial state
    let asset = rwa_client.get_asset(&asset_id);
    assert_eq!(asset.face_value, 1000);
    assert_eq!(asset.settled, false);

    // Valid ZK proof inputs for amount = 1000, salt = 12345
    let alpha = bytesn_from_hex(&env, "0c6664dc51e24c78b0a514345b3407962cf22af46ada25b76cdafbe9529ef7c7eb96ace44f7b7378f577f36a3793bea00b902e5340bf34517d50df82ed8d97b56c45d933487e1006586acce433857271c12a9c5bdf94a0cecaf4b6412703837c");
    let beta = bytesn_from_hex(&env, "09ad87c2384058b30e4573e3b4d1aa2b1accd426f0d625dc3dfb564cf69a7e3ba611a8831f19a214b6b32ebdba6a08360492f1b44648c0c3915c82fbe76d55f15eb87d506f010c3e176e5368b00b5207d1e05e0b12213fea9d5d2442e213ed190d7d8fb520e164e1b8a113eb738abf89f3343e7e1ce3f3420a83af90b3b0ecdaa51dd7ea10e5ea003f6d28d392e6281106747cb85a59572a5aa31b5a306ad5f20dadb53c4aa9b09404452ca6aeda5291e5fca17f9096d5a68e47c92341281fac");
    let delta = bytesn_from_hex(&env, "1639798ed8f7f40d58246d3432b2aab592fdfa9dfcb48f357a70a78ef2f518851c52cdc8a0cdd49cd0004b2acdfb90e2083b0b28b3f767613788661b2d53d8a17b38ea7b4b102c6a1a225ad062548d40560ce34dd5d0ac54f3267c2d0c9526a608d573352bef5618ded389e47dee054988a0add2b8dbbb8ceb9e09ed642ba8506f0272b1c7844451fc8c86f03693c3651033450a310d8bbf8f8b545b265cb4bd3eef4940ed8dd356fdab2d9a38a6b5f585c52408390867484810456062534034");
    let gamma = bytesn_from_hex(&env, "13e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7e024aa2b2f08f0a91260805272dc51051c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb80606c4a02ea734cc32acd2b02bc28b99cb3e287e85a763af267492ab572e99ab3f370d275cec1da1aaa9075ff05f79be0ce5d527727d6e118cc9cdc6da2e351aadfd9baa8cbdd3a76d429a695160d12c923ac9cc3baca289e193548608b82801");
    
    let mut ic = Vec::new(&env);
    ic.push_back(bytesn_from_hex(&env, "03f98587b0da45c9a308a70a45ac5ab961d8d8115d5980577422fd05ec75290efb995031480e6a5cefe6010b6ca0b8e70b58bad58e1e428f3053b1db3f1e7fdeee2e0d7bf2c1efcbf4e3674123b0335ce9a204f2b60f38ee3778b59bcd164ec3"));
    ic.push_back(bytesn_from_hex(&env, "04c047f8018a9b0d8c92254613258a2d88a58f04d000984ef832dde8240a1a73b650f5e7a2615c7f1d97e2b53570e607092edecf177f4c0574d8ad0e4057759f0dee0b858a50508b7fc8f75c63f3e9752c0114dd7a84a8eabae0cce2f1dd5035"));
    ic.push_back(bytesn_from_hex(&env, "0c71dddb091737234c44e27704b2d26730f34c794c38d4eaaaf51ed3956b5db92bdd396310ab12a6b5c5191986941469170bb0f3a449a9b04146560305eacd641adbc491d02db535609db491bc0fc5edd15927f98539f98b029866a835b83d3a"));

    let vk = crate::VerificationKey { alpha, beta, delta, gamma, ic };

    let pi_a = bytesn_from_hex(&env, "15ae420e004a52688e075ef3d4efde22770fd3f4b8145b1d6911fdee5a014c6c743fde86b19366229875dbde1cbc7fca133fb24c3b60832f445af042eec846d429046ffc1cfd527ad0b795ddd26fed204c6c78ac4e8d698a7e56599279f68d4a");
    let pi_b = bytesn_from_hex(&env, "01be9079389034cd1890575627dc0baa7c687b70e4dc623865b80a5fb2253097cc2f9f2476960ba3ee13cfb32946e89319b75130fe05e87c70b3d0623400061f3a192dd530997cb6273d1441e6a0ff224045c93100e6d39864bce446bd8276730b010cb2a005e986916189c65dbd22e4875b9a23f34a59738ac9f2d1bf82bcbb99b3d4c141dd1145f4c3e3ad4bd3d7bd01caea2906711ef287aa005183bb560878480db7a7307fa8316563e9767042e28082352cf0f0bebcfb99d96356709931");
    let pi_c = bytesn_from_hex(&env, "15d9f54e541dc2604b3a3b5ccf89ab15cf0d1bce2e3f61a4541c426b2af3e61801945d96f1642eadd247c375d7b3b8441081178db71b924a272902600d7ca92d400fac3c98d48ae8d20ecd7d0c1a71f1a8a3ff23d94d9f2466583690063b7ac6");
    
    let proof = crate::Proof { a: pi_a, b: pi_b, c: pi_c };

    // Commitment is the Poseidon hash of (1000, 12345)
    let commitment = bytesn_from_hex(&env, "572516bc4e0bbaf9d5621b0a5a122e42ca09709f6d5216e84db9f39afb5fa532");

    let ephemeral_public_key = BytesN::from_array(&env, &[0u8; 65]);
    let iv = BytesN::from_array(&env, &[0u8; 12]);
    let tag = BytesN::from_array(&env, &[0u8; 16]);
    let ciphertext = Bytes::new(&env);

    // Perform successful settlement
    rwa_client.settle_asset(
        &asset_id,
        &vk,
        &proof,
        &commitment,
        &ephemeral_public_key,
        &iv,
        &tag,
        &ciphertext,
    );

    // Verify the state has updated to settled
    let asset_after = rwa_client.get_asset(&asset_id);
    assert_eq!(asset_after.settled, true);
}

#[test]
#[should_panic]
fn test_failed_rwa_settlement_invalid_proof() {
    let env = Env::default();
    env.mock_all_auths();

    // Register verifier contract
    let verifier_address = env.register(WASM, ());
    
    // Register RWA settlement contract
    let rwa_contract_address = env.register(RwaSettlementContract, ());
    let rwa_client = RwaSettlementContractClient::new(&env, &rwa_contract_address);

    rwa_client.set_verifier(&verifier_address);

    let issuer = SorobanAddress::generate(&env);
    let asset_id = 101;
    let face_value = 2000; // Face value is 2000, but proof is generated for 1000!

    rwa_client.mint_asset(&asset_id, &issuer, &face_value);

    // Valid inputs but for face value 1000 (which will mismatch stored face value of 2000)
    let alpha = bytesn_from_hex(&env, "0c6664dc51e24c78b0a514345b3407962cf22af46ada25b76cdafbe9529ef7c7eb96ace44f7b7378f577f36a3793bea00b902e5340bf34517d50df82ed8d97b56c45d933487e1006586acce433857271c12a9c5bdf94a0cecaf4b6412703837c");
    let beta = bytesn_from_hex(&env, "09ad87c2384058b30e4573e3b4d1aa2b1accd426f0d625dc3dfb564cf69a7e3ba611a8831f19a214b6b32ebdba6a08360492f1b44648c0c3915c82fbe76d55f15eb87d506f010c3e176e5368b00b5207d1e05e0b12213fea9d5d2442e213ed190d7d8fb520e164e1b8a113eb738abf89f3343e7e1ce3f3420a83af90b3b0ecdaa51dd7ea10e5ea003f6d28d392e6281106747cb85a59572a5aa31b5a306ad5f20dadb53c4aa9b09404452ca6aeda5291e5fca17f9096d5a68e47c92341281fac");
    let delta = bytesn_from_hex(&env, "1639798ed8f7f40d58246d3432b2aab592fdfa9dfcb48f357a70a78ef2f518851c52cdc8a0cdd49cd0004b2acdfb90e2083b0b28b3f767613788661b2d53d8a17b38ea7b4b102c6a1a225ad062548d40560ce34dd5d0ac54f3267c2d0c9526a608d573352bef5618ded389e47dee054988a0add2b8dbbb8ceb9e09ed642ba8506f0272b1c7844451fc8c86f03693c3651033450a310d8bbf8f8b545b265cb4bd3eef4940ed8dd356fdab2d9a38a6b5f585c52408390867484810456062534034");
    let gamma = bytesn_from_hex(&env, "13e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7e024aa2b2f08f0a91260805272dc51051c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb80606c4a02ea734cc32acd2b02bc28b99cb3e287e85a763af267492ab572e99ab3f370d275cec1da1aaa9075ff05f79be0ce5d527727d6e118cc9cdc6da2e351aadfd9baa8cbdd3a76d429a695160d12c923ac9cc3baca289e193548608b82801");
    
    let mut ic = Vec::new(&env);
    ic.push_back(bytesn_from_hex(&env, "03f98587b0da45c9a308a70a45ac5ab961d8d8115d5980577422fd05ec75290efb995031480e6a5cefe6010b6ca0b8e70b58bad58e1e428f3053b1db3f1e7fdeee2e0d7bf2c1efcbf4e3674123b0335ce9a204f2b60f38ee3778b59bcd164ec3"));
    ic.push_back(bytesn_from_hex(&env, "04c047f8018a9b0d8c92254613258a2d88a58f04d000984ef832dde8240a1a73b650f5e7a2615c7f1d97e2b53570e607092edecf177f4c0574d8ad0e4057759f0dee0b858a50508b7fc8f75c63f3e9752c0114dd7a84a8eabae0cce2f1dd5035"));
    ic.push_back(bytesn_from_hex(&env, "0c71dddb091737234c44e27704b2d26730f34c794c38d4eaaaf51ed3956b5db92bdd396310ab12a6b5c5191986941469170bb0f3a449a9b04146560305eacd641adbc491d02db535609db491bc0fc5edd15927f98539f98b029866a835b83d3a"));

    let vk = crate::VerificationKey { alpha, beta, delta, gamma, ic };

    let pi_a = bytesn_from_hex(&env, "15ae420e004a52688e075ef3d4efde22770fd3f4b8145b1d6911fdee5a014c6c743fde86b19366229875dbde1cbc7fca133fb24c3b60832f445af042eec846d429046ffc1cfd527ad0b795ddd26fed204c6c78ac4e8d698a7e56599279f68d4a");
    let pi_b = bytesn_from_hex(&env, "01be9079389034cd1890575627dc0baa7c687b70e4dc623865b80a5fb2253097cc2f9f2476960ba3ee13cfb32946e89319b75130fe05e87c70b3d0623400061f3a192dd530997cb6273d1441e6a0ff224045c93100e6d39864bce446bd8276730b010cb2a005e986916189c65dbd22e4875b9a23f34a59738ac9f2d1bf82bcbb99b3d4c141dd1145f4c3e3ad4bd3d7bd01caea2906711ef287aa005183bb560878480db7a7307fa8316563e9767042e28082352cf0f0bebcfb99d96356709931");
    let pi_c = bytesn_from_hex(&env, "15d9f54e541dc2604b3a3b5ccf89ab15cf0d1bce2e3f61a4541c426b2af3e61801945d96f1642eadd247c375d7b3b8441081178db71b924a272902600d7ca92d400fac3c98d48ae8d20ecd7d0c1a71f1a8a3ff23d94d9f2466583690063b7ac6");
    
    let proof = crate::Proof { a: pi_a, b: pi_b, c: pi_c };

    // Commitment matches amount 1000
    let commitment = bytesn_from_hex(&env, "572516bc4e0bbaf9d5621b0a5a122e42ca09709f6d5216e84db9f39afb5fa532");

    let ephemeral_public_key = BytesN::from_array(&env, &[0u8; 65]);
    let iv = BytesN::from_array(&env, &[0u8; 12]);
    let tag = BytesN::from_array(&env, &[0u8; 16]);
    let ciphertext = Bytes::new(&env);

    // This must fail because the face value of 2000 does not match the proof (amount 1000)
    rwa_client.settle_asset(
        &asset_id,
        &vk,
        &proof,
        &commitment,
        &ephemeral_public_key,
        &iv,
        &tag,
        &ciphertext,
    );
}
