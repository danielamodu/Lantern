pragma circom 2.2.0;

include "poseidon255.circom";

template SettlementVerifier() {
    // PUBLIC SIGNALS
    signal input commitment;
    signal input target_face_value;

    // PRIVATE SIGNALS
    signal input settlement_amount;
    signal input blinding_salt;

    // CONSTRAINTS
    // 1. Prove that the private settlement amount equals the target face value
    settlement_amount === target_face_value;

    // 2. Prove that the commitment matches the hash of the private amount and the blinding salt
    component hasher = Poseidon255(2);
    hasher.in[0] <== settlement_amount;
    hasher.in[1] <== blinding_salt;

    commitment === hasher.out;
}

// Declare main components with the exact ordering of public signals.
component main {public [commitment, target_face_value]} = SettlementVerifier();
