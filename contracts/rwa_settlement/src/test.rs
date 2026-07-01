#![cfg(test)]
use crate::{verifier, RwaSettlementContract, RwaSettlementContractClient, AssetClass, AssetStatus};
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
    rwa_client.mint_asset(&asset_id, &issuer, &face_value, &AssetClass::TreasuryBill, &0u64, &0u64);

    // Verify initial state
    let asset = rwa_client.get_asset(&asset_id);
    assert_eq!(asset.face_value, 1000);
    assert_eq!(asset.status, AssetStatus::Active);

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
    assert_eq!(asset_after.status, AssetStatus::Settled);
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

    rwa_client.mint_asset(&asset_id, &issuer, &face_value, &AssetClass::TreasuryBill, &0u64, &0u64);

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

#[test]
fn test_successful_discount_settlement() {
    let env = Env::default();
    env.mock_all_auths();

    let verifier_address = env.register(WASM, ());

    let rwa_contract_address = env.register(RwaSettlementContract, ());
    let rwa_client = RwaSettlementContractClient::new(&env, &rwa_contract_address);

    rwa_client.set_verifier(&verifier_address);

    let issuer = SorobanAddress::generate(&env);
    let asset_id = 201;
    let face_value = 1000;

    rwa_client.mint_asset(&asset_id, &issuer, &face_value, &AssetClass::TreasuryBill, &0u64, &0u64);

    let asset = rwa_client.get_asset(&asset_id);
    assert_eq!(asset.face_value, 1000);
    assert_eq!(asset.status, AssetStatus::Active);

    // Discount circuit VK (from discount_onchain_data.json)
    let alpha = bytesn_from_hex(&env, "07b12aa9b309402dd44d1bf8d888ba0cae641a9f36cdcc7e84ce80fc3e6fe7f46c6ce53898dcbd79bdb357f994d3e3d109ccc53d5d43da77f716cfb18c8aeb9b76dcba8a4c908e4e7faae1e73591733662ff484328621b90b296844fc68eea9c");
    let beta = bytesn_from_hex(&env, "129e24196f60a79418119903435dba800a41244e860f2fd509644dc9724a07492995865e997ce9f1dfdc47d81e03a4d1044700199ca0ed2b98ba5b9dc8a1a6ec1d1bc6349491bcb70ae1191f6db5fee31f8e98f8875d79c1156964459a62a12406c9c39dcbad5cf9836d398008d35520a3977259bf083bfdd8a80ab00ff59e28705238d4ae9724e6c04b55e6bc01abc40e69d517c35ea382a58c3df7391cf69c37baa3cc6bc23bb0418f90bb95342e72f33d9a17551a77205fa1de953d9db91e");
    let delta = bytesn_from_hex(&env, "12b9a7bc86f42de50090c6d1136a25381a9d0db9689253205a87d68dcd5af0c1dd108cc31382ebe4e8c7a4ff03a79675162eaf365f165bbbe7926cf29d0b05b6d07c8b6c6be0ecafe4a44ff69295c4be7adb01b95fa94ccd15e0c403d383fd38026fdd5f2e57e1cae69288af5eba2b9459a38e98f7943b3e3f589d5542bab0e5884b2cd228070544aeb98dcaa157bd46092a4b7125abfc48ecee1d3f6eb113b132473b2145c8496da63ef0f492e40c913ca74b5b80b3ee7689e4f20ef0c78059");
    let gamma = bytesn_from_hex(&env, "13e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7e024aa2b2f08f0a91260805272dc51051c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb80606c4a02ea734cc32acd2b02bc28b99cb3e287e85a763af267492ab572e99ab3f370d275cec1da1aaa9075ff05f79be0ce5d527727d6e118cc9cdc6da2e351aadfd9baa8cbdd3a76d429a695160d12c923ac9cc3baca289e193548608b82801");

    let mut ic = Vec::new(&env);
    ic.push_back(bytesn_from_hex(&env, "0307b395e60005ea96872f43651bb9379bc4f4096c9cd441662f2181893801280ae67f0e5c9e1c4c8c1c5ece6518a69107d24e5e3548cc0297392f541cfa5fb83f6781274cbd95cb55887790a033dd9b9da06fe030d636f62df9cbe7fa202480"));
    ic.push_back(bytesn_from_hex(&env, "0d6c4b09bbf070280f8eece4f488e63274ab6df22e67bca5ebddac76d2a10ddef79b1686d8083c827c18cfb16578856e0e94b3b0ab5d585aa2c6e606ead94010c8715c69615fab0f6751e8301e8aa07065ad4fd9c68b973ea03b2cf27cc13ca1"));
    ic.push_back(bytesn_from_hex(&env, "0a0e8fdb994e9d2601a08c4b698f6bee23cc5d564244e95a853bdfd47773e7a2537bf525a9cf9d72b0348d82be27d36f002758a29dd82161026526e7248434db526b35de3b82aebf83d6c2b629967874dd8af980f28c6f9a7e97eb6cd4d4022e"));
    ic.push_back(bytesn_from_hex(&env, "16fcc5eaa37ac8a1d73b246acc6bd1bdba9eafa455a633ee252ddc415a450105dd86975dae8ee8565ab70f2d660126700fd6dc63e6524903f20a35c5ab5e91783daa3bf417d54ca9c050e07b73f4846a54c8c57106db2cee25efba4e45e57174"));

    let vk = crate::VerificationKey { alpha, beta, delta, gamma, ic };

    let pi_a = bytesn_from_hex(&env, "137f60c8c6b41215ddba78598801ce8f1afd7cc9f002fd21c54b6c35f1e064b51f1e7be6f24d73d70efb1557e407c9cf111e55fe6df3d1454cefbad0f7d5541bc2dcb9041c3da82294fd68ff8d57667d5a8f9608b1abe522dd36abb8f9037b29");
    let pi_b = bytesn_from_hex(&env, "191ae116b9f05187113e718e7c346b13e602fa4696761fa03cd18e13814bfcb7b55b912d6a7b5203bd29a66154b85c63032792a66a0209b388a48c4b213b3bc82561042ad204f92fc67b7af9f732541d72de92caa42e0693317cad682dcdd64e0a6d4644b010d02da9385a135ea043020d77113f0f9b1b12d3eec2bbc4b74800d32a06622be08a9bb3172a29d4683466057492339eadc7b328840440e0d111cd0fd90db331e791d42b5cd85437b1e941b8cccac714c5a3ac606dd27f6fe3a610");
    let pi_c = bytesn_from_hex(&env, "05ab1ebfa5d3ccce4c2b3e26635e083742d3536fdf663248b0edc8550d009fdb7e55b427821d8cbb7abadf464cc5912a153bd2db91a0bbf923e3fcff19971af1df53b3f49e20bf52ddcebe337aa14c443ac9c487bbc6b70a8c69921cb35cc331");

    let proof = crate::Proof { a: pi_a, b: pi_b, c: pi_c };

    // Commitment from discount circuit: PoseidonHash(950, 12345)
    // Public signal decimal: 6408272698239178225411083654062795493542558659353722046744538377651303953508
    let commitment = bytesn_from_hex(&env, "0e2af42d136edccc7d4629bced04e547066cd7033464986a684eb7a64a5b3464");

    let discount_bps: u64 = 500; // 5% discount

    let ephemeral_public_key = BytesN::from_array(&env, &[0u8; 65]);
    let iv = BytesN::from_array(&env, &[0u8; 12]);
    let tag = BytesN::from_array(&env, &[0u8; 16]);
    let ciphertext = Bytes::new(&env);

    rwa_client.settle_asset_discounted(
        &asset_id,
        &vk,
        &proof,
        &discount_bps,
        &commitment,
        &ephemeral_public_key,
        &iv,
        &tag,
        &ciphertext,
    );

    let asset_after = rwa_client.get_asset(&asset_id);
    assert_eq!(asset_after.status, AssetStatus::Settled);
}

#[test]
#[should_panic]
fn test_discount_settlement_bps_zero_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let verifier_address = env.register(WASM, ());

    let rwa_contract_address = env.register(RwaSettlementContract, ());
    let rwa_client = RwaSettlementContractClient::new(&env, &rwa_contract_address);

    rwa_client.set_verifier(&verifier_address);

    let issuer = SorobanAddress::generate(&env);
    let asset_id = 202;
    let face_value = 1000;

    rwa_client.mint_asset(&asset_id, &issuer, &face_value, &AssetClass::TreasuryBill, &0u64, &0u64);

    let alpha = bytesn_from_hex(&env, "07b12aa9b309402dd44d1bf8d888ba0cae641a9f36cdcc7e84ce80fc3e6fe7f46c6ce53898dcbd79bdb357f994d3e3d109ccc53d5d43da77f716cfb18c8aeb9b76dcba8a4c908e4e7faae1e73591733662ff484328621b90b296844fc68eea9c");
    let beta = bytesn_from_hex(&env, "129e24196f60a79418119903435dba800a41244e860f2fd509644dc9724a07492995865e997ce9f1dfdc47d81e03a4d1044700199ca0ed2b98ba5b9dc8a1a6ec1d1bc6349491bcb70ae1191f6db5fee31f8e98f8875d79c1156964459a62a12406c9c39dcbad5cf9836d398008d35520a3977259bf083bfdd8a80ab00ff59e28705238d4ae9724e6c04b55e6bc01abc40e69d517c35ea382a58c3df7391cf69c37baa3cc6bc23bb0418f90bb95342e72f33d9a17551a77205fa1de953d9db91e");
    let delta = bytesn_from_hex(&env, "12b9a7bc86f42de50090c6d1136a25381a9d0db9689253205a87d68dcd5af0c1dd108cc31382ebe4e8c7a4ff03a79675162eaf365f165bbbe7926cf29d0b05b6d07c8b6c6be0ecafe4a44ff69295c4be7adb01b95fa94ccd15e0c403d383fd38026fdd5f2e57e1cae69288af5eba2b9459a38e98f7943b3e3f589d5542bab0e5884b2cd228070544aeb98dcaa157bd46092a4b7125abfc48ecee1d3f6eb113b132473b2145c8496da63ef0f492e40c913ca74b5b80b3ee7689e4f20ef0c78059");
    let gamma = bytesn_from_hex(&env, "13e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7e024aa2b2f08f0a91260805272dc51051c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb80606c4a02ea734cc32acd2b02bc28b99cb3e287e85a763af267492ab572e99ab3f370d275cec1da1aaa9075ff05f79be0ce5d527727d6e118cc9cdc6da2e351aadfd9baa8cbdd3a76d429a695160d12c923ac9cc3baca289e193548608b82801");

    let mut ic = Vec::new(&env);
    ic.push_back(bytesn_from_hex(&env, "0307b395e60005ea96872f43651bb9379bc4f4096c9cd441662f2181893801280ae67f0e5c9e1c4c8c1c5ece6518a69107d24e5e3548cc0297392f541cfa5fb83f6781274cbd95cb55887790a033dd9b9da06fe030d636f62df9cbe7fa202480"));
    ic.push_back(bytesn_from_hex(&env, "0d6c4b09bbf070280f8eece4f488e63274ab6df22e67bca5ebddac76d2a10ddef79b1686d8083c827c18cfb16578856e0e94b3b0ab5d585aa2c6e606ead94010c8715c69615fab0f6751e8301e8aa07065ad4fd9c68b973ea03b2cf27cc13ca1"));
    ic.push_back(bytesn_from_hex(&env, "0a0e8fdb994e9d2601a08c4b698f6bee23cc5d564244e95a853bdfd47773e7a2537bf525a9cf9d72b0348d82be27d36f002758a29dd82161026526e7248434db526b35de3b82aebf83d6c2b629967874dd8af980f28c6f9a7e97eb6cd4d4022e"));
    ic.push_back(bytesn_from_hex(&env, "16fcc5eaa37ac8a1d73b246acc6bd1bdba9eafa455a633ee252ddc415a450105dd86975dae8ee8565ab70f2d660126700fd6dc63e6524903f20a35c5ab5e91783daa3bf417d54ca9c050e07b73f4846a54c8c57106db2cee25efba4e45e57174"));

    let vk = crate::VerificationKey { alpha, beta, delta, gamma, ic };

    let pi_a = bytesn_from_hex(&env, "137f60c8c6b41215ddba78598801ce8f1afd7cc9f002fd21c54b6c35f1e064b51f1e7be6f24d73d70efb1557e407c9cf111e55fe6df3d1454cefbad0f7d5541bc2dcb9041c3da82294fd68ff8d57667d5a8f9608b1abe522dd36abb8f9037b29");
    let pi_b = bytesn_from_hex(&env, "191ae116b9f05187113e718e7c346b13e602fa4696761fa03cd18e13814bfcb7b55b912d6a7b5203bd29a66154b85c63032792a66a0209b388a48c4b213b3bc82561042ad204f92fc67b7af9f732541d72de92caa42e0693317cad682dcdd64e0a6d4644b010d02da9385a135ea043020d77113f0f9b1b12d3eec2bbc4b74800d32a06622be08a9bb3172a29d4683466057492339eadc7b328840440e0d111cd0fd90db331e791d42b5cd85437b1e941b8cccac714c5a3ac606dd27f6fe3a610");
    let pi_c = bytesn_from_hex(&env, "05ab1ebfa5d3ccce4c2b3e26635e083742d3536fdf663248b0edc8550d009fdb7e55b427821d8cbb7abadf464cc5912a153bd2db91a0bbf923e3fcff19971af1df53b3f49e20bf52ddcebe337aa14c443ac9c487bbc6b70a8c69921cb35cc331");

    let proof = crate::Proof { a: pi_a, b: pi_b, c: pi_c };
    let commitment = bytesn_from_hex(&env, "0e2af42d136edccc7d4629bced04e547066cd7033464986a684eb7a64a5b3464");
    let discount_bps: u64 = 0; // 0 is invalid — must be [1, 1500]

    let ephemeral_public_key = BytesN::from_array(&env, &[0u8; 65]);
    let iv = BytesN::from_array(&env, &[0u8; 12]);
    let tag = BytesN::from_array(&env, &[0u8; 16]);
    let ciphertext = Bytes::new(&env);

    rwa_client.settle_asset_discounted(
        &asset_id,
        &vk,
        &proof,
        &discount_bps,
        &commitment,
        &ephemeral_public_key,
        &iv,
        &tag,
        &ciphertext,
    );
}

#[test]
#[should_panic]
fn test_discount_settlement_bps_exceeds_max_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let verifier_address = env.register(WASM, ());

    let rwa_contract_address = env.register(RwaSettlementContract, ());
    let rwa_client = RwaSettlementContractClient::new(&env, &rwa_contract_address);

    rwa_client.set_verifier(&verifier_address);

    let issuer = SorobanAddress::generate(&env);
    let asset_id = 203;
    let face_value = 1000;

    rwa_client.mint_asset(&asset_id, &issuer, &face_value, &AssetClass::TreasuryBill, &0u64, &0u64);

    let alpha = bytesn_from_hex(&env, "07b12aa9b309402dd44d1bf8d888ba0cae641a9f36cdcc7e84ce80fc3e6fe7f46c6ce53898dcbd79bdb357f994d3e3d109ccc53d5d43da77f716cfb18c8aeb9b76dcba8a4c908e4e7faae1e73591733662ff484328621b90b296844fc68eea9c");
    let beta = bytesn_from_hex(&env, "129e24196f60a79418119903435dba800a41244e860f2fd509644dc9724a07492995865e997ce9f1dfdc47d81e03a4d1044700199ca0ed2b98ba5b9dc8a1a6ec1d1bc6349491bcb70ae1191f6db5fee31f8e98f8875d79c1156964459a62a12406c9c39dcbad5cf9836d398008d35520a3977259bf083bfdd8a80ab00ff59e28705238d4ae9724e6c04b55e6bc01abc40e69d517c35ea382a58c3df7391cf69c37baa3cc6bc23bb0418f90bb95342e72f33d9a17551a77205fa1de953d9db91e");
    let delta = bytesn_from_hex(&env, "12b9a7bc86f42de50090c6d1136a25381a9d0db9689253205a87d68dcd5af0c1dd108cc31382ebe4e8c7a4ff03a79675162eaf365f165bbbe7926cf29d0b05b6d07c8b6c6be0ecafe4a44ff69295c4be7adb01b95fa94ccd15e0c403d383fd38026fdd5f2e57e1cae69288af5eba2b9459a38e98f7943b3e3f589d5542bab0e5884b2cd228070544aeb98dcaa157bd46092a4b7125abfc48ecee1d3f6eb113b132473b2145c8496da63ef0f492e40c913ca74b5b80b3ee7689e4f20ef0c78059");
    let gamma = bytesn_from_hex(&env, "13e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7e024aa2b2f08f0a91260805272dc51051c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb80606c4a02ea734cc32acd2b02bc28b99cb3e287e85a763af267492ab572e99ab3f370d275cec1da1aaa9075ff05f79be0ce5d527727d6e118cc9cdc6da2e351aadfd9baa8cbdd3a76d429a695160d12c923ac9cc3baca289e193548608b82801");

    let mut ic = Vec::new(&env);
    ic.push_back(bytesn_from_hex(&env, "0307b395e60005ea96872f43651bb9379bc4f4096c9cd441662f2181893801280ae67f0e5c9e1c4c8c1c5ece6518a69107d24e5e3548cc0297392f541cfa5fb83f6781274cbd95cb55887790a033dd9b9da06fe030d636f62df9cbe7fa202480"));
    ic.push_back(bytesn_from_hex(&env, "0d6c4b09bbf070280f8eece4f488e63274ab6df22e67bca5ebddac76d2a10ddef79b1686d8083c827c18cfb16578856e0e94b3b0ab5d585aa2c6e606ead94010c8715c69615fab0f6751e8301e8aa07065ad4fd9c68b973ea03b2cf27cc13ca1"));
    ic.push_back(bytesn_from_hex(&env, "0a0e8fdb994e9d2601a08c4b698f6bee23cc5d564244e95a853bdfd47773e7a2537bf525a9cf9d72b0348d82be27d36f002758a29dd82161026526e7248434db526b35de3b82aebf83d6c2b629967874dd8af980f28c6f9a7e97eb6cd4d4022e"));
    ic.push_back(bytesn_from_hex(&env, "16fcc5eaa37ac8a1d73b246acc6bd1bdba9eafa455a633ee252ddc415a450105dd86975dae8ee8565ab70f2d660126700fd6dc63e6524903f20a35c5ab5e91783daa3bf417d54ca9c050e07b73f4846a54c8c57106db2cee25efba4e45e57174"));

    let vk = crate::VerificationKey { alpha, beta, delta, gamma, ic };

    let pi_a = bytesn_from_hex(&env, "137f60c8c6b41215ddba78598801ce8f1afd7cc9f002fd21c54b6c35f1e064b51f1e7be6f24d73d70efb1557e407c9cf111e55fe6df3d1454cefbad0f7d5541bc2dcb9041c3da82294fd68ff8d57667d5a8f9608b1abe522dd36abb8f9037b29");
    let pi_b = bytesn_from_hex(&env, "191ae116b9f05187113e718e7c346b13e602fa4696761fa03cd18e13814bfcb7b55b912d6a7b5203bd29a66154b85c63032792a66a0209b388a48c4b213b3bc82561042ad204f92fc67b7af9f732541d72de92caa42e0693317cad682dcdd64e0a6d4644b010d02da9385a135ea043020d77113f0f9b1b12d3eec2bbc4b74800d32a06622be08a9bb3172a29d4683466057492339eadc7b328840440e0d111cd0fd90db331e791d42b5cd85437b1e941b8cccac714c5a3ac606dd27f6fe3a610");
    let pi_c = bytesn_from_hex(&env, "05ab1ebfa5d3ccce4c2b3e26635e083742d3536fdf663248b0edc8550d009fdb7e55b427821d8cbb7abadf464cc5912a153bd2db91a0bbf923e3fcff19971af1df53b3f49e20bf52ddcebe337aa14c443ac9c487bbc6b70a8c69921cb35cc331");

    let proof = crate::Proof { a: pi_a, b: pi_b, c: pi_c };
    let commitment = bytesn_from_hex(&env, "0e2af42d136edccc7d4629bced04e547066cd7033464986a684eb7a64a5b3464");
    let discount_bps: u64 = 1501; // exceeds 15% max

    let ephemeral_public_key = BytesN::from_array(&env, &[0u8; 65]);
    let iv = BytesN::from_array(&env, &[0u8; 12]);
    let tag = BytesN::from_array(&env, &[0u8; 16]);
    let ciphertext = Bytes::new(&env);

    rwa_client.settle_asset_discounted(
        &asset_id,
        &vk,
        &proof,
        &discount_bps,
        &commitment,
        &ephemeral_public_key,
        &iv,
        &tag,
        &ciphertext,
    );
}

#[test]
fn test_successful_redeem() {
    let env = Env::default();
    env.mock_all_auths();

    let verifier_address = env.register(WASM, ());
    let rwa_contract_address = env.register(RwaSettlementContract, ());
    let rwa_client = RwaSettlementContractClient::new(&env, &rwa_contract_address);
    rwa_client.set_verifier(&verifier_address);

    let issuer = SorobanAddress::generate(&env);
    let asset_id = 301;
    let face_value = 1000;

    rwa_client.mint_asset(&asset_id, &issuer, &face_value, &AssetClass::TreasuryBill, &0u64, &0u64);

    let result = rwa_client.try_redeem_asset(&asset_id);
    assert!(result.is_err());

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
    let commitment = bytesn_from_hex(&env, "572516bc4e0bbaf9d5621b0a5a122e42ca09709f6d5216e84db9f39afb5fa532");

    let ephemeral_public_key = BytesN::from_array(&env, &[0u8; 65]);
    let iv = BytesN::from_array(&env, &[0u8; 12]);
    let tag = BytesN::from_array(&env, &[0u8; 16]);
    let ciphertext = Bytes::new(&env);

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

    let asset_settled = rwa_client.get_asset(&asset_id);
    assert_eq!(asset_settled.status, AssetStatus::Settled);

    rwa_client.redeem_asset(&asset_id);

    let asset_redeemed = rwa_client.get_asset(&asset_id);
    assert_eq!(asset_redeemed.status, AssetStatus::Redeemed);
}

#[test]
#[should_panic]
fn test_redeem_active_asset_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let verifier_address = env.register(WASM, ());
    let rwa_contract_address = env.register(RwaSettlementContract, ());
    let rwa_client = RwaSettlementContractClient::new(&env, &rwa_contract_address);
    rwa_client.set_verifier(&verifier_address);

    let issuer = SorobanAddress::generate(&env);
    let asset_id = 302;
    let face_value = 1000;

    rwa_client.mint_asset(&asset_id, &issuer, &face_value, &AssetClass::TreasuryBill, &0u64, &0u64);

    rwa_client.redeem_asset(&asset_id);
}

#[test]
#[should_panic]
fn test_redeem_already_redeemed_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let verifier_address = env.register(WASM, ());
    let rwa_contract_address = env.register(RwaSettlementContract, ());
    let rwa_client = RwaSettlementContractClient::new(&env, &rwa_contract_address);
    rwa_client.set_verifier(&verifier_address);

    let issuer = SorobanAddress::generate(&env);
    let asset_id = 303;
    let face_value = 1000;

    rwa_client.mint_asset(&asset_id, &issuer, &face_value, &AssetClass::TreasuryBill, &0u64, &0u64);

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
    let commitment = bytesn_from_hex(&env, "572516bc4e0bbaf9d5621b0a5a122e42ca09709f6d5216e84db9f39afb5fa532");

    let ephemeral_public_key = BytesN::from_array(&env, &[0u8; 65]);
    let iv = BytesN::from_array(&env, &[0u8; 12]);
    let tag = BytesN::from_array(&env, &[0u8; 16]);
    let ciphertext = Bytes::new(&env);

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

    rwa_client.redeem_asset(&asset_id);

    rwa_client.redeem_asset(&asset_id);
}
