// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockResolver {
    mapping(bytes32 => mapping(string => string)) public texts;
    
    function setText(bytes32 node, string calldata key, string calldata value) external {
        texts[node][key] = value;
    }
    
    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return texts[node][key];
    }
}
