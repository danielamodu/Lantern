#![no_std]
use soroban_sdk::{contract, contractimpl, contracterror, contracttype, symbol_short, Address, Bytes, BytesN, Env, Vec, U256};

// Import the verifier contract to auto-generate the Client
mod verifier {
    soroban_sdk::contractimport!(
        file = "../../soroban-examples/groth16_verifier/target/wasm32v1-none/release/soroban_groth16_verifier_contract.wasm"
    );
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SettlementError {
    AssetNotFound = 101,
    AssetAlreadySettled = 102,
    VerifierNotConfigured = 103,
    InvalidZkProof = 104,
}

// Define the ZK VerificationKey locally to export it in the contract spec (metadata XDR)
#[derive(Clone)]
#[contracttype]
pub struct VerificationKey {
    pub alpha: BytesN<96>,
    pub beta: BytesN<192>,
    pub delta: BytesN<192>,
    pub gamma: BytesN<192>,
    pub ic: Vec<BytesN<96>>,
}

// Define the ZK Proof locally to export it in the contract spec (metadata XDR)
#[derive(Clone)]
#[contracttype]
pub struct Proof {
    pub a: BytesN<96>,
    pub b: BytesN<192>,
    pub c: BytesN<96>,
}

// Struct representing the RWA Asset details, stored securely in contract storage.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct RwaAsset {
    pub id: u32,
    pub issuer: Address,
    pub face_value: u64, // Stored immutable target amount
    pub settled: bool,
}

#[contract]
pub struct RwaSettlementContract;

#[contractimpl]
impl RwaSettlementContract {
    /// Configures the address of the deployed verifier contract
    pub fn set_verifier(env: Env, verifier_address: Address) {
        env.storage().instance().set(&"verifier", &verifier_address);
    }

    /// Mints/Registers a new RWA asset.
    pub fn mint_asset(env: Env, asset_id: u32, issuer: Address, face_value: u64) {
        issuer.require_auth();
        
        let store_key = asset_id;
        if env.storage().persistent().has(&store_key) {
            panic!("Asset already exists");
        }

        let asset = RwaAsset {
            id: asset_id,
            issuer,
            face_value,
            settled: false,
        };

        env.storage().persistent().set(&store_key, &asset);
    }

    /// Performs private settlement of a registered RWA asset and publishes the encrypted disclosure payload.
    pub fn settle_asset(
        env: Env,
        asset_id: u32,
        vk: VerificationKey,
        proof: Proof,
        commitment: BytesN<32>,  // Public commitment hash: hash(amount, salt)
        ephemeral_public_key: BytesN<65>, // ECIES Ephemeral Key
        iv: BytesN<12>,                    // AES-GCM IV
        tag: BytesN<16>,                   // AES-GCM Tag
        ciphertext: Bytes,                 // Encrypted settlement amount
    ) -> Result<(), SettlementError> {
        let store_key = asset_id;
        if !env.storage().persistent().has(&store_key) {
            return Err(SettlementError::AssetNotFound);
        }

        let mut asset: RwaAsset = env.storage().persistent().get(&store_key).unwrap();

        if asset.settled {
            return Err(SettlementError::AssetAlreadySettled);
        }

        // Fetch verifier address from instance storage
        if !env.storage().instance().has(&"verifier") {
            return Err(SettlementError::VerifierNotConfigured);
        }

        let verifier_address: Address = env.storage().instance().get(&"verifier").unwrap();

        // Convert commitment (BytesN<32>) and stored face_value (u64) into U256 for public signals.
        let commitment_u256 = U256::from_be_bytes(&env, &Bytes::from_array(&env, &commitment.to_array()));
        let face_value_u256 = U256::from_u128(&env, asset.face_value as u128);

        let public_inputs = Vec::from_array(
            &env,
            [
                commitment_u256, // Positional Index 0 (commitment)
                face_value_u256, // Positional Index 1 (face_value)
            ],
        );

        // Translate local structs to the client verifier types
        let verifier_vk = verifier::VerificationKey {
            alpha: vk.alpha,
            beta: vk.beta,
            delta: vk.delta,
            gamma: vk.gamma,
            ic: vk.ic,
        };

        let verifier_proof = verifier::Proof {
            a: proof.a,
            b: proof.b,
            c: proof.c,
        };

        // Instantiate verifier client and execute verification
        let verifier_client = verifier::Client::new(&env, &verifier_address);
        let is_valid = verifier_client.verify_proof(&verifier_vk, &verifier_proof, &public_inputs);

        if !is_valid {
            return Err(SettlementError::InvalidZkProof);
        }

        // Set to settled upon successful verification
        asset.settled = true;
        env.storage().persistent().set(&store_key, &asset);

        // Publish ECIES ciphertext disclosure data to the public ledger via a contract event
        env.events().publish(
            (symbol_short!("settle"), asset_id),
            (ephemeral_public_key, iv, tag, ciphertext),
        );

        Ok(())
    }

    /// Helper view function to check asset status
    pub fn get_asset(env: Env, asset_id: u32) -> RwaAsset {
        env.storage()
            .persistent()
            .get(&asset_id)
            .unwrap_or_else(|| panic!("Asset not found"))
    }
}

mod test;
