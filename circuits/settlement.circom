pragma circom 2.2.0;

include "poseidon255.circom";

template SettlementVerifier() {
    // PUBLIC OUTPUT - computed by the circuit, not supplied as input
    // The prover cannot manipulate this: it is always Poseidon255(settlement_amount, blinding_salt)
    signal output commitment;

    // PUBLIC INPUT
    signal input target_face_value;

    // PRIVATE INPUTS - hidden from the verifier
    signal input settlement_amount;
    signal input blinding_salt;

    // CONSTRAINT 1: Prove that the private settlement amount equals the target face value
    settlement_amount === target_face_value;

    // CONSTRAINT 2: Compute the Poseidon255 commitment from the private inputs
    // The circuit computes this itself - the prover cannot lie about it
    component hasher = Poseidon255(2);
    hasher.in[0] <== settlement_amount;
    hasher.in[1] <== blinding_salt;

    commitment <== hasher.out;
}

// commitment is a public output (auto-public); target_face_value is a public input
component main {public [target_face_value]} = SettlementVerifier();
